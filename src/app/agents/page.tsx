'use client';

import { useState, useRef } from 'react';
import TestPageLayout from '@/components/TestPageLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Play,
  Bot,
  Brain,
  Cpu,
  MessageSquare,
  CheckCircle,
  Clock,
  Zap,
  Settings,
  Users,
} from 'lucide-react';

interface AgentRequest {
  task: string;
  agentType: 'react' | 'plan-execute' | 'conversational';
  maxSteps: number;
  tools: string[];
  useMemory: boolean;
  temperature?: number;
  modelName?: string;
  stream?: boolean;
}

interface AgentStep {
  stepNumber: number;
  stepType: 'observe' | 'think' | 'plan' | 'act' | 'reflect' | 'tool_use';
  content: string;
  reasoning: string;
  toolCalls?: ToolCall[];
  timestamp: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

interface ToolCall {
  toolName: string;
  input: any;
  output: any;
  success: boolean;
  duration: number;
}

interface AgentPlan {
  taskId: string;
  mainGoal: string;
  subTasks: {
    id: string;
    description: string;
    dependencies: string[];
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    priority: number;
  }[];
  strategy: string;
  estimatedSteps: number;
}

interface AgentMemory {
  shortTerm: {
    currentTask: string;
    context: string[];
    recentActions: AgentStep[];
  };
  longTerm: {
    experiences: string[];
    patterns: string[];
    preferences: Record<string, any>;
  };
}

export default function AgentsPage() {
  const [request, setRequest] = useState<AgentRequest>({
    task: '帮我制定一个学习人工智能的计划',
    agentType: 'plan-execute',
    maxSteps: 8,
    tools: ['search', 'planner', 'calculator'],
    useMemory: true,
    temperature: 0.7,
    modelName: 'gpt-3.5-turbo',
    stream: true,
  });

  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState('');
  const [plan, setPlan] = useState<AgentPlan | null>(null);
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [memory, setMemory] = useState<AgentMemory | null>(null);
  const [finalResult, setFinalResult] = useState('');
  const [toolsUsed, setToolsUsed] = useState<string[]>([]);

  const abortControllerRef = useRef<AbortController | null>(null);

  const agentTypes = {
    react: {
      name: 'ReAct智能体',
      description: '推理和行动循环，适合需要逐步分析的任务',
      color: 'bg-blue-100 text-blue-800',
      icon: Brain,
      features: ['逐步推理', '行动反馈', '观察环境', '灵活适应'],
      examples: [
        '研究某个复杂问题',
        '解决多步骤的逻辑问题',
        '进行数据分析和推理',
      ],
    },
    'plan-execute': {
      name: '计划执行智能体',
      description: '先制定详细计划，再逐步执行',
      color: 'bg-green-100 text-green-800',
      icon: Cpu,
      features: ['详细规划', '系统执行', '进度追踪', '目标导向'],
      examples: ['制定学习计划', '项目管理和执行', '复杂任务的分解和执行'],
    },
    conversational: {
      name: '对话式智能体',
      description: '基于对话的智能体，适合交互式任务',
      color: 'bg-purple-100 text-purple-800',
      icon: MessageSquare,
      features: ['自然对话', '上下文理解', '用户友好', '交互式'],
      examples: ['客户服务和咨询', '教学和指导', '创意写作和讨论'],
    },
  };

  const availableTools = {
    search: {
      name: '搜索工具',
      description: '搜索相关信息和知识',
      color: 'bg-blue-100 text-blue-700',
    },
    calculator: {
      name: '计算器',
      description: '执行数学计算',
      color: 'bg-green-100 text-green-700',
    },
    code_executor: {
      name: '代码执行器',
      description: '执行代码片段',
      color: 'bg-purple-100 text-purple-700',
    },
    planner: {
      name: '规划器',
      description: '制定详细计划',
      color: 'bg-orange-100 text-orange-700',
    },
    executor: {
      name: '执行器',
      description: '执行具体步骤',
      color: 'bg-red-100 text-red-700',
    },
    knowledge_base: {
      name: '知识库',
      description: '查询专业知识',
      color: 'bg-indigo-100 text-indigo-700',
    },
    conversation_manager: {
      name: '对话管理器',
      description: '管理对话状态',
      color: 'bg-pink-100 text-pink-700',
    },
  };

  const handleSubmit = async () => {
    if (request.task.trim().length === 0) {
      return;
    }

    setIsRunning(true);
    setCurrentStep('');
    setPlan(null);
    setSteps([]);
    setMemory(null);
    setFinalResult('');
    setToolsUsed([]);

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error('请求失败');
      }

      if (request.stream && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                switch (data.type) {
                  case 'start':
                    setCurrentStep(
                      `启动${agentTypes[request.agentType].name}...`
                    );
                    break;
                  case 'plan_generated':
                    setPlan(data.plan);
                    setCurrentStep('计划制定完成');
                    break;
                  case 'step_generated':
                    setSteps((prev) => [...prev, data.step]);
                    setCurrentStep(
                      `执行步骤 ${data.step.stepNumber}: ${data.step.stepType}`
                    );
                    break;
                  case 'tool_executed':
                    setCurrentStep(`工具 ${data.toolCall.toolName} 执行完成`);
                    break;
                  case 'memory_updated':
                    setMemory(data.memory);
                    break;
                  case 'final_result':
                    setFinalResult(data.result.finalResult);
                    setToolsUsed(data.result.toolsUsed);
                    setCurrentStep('智能体任务完成！');
                    break;
                  case 'done':
                    setIsRunning(false);
                    break;
                  case 'error':
                    throw new Error(data.error || '处理过程发生错误');
                }
              } catch (e) {
                console.error('Error parsing SSE data:', e);
              }
            }
          }
        }
      } else {
        const data = await response.json();
        setPlan(data.plan);
        setSteps(data.steps);
        setMemory(data.memory);
        setFinalResult(data.finalResult);
        setToolsUsed(data.toolsUsed);
        setIsRunning(false);
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Agent Error:', error);
        setCurrentStep(`错误: ${error.message}`);
      }
      setIsRunning(false);
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsRunning(false);
      setCurrentStep('已停止Agent执行');
    }
  };

  const toggleTool = (toolName: string) => {
    setRequest((prev) => ({
      ...prev,
      tools: prev.tools.includes(toolName)
        ? prev.tools.filter((t) => t !== toolName)
        : [...prev.tools, toolName],
    }));
  };

  const setExampleTask = (example: string) => {
    setRequest((prev) => ({ ...prev, task: example }));
  };

  const getStepIcon = (stepType: string) => {
    switch (stepType) {
      case 'observe':
        return '👁️';
      case 'think':
        return '🤔';
      case 'plan':
        return '📋';
      case 'act':
        return '⚡';
      case 'reflect':
        return '💭';
      case 'tool_use':
        return '🔧';
      default:
        return '📝';
    }
  };

  const getStepColor = (stepType: string) => {
    switch (stepType) {
      case 'observe':
        return 'bg-blue-100 text-blue-800';
      case 'think':
        return 'bg-green-100 text-green-800';
      case 'plan':
        return 'bg-purple-100 text-purple-800';
      case 'act':
        return 'bg-orange-100 text-orange-800';
      case 'reflect':
        return 'bg-pink-100 text-pink-800';
      case 'tool_use':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <TestPageLayout
      title="LLM 智能体系统"
      description="基于大语言模型的智能体，具备规划、记忆、工具使用等核心能力"
    >
      <div className="space-y-6 p-6">
        <Tabs defaultValue="theory" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="theory">原理介绍</TabsTrigger>
            <TabsTrigger value="test">实践测试</TabsTrigger>
          </TabsList>

          <TabsContent value="theory" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  LLM智能体架构
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-gray-600">
                  <p className="mb-4">
                    <strong>LLM智能体</strong>
                    是利用大语言模型进行复杂任务执行的应用系统。LLM充当控制中心或"大脑"，负责管理完成任务所需的一系列操作。
                  </p>

                  <div className="space-y-3">
                    <div className="border-l-4 border-blue-500 pl-4">
                      <h4 className="font-semibold text-blue-700">
                        1. 规划 (Planning)
                      </h4>
                      <p>
                        <strong>无反馈规划</strong>
                        ：将复杂任务分解为子任务，制定详细执行计划
                      </p>
                      <p>
                        <strong>有反馈规划</strong>
                        ：基于环境反馈动态调整和优化计划
                      </p>
                    </div>

                    <div className="border-l-4 border-green-500 pl-4">
                      <h4 className="font-semibold text-green-700">
                        2. 记忆 (Memory)
                      </h4>
                      <p>
                        <strong>短期记忆</strong>：存储当前任务上下文和近期行动
                      </p>
                      <p>
                        <strong>长期记忆</strong>：积累经验、模式和偏好设置
                      </p>
                    </div>

                    <div className="border-l-4 border-purple-500 pl-4">
                      <h4 className="font-semibold text-purple-700">
                        3. 工具使用 (Tool Use)
                      </h4>
                      <p>调用外部API、执行计算、搜索信息等扩展能力</p>
                    </div>
                  </div>

                  <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-semibold text-blue-800 mb-2">
                      三种智能体类型
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-blue-700">
                      <div>
                        <strong>ReAct智能体：</strong>
                        <ul className="list-disc list-inside space-y-1 mt-1">
                          <li>观察→思考→行动循环</li>
                          <li>逐步推理分析</li>
                          <li>适合探索性任务</li>
                        </ul>
                      </div>
                      <div>
                        <strong>计划执行智能体：</strong>
                        <ul className="list-disc list-inside space-y-1 mt-1">
                          <li>先规划后执行</li>
                          <li>系统性方法</li>
                          <li>适合结构化任务</li>
                        </ul>
                      </div>
                      <div>
                        <strong>对话式智能体：</strong>
                        <ul className="list-disc list-inside space-y-1 mt-1">
                          <li>自然语言交互</li>
                          <li>上下文理解</li>
                          <li>适合服务型任务</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h4 className="font-semibold text-green-800 mb-2">
                      核心优势
                    </h4>
                    <ul className="text-green-700 space-y-1">
                      <li>
                        • <strong>自主性</strong>：能够独立制定和执行计划
                      </li>
                      <li>
                        • <strong>适应性</strong>：根据反馈动态调整策略
                      </li>
                      <li>
                        • <strong>扩展性</strong>：通过工具使用获得更多能力
                      </li>
                      <li>
                        • <strong>记忆性</strong>：积累经验，持续学习改进
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="test" className="space-y-6">
            {/* 智能体配置 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  智能体配置
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="task">任务描述</Label>
                  <Textarea
                    id="task"
                    placeholder="描述您希望智能体完成的任务..."
                    value={request.task}
                    onChange={(e) =>
                      setRequest((prev) => ({ ...prev, task: e.target.value }))
                    }
                    className="min-h-[80px]"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="agentType">智能体类型</Label>
                    <Select
                      value={request.agentType}
                      onValueChange={(value: AgentRequest['agentType']) =>
                        setRequest((prev) => ({ ...prev, agentType: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(agentTypes).map(([key, type]) => {
                          const IconComponent = type.icon;
                          return (
                            <SelectItem key={key} value={key}>
                              <div className="flex items-center gap-2">
                                <IconComponent className="h-4 w-4" />
                                <Badge className={type.color}>
                                  {type.name}
                                </Badge>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxSteps">最大步数</Label>
                    <Input
                      id="maxSteps"
                      type="number"
                      min="1"
                      max="20"
                      value={request.maxSteps}
                      onChange={(e) =>
                        setRequest((prev) => ({
                          ...prev,
                          maxSteps: parseInt(e.target.value) || 8,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="useMemory"
                    checked={request.useMemory}
                    onChange={(e) =>
                      setRequest((prev) => ({
                        ...prev,
                        useMemory: e.target.checked,
                      }))
                    }
                    className="rounded"
                  />
                  <Label htmlFor="useMemory" className="text-sm">
                    启用记忆系统（短期和长期记忆）
                  </Label>
                </div>
              </CardContent>
            </Card>

            {/* 工具选择 */}
            <Card>
              <CardHeader>
                <CardTitle>可用工具</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {Object.entries(availableTools).map(([key, tool]) => {
                    const isSelected = request.tools.includes(key);

                    return (
                      <div
                        key={key}
                        className={`p-3 border rounded-lg cursor-pointer transition-all ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => toggleTool(key)}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={tool.color}>{tool.name}</Badge>
                        </div>
                        <p className="text-xs text-gray-600">
                          {tool.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* 示例任务 */}
            <Card>
              <CardHeader>
                <CardTitle>示例任务</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {agentTypes[request.agentType].examples.map(
                    (example, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                        onClick={() => setExampleTask(example)}
                      >
                        <Badge variant="outline">{index + 1}</Badge>
                        <span className="flex-1 text-sm">{example}</span>
                        <Button variant="ghost" size="sm">
                          使用
                        </Button>
                      </div>
                    )
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 执行控制 */}
            <Card>
              <CardHeader>
                <CardTitle>启动智能体</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <Button
                    onClick={handleSubmit}
                    disabled={isRunning || request.task.trim().length === 0}
                    className="flex-1"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    {isRunning ? '执行中...' : '启动智能体'}
                  </Button>

                  {isRunning && (
                    <Button variant="outline" onClick={handleStop}>
                      停止
                    </Button>
                  )}
                </div>

                {/* 实时状态 */}
                {isRunning && currentStep && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      <span className="text-blue-700 font-medium">
                        智能体状态
                      </span>
                    </div>
                    <p className="text-blue-600">{currentStep}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 执行计划 */}
            {plan && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Cpu className="h-5 w-5" />
                    执行计划
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-700">
                        主要目标
                      </Label>
                      <p className="text-sm text-gray-600 mt-1">
                        {plan.mainGoal}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">
                        执行策略
                      </Label>
                      <p className="text-sm text-gray-600 mt-1">
                        {plan.strategy}
                      </p>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-gray-700">
                      子任务列表
                    </Label>
                    <div className="space-y-2 mt-2">
                      {plan.subTasks.map((subtask, index) => (
                        <div
                          key={subtask.id}
                          className="flex items-center gap-2 p-2 border rounded"
                        >
                          <Badge variant="outline">
                            优先级 {subtask.priority}
                          </Badge>
                          <span className="flex-1 text-sm">
                            {subtask.description}
                          </span>
                          <Badge
                            className={
                              subtask.status === 'completed'
                                ? 'bg-green-100 text-green-800'
                                : subtask.status === 'in_progress'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-gray-100 text-gray-800'
                            }
                          >
                            {subtask.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 执行步骤 */}
            {steps.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    执行步骤
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {steps.map((step, index) => (
                    <div
                      key={index}
                      className="border border-gray-200 rounded-lg p-4"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">
                          {getStepIcon(step.stepType)}
                        </span>
                        <Badge className={getStepColor(step.stepType)}>
                          步骤 {step.stepNumber}: {step.stepType}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={
                            step.status === 'completed'
                              ? 'border-green-500 text-green-700'
                              : step.status === 'running'
                                ? 'border-blue-500 text-blue-700'
                                : 'border-gray-500 text-gray-700'
                          }
                        >
                          {step.status}
                        </Badge>
                        <span className="text-xs text-gray-500 ml-auto">
                          {new Date(step.timestamp).toLocaleTimeString()}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <div>
                          <Label className="text-sm font-medium text-gray-700">
                            内容
                          </Label>
                          <p className="text-sm text-gray-600 mt-1">
                            {step.content}
                          </p>
                        </div>

                        <div>
                          <Label className="text-sm font-medium text-gray-700">
                            推理过程
                          </Label>
                          <p className="text-sm text-gray-600 mt-1">
                            {step.reasoning}
                          </p>
                        </div>

                        {step.toolCalls && step.toolCalls.length > 0 && (
                          <div>
                            <Label className="text-sm font-medium text-gray-700">
                              工具调用
                            </Label>
                            <div className="space-y-2 mt-1">
                              {step.toolCalls.map((toolCall, toolIndex) => (
                                <div
                                  key={toolIndex}
                                  className="p-2 bg-gray-50 rounded"
                                >
                                  <div className="flex items-center gap-2 mb-1">
                                    <Badge variant="outline">
                                      {toolCall.toolName}
                                    </Badge>
                                    <Badge
                                      className={
                                        toolCall.success
                                          ? 'bg-green-100 text-green-800'
                                          : 'bg-red-100 text-red-800'
                                      }
                                    >
                                      {toolCall.success ? '成功' : '失败'}
                                    </Badge>
                                    <span className="text-xs text-gray-500">
                                      {toolCall.duration}ms
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-600">
                                    输入: {toolCall.input}
                                  </p>
                                  <p className="text-xs text-gray-600">
                                    输出: {toolCall.output}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* 记忆状态 */}
            {memory && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    记忆状态
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="short-term" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="short-term">短期记忆</TabsTrigger>
                      <TabsTrigger value="long-term">长期记忆</TabsTrigger>
                    </TabsList>

                    <TabsContent value="short-term" className="space-y-3">
                      <div>
                        <Label className="text-sm font-medium text-gray-700">
                          当前任务
                        </Label>
                        <p className="text-sm text-gray-600 mt-1">
                          {memory.shortTerm.currentTask}
                        </p>
                      </div>

                      <div>
                        <Label className="text-sm font-medium text-gray-700">
                          上下文 (最近10条)
                        </Label>
                        <div className="space-y-1 mt-2">
                          {memory.shortTerm.context
                            .slice(-5)
                            .map((ctx, index) => (
                              <p
                                key={index}
                                className="text-xs text-gray-600 p-2 bg-gray-50 rounded"
                              >
                                {ctx}
                              </p>
                            ))}
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="long-term" className="space-y-3">
                      <div>
                        <Label className="text-sm font-medium text-gray-700">
                          经验积累
                        </Label>
                        <div className="space-y-1 mt-2">
                          {memory.longTerm.experiences.map((exp, index) => (
                            <p
                              key={index}
                              className="text-xs text-gray-600 p-2 bg-gray-50 rounded"
                            >
                              {exp}
                            </p>
                          ))}
                          {memory.longTerm.experiences.length === 0 && (
                            <p className="text-xs text-gray-500 italic">
                              暂无长期经验记录
                            </p>
                          )}
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            )}

            {/* 最终结果 */}
            {finalResult && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    执行结果
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="text-green-800 whitespace-pre-wrap">
                      {finalResult}
                    </div>
                  </div>

                  {toolsUsed.length > 0 && (
                    <div>
                      <Label className="text-sm font-medium text-gray-700">
                        使用的工具
                      </Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {toolsUsed.map((tool) => (
                          <Badge
                            key={tool}
                            variant="outline"
                            className="text-xs"
                          >
                            {availableTools[tool as keyof typeof availableTools]
                              ?.name || tool}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-700">
                      🤖 <strong>LLM智能体优势</strong>
                      ：结合规划、记忆、工具使用等核心能力，实现自主的任务执行和问题解决。
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </TestPageLayout>
  );
}
