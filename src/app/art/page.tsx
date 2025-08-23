'use client';

import { useState, useRef } from 'react';
import TestPageLayout from '@/components/TestPageLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Brain,
  Wrench,
  Clock,
  BookOpen,
  Target,
  Lightbulb,
  CheckCircle,
  Loader2,
  Cog,
  Search,
  Calculator,
  Code,
  Database,
  FileText,
  Play,
  Eye,
  Settings,
  ArrowRight,
  Zap,
  Activity,
  Terminal,
  BarChart3,
} from 'lucide-react';

interface ARTRequest {
  task: string;
  domain:
    | 'math'
    | 'search'
    | 'reasoning'
    | 'data-analysis'
    | 'coding'
    | 'general';
  maxSteps: number;
  availableTools: string[];
  temperature?: number;
  modelName?: string;
  stream?: boolean;
}

interface ToolCall {
  toolName: string;
  input: string;
  output: string;
  reasoning: string;
  success: boolean;
  duration: number;
}

interface ReasoningStep {
  stepIndex: number;
  action: 'reasoning' | 'tool_call' | 'synthesis' | 'final_answer';
  content: string;
  toolCall?: ToolCall;
  timestamp: number;
}

interface StreamMessage {
  type: string;
  message?: string;
  step?: ReasoningStep;
  toolCall?: ToolCall;
  result?: any;
  error?: string;
  demonstrations?: string[];
  plan?: string;
}

export default function ARTPage() {
  // State hooks
  const [request, setRequest] = useState<ARTRequest>({
    task: '',
    domain: 'math',
    maxSteps: 8,
    availableTools: ['calculator'],
    temperature: 0.7,
    modelName: 'gpt-3.5-turbo',
    stream: true,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [currentMessage, setCurrentMessage] = useState('');
  const [demonstrations, setDemonstrations] = useState<string[]>([]);
  const [plan, setPlan] = useState<string>('');
  const [steps, setSteps] = useState<ReasoningStep[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [finalResult, setFinalResult] = useState<any>(null);
  const [startTime, setStartTime] = useState<number>(0);

  // Ref hooks
  const abortControllerRef = useRef<AbortController | null>(null);

  // 领域配置
  const domains = {
    math: {
      name: '数学计算',
      description: '数学问题求解和计算',
      icon: Calculator,
      defaultTools: ['calculator'],
      example:
        '计算一个半径为5米的圆形花园面积，然后计算需要多少袋种子（每袋覆盖10平方米）',
    },
    search: {
      name: '信息搜索',
      description: '搜索和研究信息',
      icon: Search,
      defaultTools: ['search', 'text_processor'],
      example: '研究Python中列表和元组的区别，并提供代码示例',
    },
    reasoning: {
      name: '逻辑推理',
      description: '逻辑分析和推理',
      icon: Brain,
      defaultTools: ['text_processor'],
      example:
        '分析逻辑谜题：三个盒子，一个装金币，标签都贴错了，最少开几个盒子能确定？',
    },
    'data-analysis': {
      name: '数据分析',
      description: '数据处理和分析',
      icon: BarChart3,
      defaultTools: ['data_analyzer', 'calculator'],
      example:
        '分析销售数据[100, 120, 90, 150, 200]，计算趋势和预测下个月销售额',
    },
    coding: {
      name: '编程开发',
      description: '代码编写和优化',
      icon: Code,
      defaultTools: ['search', 'code_executor'],
      example: '编写函数计算斐波那契数列第n项，并测试性能',
    },
    general: {
      name: '通用任务',
      description: '综合性任务处理',
      icon: Cog,
      defaultTools: ['search', 'calculator', 'text_processor'],
      example: '制定一个月的健身计划，包括运动安排和卡路里计算',
    },
  };

  // 工具配置
  const tools = {
    calculator: {
      name: 'calculator',
      label: '计算器',
      icon: Calculator,
      description: '执行数学计算',
    },
    search: {
      name: 'search',
      label: '搜索引擎',
      icon: Search,
      description: '搜索信息和知识',
    },
    code_executor: {
      name: 'code_executor',
      label: '代码执行器',
      icon: Terminal,
      description: '执行Python代码',
    },
    data_analyzer: {
      name: 'data_analyzer',
      label: '数据分析器',
      icon: Database,
      description: '分析数据和统计',
    },
    text_processor: {
      name: 'text_processor',
      label: '文本处理器',
      icon: FileText,
      description: '处理和分析文本',
    },
  };

  // 更新请求参数
  const updateRequest = (updates: Partial<ARTRequest>) => {
    setRequest((prev) => ({ ...prev, ...updates }));
  };

  // 处理领域变化
  const handleDomainChange = (domain: string) => {
    const domainConfig = domains[domain as keyof typeof domains];
    updateRequest({
      domain: domain as ARTRequest['domain'],
      availableTools: domainConfig.defaultTools,
    });
  };

  // 处理工具选择
  const handleToolToggle = (toolName: string) => {
    const newTools = request.availableTools.includes(toolName)
      ? request.availableTools.filter((t) => t !== toolName)
      : [...request.availableTools, toolName];
    updateRequest({ availableTools: newTools });
  };

  // 填充示例
  const handleSelectExample = () => {
    const domainConfig = domains[request.domain];
    updateRequest({ task: domainConfig.example });
  };

  // 提交处理
  const handleSubmit = async () => {
    if (!request.task.trim()) {
      alert('请输入任务');
      return;
    }

    if (request.availableTools.length === 0) {
      alert('请至少选择一个工具');
      return;
    }

    setIsLoading(true);
    setCurrentMessage('准备启动ART系统...');
    setDemonstrations([]);
    setPlan('');
    setSteps([]);
    setToolCalls([]);
    setFinalResult(null);
    setStartTime(Date.now());

    // 创建取消控制器
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch('/api/art', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // 处理流式响应
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data: StreamMessage = JSON.parse(line.slice(6));

                switch (data.type) {
                  case 'start':
                    setCurrentMessage(data.message || '');
                    break;

                  case 'demonstrations_selected':
                    setDemonstrations(data.demonstrations || []);
                    setCurrentMessage(data.message || '');
                    break;

                  case 'plan_generated':
                    setPlan(data.plan || '');
                    setCurrentMessage(data.message || '');
                    break;

                  case 'step_start':
                    if (data.step) {
                      setCurrentMessage(
                        `执行步骤 ${data.step.stepIndex + 1}: ${data.step.content}`
                      );
                    }
                    break;

                  case 'tool_call_complete':
                    if (data.toolCall) {
                      setToolCalls((prev) => [...prev, data.toolCall!]);
                    }
                    break;

                  case 'step_complete':
                    if (data.step) {
                      setSteps((prev) => [...prev, data.step!]);
                    }
                    break;

                  case 'final_result':
                    setFinalResult(data.result);
                    setCurrentMessage('ART推理完成！');
                    setIsLoading(false);
                    break;

                  case 'done':
                    setIsLoading(false);
                    break;

                  case 'error':
                    throw new Error(data.error || '未知错误');
                }
              } catch (e) {
                console.warn('Failed to parse SSE data:', line);
              }
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('ART Error:', error);
        setCurrentMessage(`错误: ${error.message}`);
      }
      setIsLoading(false);
    }
  };

  // 停止处理
  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  };

  // 清空内容
  const handleClear = () => {
    setRequest((prev) => ({ ...prev, task: '' }));
    setDemonstrations([]);
    setPlan('');
    setSteps([]);
    setToolCalls([]);
    setFinalResult(null);
    setCurrentMessage('');
  };

  const isValid =
    request.task.trim().length > 0 && request.availableTools.length > 0;
  const selectedDomain = domains[request.domain];

  return (
    <TestPageLayout
      title="ART (自动推理并使用工具)"
      description="自动生成推理计划，智能调用工具，完成复杂任务的解决方案"
    >
      <div className="p-6">
        <Tabs defaultValue="test" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="theory">原理介绍</TabsTrigger>
            <TabsTrigger value="test">实践测试</TabsTrigger>
          </TabsList>

          {/* 原理介绍 */}
          <TabsContent value="theory" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="h-5 w-5 text-blue-600" />
                    什么是ART？
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-gray-600">
                    ART（Automatic Reasoning and Tool-use）是一个创新框架，
                    使用冻结的大语言模型自动生成包含中间推理步骤的程序，
                    并在适当的地方智能调用外部工具。
                  </p>
                  <div className="space-y-2">
                    <h4 className="font-medium">核心优势：</h4>
                    <ul className="text-sm space-y-1 text-gray-600">
                      <li>• 自动选择相关示范和工具</li>
                      <li>• 零样本任务分解能力</li>
                      <li>• 智能工具调用时机</li>
                      <li>• 可扩展的任务和工具库</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-green-600" />
                    工作流程
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className="mt-1">
                        1
                      </Badge>
                      <div>
                        <p className="font-medium text-sm">选择示范</p>
                        <p className="text-xs text-gray-600">
                          从任务库选择相关示范
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className="mt-1">
                        2
                      </Badge>
                      <div>
                        <p className="font-medium text-sm">生成计划</p>
                        <p className="text-xs text-gray-600">
                          自动分解任务和工具调用
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className="mt-1">
                        3
                      </Badge>
                      <div>
                        <p className="font-medium text-sm">执行推理</p>
                        <p className="text-xs text-gray-600">
                          逐步执行并调用工具
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-purple-600" />
                    智能工具调用
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Calculator className="h-4 w-4 text-blue-500" />
                      <span className="text-sm">数学计算器</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Search className="h-4 w-4 text-green-500" />
                      <span className="text-sm">信息搜索</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Terminal className="h-4 w-4 text-orange-500" />
                      <span className="text-sm">代码执行</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-purple-500" />
                      <span className="text-sm">数据分析</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-red-500" />
                      <span className="text-sm">文本处理</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-orange-600" />
                    应用场景
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-2 text-sm">
                    <div className="p-2 bg-blue-50 rounded text-blue-800">
                      数学问题求解
                    </div>
                    <div className="p-2 bg-green-50 rounded text-green-800">
                      信息研究分析
                    </div>
                    <div className="p-2 bg-purple-50 rounded text-purple-800">
                      代码开发优化
                    </div>
                    <div className="p-2 bg-orange-50 rounded text-orange-800">
                      数据处理分析
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 实践测试 */}
          <TabsContent value="test" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* 左侧：配置输入 */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      任务配置
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* 领域选择 */}
                    <div className="space-y-2">
                      <Label>任务领域</Label>
                      <Select
                        value={request.domain}
                        onValueChange={handleDomainChange}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(domains).map(([key, domain]) => {
                            const Icon = domain.icon;
                            return (
                              <SelectItem key={key} value={key}>
                                <div className="flex items-center gap-2">
                                  <Icon className="h-4 w-4" />
                                  {domain.name}
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <div className="text-sm text-gray-600">
                        {selectedDomain.description}
                      </div>
                    </div>

                    {/* 任务输入 */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label htmlFor="task">任务描述</Label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleSelectExample}
                        >
                          使用示例
                        </Button>
                      </div>
                      <Textarea
                        id="task"
                        placeholder="描述您要解决的任务..."
                        value={request.task}
                        onChange={(e) =>
                          updateRequest({ task: e.target.value })
                        }
                        rows={4}
                        className="resize-none"
                      />
                    </div>

                    {/* 工具选择 */}
                    <div className="space-y-2">
                      <Label>可用工具</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(tools).map(([key, tool]) => {
                          const Icon = tool.icon;
                          const isSelected =
                            request.availableTools.includes(key);
                          return (
                            <Button
                              key={key}
                              variant={isSelected ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => handleToolToggle(key)}
                              className="flex items-center gap-2 h-auto p-2"
                            >
                              <Icon className="h-4 w-4" />
                              <div className="text-left">
                                <div className="text-xs font-medium">
                                  {tool.label}
                                </div>
                                <div className="text-xs opacity-75">
                                  {tool.description}
                                </div>
                              </div>
                            </Button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 参数配置 */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>最大步数</Label>
                        <Input
                          type="number"
                          min={3}
                          max={15}
                          value={request.maxSteps}
                          onChange={(e) =>
                            updateRequest({
                              maxSteps: parseInt(e.target.value) || 8,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>温度</Label>
                        <Input
                          type="number"
                          min={0}
                          max={1}
                          step={0.1}
                          value={request.temperature}
                          onChange={(e) =>
                            updateRequest({
                              temperature: parseFloat(e.target.value) || 0.7,
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button
                        onClick={handleSubmit}
                        disabled={!isValid || isLoading}
                        className="flex-1"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            推理中...
                          </>
                        ) : (
                          <>
                            <Play className="mr-2 h-4 w-4" />
                            开始推理
                          </>
                        )}
                      </Button>

                      {isLoading && (
                        <Button variant="outline" onClick={handleStop}>
                          停止
                        </Button>
                      )}

                      <Button variant="outline" onClick={handleClear}>
                        清空
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 右侧：推理过程展示 */}
              <div className="space-y-6">
                {/* 状态监控 */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="flex items-center gap-2">
                      <Cog className="h-5 w-5" />
                      推理状态
                    </CardTitle>
                    {isLoading && (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Clock className="h-4 w-4" />
                        <span>
                          {Math.floor((Date.now() - startTime) / 1000)}s
                        </span>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {currentMessage && (
                        <div className="text-sm text-blue-600 p-2 bg-blue-50 rounded">
                          {currentMessage}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* 推理过程 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Eye className="h-5 w-5" />
                      推理过程
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ARTProcessVisualization
                      demonstrations={demonstrations}
                      plan={plan}
                      steps={steps}
                      toolCalls={toolCalls}
                      finalResult={finalResult}
                    />
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </TestPageLayout>
  );
}

// ART过程可视化组件
function ARTProcessVisualization({
  demonstrations,
  plan,
  steps,
  toolCalls,
  finalResult,
}: {
  demonstrations: string[];
  plan: string;
  steps: ReasoningStep[];
  toolCalls: ToolCall[];
  finalResult: any;
}) {
  if (!demonstrations.length && !plan && !steps.length && !finalResult) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400">
        <div className="text-center">
          <Wrench className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>等待开始ART推理...</p>
          <p className="text-xs mt-1">系统将自动选择示范、生成计划并执行推理</p>
        </div>
      </div>
    );
  }

  return (
    <Tabs defaultValue="process" className="space-y-4">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="process" className="text-xs">
          推理过程
        </TabsTrigger>
        <TabsTrigger value="demos" className="text-xs">
          示范选择
        </TabsTrigger>
        <TabsTrigger value="tools" className="text-xs">
          工具调用
        </TabsTrigger>
        <TabsTrigger value="result" className="text-xs">
          最终结果
        </TabsTrigger>
      </TabsList>

      <TabsContent value="process" className="space-y-4">
        {plan && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">推理计划:</h4>
            <div className="bg-gray-50 rounded p-3 text-sm">
              <pre className="whitespace-pre-wrap font-mono text-xs">
                {plan}
              </pre>
            </div>
          </div>
        )}

        {steps.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-sm">执行步骤:</h4>
            <div className="space-y-2">
              {steps.map((step, index) => (
                <div key={index} className="border rounded p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">步骤 {step.stepIndex + 1}</Badge>
                    <Badge
                      variant={
                        step.action === 'tool_call'
                          ? 'default'
                          : step.action === 'final_answer'
                            ? 'secondary'
                            : 'outline'
                      }
                    >
                      {step.action === 'tool_call'
                        ? '🔧 工具调用'
                        : step.action === 'final_answer'
                          ? '🎯 最终答案'
                          : '🧠 推理'}
                    </Badge>
                  </div>
                  <div className="text-sm">{step.content}</div>
                  {step.toolCall && (
                    <div className="bg-green-50 border border-green-200 rounded p-2">
                      <div className="text-xs font-medium text-green-800">
                        工具: {step.toolCall.toolName}
                      </div>
                      <div className="text-xs text-green-700 mt-1">
                        {step.toolCall.output}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </TabsContent>

      <TabsContent value="demos" className="space-y-4">
        {demonstrations.length > 0 ? (
          <div className="space-y-3">
            <h4 className="font-medium text-sm">选择的示范任务:</h4>
            <div className="space-y-2">
              {demonstrations.map((demo, index) => (
                <div
                  key={index}
                  className="bg-blue-50 border border-blue-200 rounded p-3"
                >
                  <div className="text-sm text-blue-800">{demo}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">
            <BookOpen className="h-6 w-6 mx-auto mb-2 opacity-50" />
            <p className="text-sm">暂无示范选择</p>
          </div>
        )}
      </TabsContent>

      <TabsContent value="tools" className="space-y-4">
        {toolCalls.length > 0 ? (
          <div className="space-y-3">
            <h4 className="font-medium text-sm">工具调用记录:</h4>
            <div className="space-y-2">
              {toolCalls.map((call, index) => (
                <div key={index} className="border rounded p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={call.success ? 'default' : 'destructive'}>
                        {call.toolName}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {call.duration}ms
                      </span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {call.success ? '✓ 成功' : '✗ 失败'}
                    </Badge>
                  </div>
                  <div className="text-sm">
                    <div className="font-medium">输入: {call.input}</div>
                    <div className="text-gray-600 mt-1">
                      输出: {call.output}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">
            <Wrench className="h-6 w-6 mx-auto mb-2 opacity-50" />
            <p className="text-sm">暂无工具调用</p>
          </div>
        )}
      </TabsContent>

      <TabsContent value="result" className="space-y-4">
        {finalResult ? (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="font-medium text-green-900 mb-2">最终答案:</h4>
              <div className="text-green-800 text-sm whitespace-pre-wrap">
                {finalResult.finalAnswer}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">推理步数: </span>
                <span>{finalResult.steps?.length || 0}</span>
              </div>
              <div>
                <span className="font-medium">工具调用: </span>
                <span>{finalResult.toolCalls?.length || 0}</span>
              </div>
              <div>
                <span className="font-medium">总耗时: </span>
                <span>{finalResult.totalTime}ms</span>
              </div>
              <div>
                <span className="font-medium">使用工具: </span>
                <span>{finalResult.usedTools?.join(', ') || '无'}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">
            <Target className="h-6 w-6 mx-auto mb-2 opacity-50" />
            <p className="text-sm">等待推理完成</p>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
