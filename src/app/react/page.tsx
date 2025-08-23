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
  Search,
  Calculator,
  Database,
  Eye,
  CheckCircle,
  ArrowRight,
  Brain,
} from 'lucide-react';

interface ReActRequest {
  question: string;
  taskType: 'knowledge' | 'decision' | 'reasoning' | 'general';
  maxSteps: number;
  availableTools: string[];
  temperature?: number;
  modelName?: string;
  stream?: boolean;
}

interface ReActStep {
  stepNumber: number;
  thought: string;
  action: string;
  actionInput: string;
  observation: string;
  timestamp: number;
}

interface ToolCall {
  toolName: string;
  input: string;
  output: string;
  success: boolean;
  duration: number;
}

interface ReActResponse {
  question: string;
  taskType: string;
  steps: ReActStep[];
  toolCalls: ToolCall[];
  finalAnswer: string;
  totalSteps: number;
  totalTime: number;
  usedTools: string[];
  reasoning: string;
}

export default function ReActPage() {
  const [request, setRequest] = useState<ReActRequest>({
    question: '奥利维亚·王尔德的男朋友是谁？他现在的年龄的0.23次方是多少？',
    taskType: 'knowledge',
    maxSteps: 6,
    availableTools: ['search', 'calculator', 'knowledge', 'lookup', 'finish'],
    temperature: 0.7,
    modelName: 'gpt-3.5-turbo',
    stream: true,
  });

  const [response, setResponse] = useState<ReActResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState('');
  const [steps, setSteps] = useState<ReActStep[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [currentStepNumber, setCurrentStepNumber] = useState(0);

  const abortControllerRef = useRef<AbortController | null>(null);

  const taskTypes = {
    knowledge: {
      name: '知识密集型',
      description: '需要外部知识的问答和事实验证',
      color: 'bg-blue-100 text-blue-800',
      icon: Database,
      examples: [
        '科罗拉多造山带东部地区的海拔范围是多少？',
        '现任美国总统是谁，他的出生地在哪个州？',
        '2024年奥运会在哪里举办，有多少个比赛项目？',
      ],
    },
    decision: {
      name: '决策型',
      description: '需要规划和决策的复杂任务',
      color: 'bg-green-100 text-green-800',
      icon: Brain,
      examples: [
        '我要从北京去上海旅游3天，帮我制定最优路线',
        '给我一个1000元预算的电脑配置方案',
        '如何在30天内学会Python编程？',
      ],
    },
    reasoning: {
      name: '推理型',
      description: '需要逻辑推理和计算的问题',
      color: 'bg-purple-100 text-purple-800',
      icon: Calculator,
      examples: [
        '一个班级有30个学生，60%是男生，男生比女生多多少人？',
        '如果我每天存10元，一年后能存多少钱？按5%年利率计算复利',
        '某公司股价从100元涨到120元，涨幅是多少？',
      ],
    },
    general: {
      name: '通用型',
      description: '各种类型的综合问题',
      color: 'bg-gray-100 text-gray-800',
      icon: Search,
      examples: [
        '帮我分析一下人工智能的发展趋势',
        '比较一下苹果和安卓手机的优缺点',
        '解释一下区块链技术的工作原理',
      ],
    },
  };

  const availableTools = {
    search: {
      name: '搜索',
      description: '搜索相关信息和知识',
      color: 'bg-blue-100 text-blue-700',
      icon: Search,
    },
    calculator: {
      name: '计算器',
      description: '执行数学计算',
      color: 'bg-green-100 text-green-700',
      icon: Calculator,
    },
    knowledge: {
      name: '知识库',
      description: '查询专业知识和事实',
      color: 'bg-purple-100 text-purple-700',
      icon: Database,
    },
    lookup: {
      name: '查找',
      description: '在文档中查找信息',
      color: 'bg-orange-100 text-orange-700',
      icon: Eye,
    },
    finish: {
      name: '完成',
      description: '提供最终答案',
      color: 'bg-gray-100 text-gray-700',
      icon: CheckCircle,
    },
  };

  const handleSubmit = async () => {
    if (request.question.trim().length === 0) {
      return;
    }

    setIsLoading(true);
    setResponse(null);
    setCurrentStep('');
    setSteps([]);
    setToolCalls([]);
    setCurrentStepNumber(0);

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/react', {
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
                    setCurrentStep(`开始ReAct推理 - ${data.taskType} 任务`);
                    break;
                  case 'step_complete':
                    setSteps((prev) => [...prev, data.step]);
                    setCurrentStepNumber(data.step.stepNumber);
                    setCurrentStep(`完成第 ${data.step.stepNumber} 步推理`);
                    break;
                  case 'tool_call':
                    setToolCalls((prev) => [...prev, data.toolCall]);
                    break;
                  case 'final_result':
                    setResponse(data.result);
                    setCurrentStep('ReAct推理完成！');
                    break;
                  case 'done':
                    setIsLoading(false);
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
        setResponse(data);
        setIsLoading(false);
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('ReAct Error:', error);
        setCurrentStep(`错误: ${error.message}`);
      }
      setIsLoading(false);
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
      setCurrentStep('已停止ReAct推理');
    }
  };

  const toggleTool = (toolName: string) => {
    if (toolName === 'finish') return; // finish工具必须包含

    setRequest((prev) => ({
      ...prev,
      availableTools: prev.availableTools.includes(toolName)
        ? prev.availableTools.filter((t) => t !== toolName)
        : [...prev.availableTools, toolName],
    }));
  };

  const setExampleQuestion = (example: string) => {
    setRequest((prev) => ({ ...prev, question: example }));
  };

  return (
    <TestPageLayout
      title="ReAct 推理行动框架"
      description="交错生成推理轨迹和任务操作，通过思考-行动-观察循环解决复杂问题"
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
                  <Brain className="h-5 w-5" />
                  ReAct 工作原理
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-gray-600">
                  <p className="mb-4">
                    <strong>ReAct框架</strong>
                    是Yao等人（2022）提出的一种方法，让LLM以交错的方式生成推理轨迹和任务特定操作，通过与外部工具交互来获取信息并解决复杂问题。
                  </p>

                  <div className="space-y-3">
                    <div className="border-l-4 border-blue-500 pl-4">
                      <h4 className="font-semibold text-blue-700">
                        1. 思考 (Thought)
                      </h4>
                      <p>生成推理轨迹，分析当前情况，制定下一步行动计划。</p>
                    </div>

                    <div className="border-l-4 border-green-500 pl-4">
                      <h4 className="font-semibold text-green-700">
                        2. 行动 (Action)
                      </h4>
                      <p>执行具体的任务操作，如搜索、计算、查询等。</p>
                    </div>

                    <div className="border-l-4 border-purple-500 pl-4">
                      <h4 className="font-semibold text-purple-700">
                        3. 观察 (Observation)
                      </h4>
                      <p>获取行动的结果，为下一轮推理提供信息。</p>
                    </div>

                    <div className="border-l-4 border-orange-500 pl-4">
                      <h4 className="font-semibold text-orange-700">
                        4. 循环迭代
                      </h4>
                      <p>重复思考-行动-观察过程，直到找到最终答案。</p>
                    </div>
                  </div>

                  <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-semibold text-blue-800 mb-2">
                      ReAct vs 传统方法
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-blue-700">
                      <div>
                        <strong>传统CoT：</strong>
                        <ul className="list-disc list-inside space-y-1 mt-1">
                          <li>纯文本推理</li>
                          <li>无外部信息</li>
                          <li>可能产生幻觉</li>
                        </ul>
                      </div>
                      <div>
                        <strong>仅行动：</strong>
                        <ul className="list-disc list-inside space-y-1 mt-1">
                          <li>只执行操作</li>
                          <li>缺乏推理过程</li>
                          <li>难以处理复杂问题</li>
                        </ul>
                      </div>
                      <div>
                        <strong>ReAct：</strong>
                        <ul className="list-disc list-inside space-y-1 mt-1">
                          <li>推理+行动结合</li>
                          <li>实时信息获取</li>
                          <li>可解释可验证</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h4 className="font-semibold text-green-800 mb-2">
                      适用场景
                    </h4>
                    <ul className="text-green-700 space-y-1">
                      <li>
                        • <strong>知识密集型任务</strong>
                        ：需要外部知识的问答、事实验证
                      </li>
                      <li>
                        • <strong>决策型任务</strong>：复杂环境下的规划和决策
                      </li>
                      <li>
                        • <strong>多步骤推理</strong>：需要逐步分析和验证的问题
                      </li>
                      <li>
                        • <strong>工具协作</strong>：需要多种工具配合的综合任务
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="test" className="space-y-6">
            {/* 问题配置 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  问题配置
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="question">问题描述</Label>
                  <Textarea
                    id="question"
                    placeholder="输入您要解决的问题..."
                    value={request.question}
                    onChange={(e) =>
                      setRequest((prev) => ({
                        ...prev,
                        question: e.target.value,
                      }))
                    }
                    className="min-h-[80px]"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="taskType">任务类型</Label>
                    <Select
                      value={request.taskType}
                      onValueChange={(value: ReActRequest['taskType']) =>
                        setRequest((prev) => ({ ...prev, taskType: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(taskTypes).map(([key, type]) => {
                          const IconComponent = type.icon;
                          return (
                            <SelectItem key={key} value={key}>
                              <div className="flex items-center gap-2">
                                <IconComponent className="h-4 w-4" />
                                <Badge className={type.color}>
                                  {type.name}
                                </Badge>
                                <span className="text-sm text-gray-600">
                                  {type.description}
                                </span>
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
                          maxSteps: parseInt(e.target.value) || 6,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="temperature">创造性</Label>
                    <Input
                      id="temperature"
                      type="number"
                      min="0"
                      max="1"
                      step="0.1"
                      value={request.temperature}
                      onChange={(e) =>
                        setRequest((prev) => ({
                          ...prev,
                          temperature: parseFloat(e.target.value) || 0.7,
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="modelName">模型选择</Label>
                    <Select
                      value={request.modelName}
                      onValueChange={(value) =>
                        setRequest((prev) => ({ ...prev, modelName: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gpt-3.5-turbo">
                          GPT-3.5 Turbo
                        </SelectItem>
                        <SelectItem value="gpt-4">GPT-4</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 工具选择 */}
            <Card>
              <CardHeader>
                <CardTitle>可用工具</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {Object.entries(availableTools).map(([key, tool]) => {
                    const IconComponent = tool.icon;
                    const isSelected = request.availableTools.includes(key);
                    const isFinish = key === 'finish';

                    return (
                      <div
                        key={key}
                        className={`p-3 border rounded-lg cursor-pointer transition-all ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        } ${isFinish ? 'opacity-50 cursor-not-allowed' : ''}`}
                        onClick={() => !isFinish && toggleTool(key)}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <IconComponent className="h-4 w-4" />
                          <Badge className={tool.color}>{tool.name}</Badge>
                        </div>
                        <p className="text-xs text-gray-600">
                          {tool.description}
                        </p>
                        {isFinish && (
                          <p className="text-xs text-gray-500 mt-1">必需工具</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* 示例问题 */}
            <Card>
              <CardHeader>
                <CardTitle>示例问题</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {taskTypes[request.taskType].examples.map(
                    (example, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                        onClick={() => setExampleQuestion(example)}
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
                <CardTitle>开始ReAct推理</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <Button
                    onClick={handleSubmit}
                    disabled={isLoading || request.question.trim().length === 0}
                    className="flex-1"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    {isLoading ? '推理中...' : '开始推理'}
                  </Button>

                  {isLoading && (
                    <Button variant="outline" onClick={handleStop}>
                      停止
                    </Button>
                  )}
                </div>

                {/* 实时状态 */}
                {isLoading && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      <span className="text-blue-700 font-medium">
                        ReAct状态
                      </span>
                    </div>

                    {currentStep && (
                      <p className="text-blue-600 mb-2">{currentStep}</p>
                    )}

                    <div className="bg-white rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${(currentStepNumber / request.maxSteps) * 100}%`,
                        }}
                      ></div>
                    </div>
                    <p className="text-sm text-blue-600 mt-1">
                      步骤 {currentStepNumber} / {request.maxSteps}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 实时推理步骤 */}
            {steps.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    ReAct推理过程
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {steps.map((step, index) => (
                    <div
                      key={step.stepNumber}
                      className="border border-gray-200 rounded-lg p-4"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <Badge variant="outline">步骤 {step.stepNumber}</Badge>
                        <span className="text-xs text-gray-500">
                          {new Date(step.timestamp).toLocaleTimeString()}
                        </span>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <Brain className="h-4 w-4 text-blue-500 mt-0.5" />
                          <div className="flex-1">
                            <Label className="text-sm font-medium text-blue-700">
                              思考
                            </Label>
                            <p className="text-sm text-gray-700 mt-1">
                              {step.thought}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <ArrowRight className="h-4 w-4 text-green-500" />
                          <div className="flex-1">
                            <Label className="text-sm font-medium text-green-700">
                              行动
                            </Label>
                            <p className="text-sm text-gray-700 mt-1">
                              <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                                {step.action}({step.actionInput})
                              </span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <Eye className="h-4 w-4 text-purple-500 mt-0.5" />
                          <div className="flex-1">
                            <Label className="text-sm font-medium text-purple-700">
                              观察
                            </Label>
                            <p className="text-sm text-gray-700 mt-1 bg-purple-50 p-2 rounded">
                              {step.observation}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* 最终结果 */}
            {response && (
              <>
                {/* 统计信息 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      推理统计
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {response.totalSteps}
                      </div>
                      <div className="text-sm text-blue-700">推理步骤</div>
                    </div>

                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {response.usedTools.length}
                      </div>
                      <div className="text-sm text-green-700">使用工具</div>
                    </div>

                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">
                        {response.toolCalls.length}
                      </div>
                      <div className="text-sm text-purple-700">工具调用</div>
                    </div>

                    <div className="text-center p-3 bg-orange-50 rounded-lg">
                      <div className="text-2xl font-bold text-orange-600">
                        {(response.totalTime / 1000).toFixed(1)}s
                      </div>
                      <div className="text-sm text-orange-700">总耗时</div>
                    </div>
                  </CardContent>
                </Card>

                {/* 最终答案 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      最终答案
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="text-green-800 whitespace-pre-wrap">
                        {response.finalAnswer}
                      </div>
                    </div>

                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <h4 className="font-medium text-gray-800 mb-1">
                        推理路径
                      </h4>
                      <p className="text-sm text-gray-600">
                        {response.reasoning}
                      </p>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="text-sm text-gray-600">
                        使用的工具：
                      </span>
                      {response.usedTools.map((tool) => (
                        <Badge key={tool} variant="outline" className="text-xs">
                          {availableTools[tool as keyof typeof availableTools]
                            ?.name || tool}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </TestPageLayout>
  );
}
