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
  RotateCcw,
  Zap,
  Target,
  TrendingUp,
  Brain,
  Settings,
  ChevronRight,
} from 'lucide-react';

interface DSPRequest {
  task: string;
  taskType: 'summarization' | 'translation' | 'qa' | 'generation' | 'analysis';
  input: string;
  targetObjective: string;
  stimulusType: 'keyword' | 'instruction' | 'example' | 'constraint' | 'style';
  optimizationRounds: number;
  policyModelName?: string;
  mainModelName?: string;
  temperature?: number;
  stream?: boolean;
}

interface StimulusGeneration {
  round: number;
  stimulus: string;
  stimulusType: string;
  reasoning: string;
  confidence: number;
}

interface DSPExecution {
  round: number;
  stimulus: string;
  output: string;
  quality: number;
  improvement: string;
  executionTime: number;
}

interface PolicyOptimization {
  round: number;
  previousQuality: number;
  currentQuality: number;
  improvement: number;
  strategy: string;
  nextDirection: string;
}

interface DSPResponse {
  task: string;
  taskType: string;
  input: string;
  targetObjective: string;
  stimulusGenerations: StimulusGeneration[];
  executions: DSPExecution[];
  optimizations: PolicyOptimization[];
  bestStimulus: {
    stimulus: string;
    output: string;
    quality: number;
    round: number;
  };
  finalResult: string;
  totalTime: number;
  improvementRate: number;
}

export default function DSPPage() {
  const [request, setRequest] = useState<DSPRequest>({
    task: '文本摘要生成',
    taskType: 'summarization',
    input: `人工智能（AI）是计算机科学的一个分支，旨在创建能够执行通常需要人类智能的任务的系统。AI技术包括机器学习、深度学习、自然语言处理、计算机视觉等多个领域。

近年来，AI技术发展迅速，在医疗诊断、自动驾驶、语音识别、图像识别等领域取得了重大突破。大型语言模型如GPT系列的出现，更是推动了AI在自然语言理解和生成方面的进步。

然而，AI发展也面临着一些挑战，包括算法偏见、隐私保护、就业影响、伦理道德等问题。如何在推动AI技术进步的同时，确保其安全、公平、可控的发展，是当前AI领域的重要议题。

未来，AI技术有望在更多领域发挥重要作用，为人类社会带来更大的价值和便利。`,
    targetObjective:
      '生成一个简洁准确的摘要，突出AI的定义、发展现状、挑战和未来前景',
    stimulusType: 'keyword',
    optimizationRounds: 3,
    policyModelName: 'gpt-3.5-turbo',
    mainModelName: 'gpt-4',
    temperature: 0.7,
    stream: true,
  });

  const [response, setResponse] = useState<DSPResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState('');
  const [currentRound, setCurrentRound] = useState(0);
  const [stimulusGenerations, setStimulusGenerations] = useState<
    StimulusGeneration[]
  >([]);
  const [executions, setExecutions] = useState<DSPExecution[]>([]);
  const [optimizations, setOptimizations] = useState<PolicyOptimization[]>([]);

  const abortControllerRef = useRef<AbortController | null>(null);

  const taskTypes = {
    summarization: {
      name: '文本摘要',
      description: '生成简洁准确的文本摘要',
      color: 'bg-blue-100 text-blue-800',
      example: '新闻文章、学术论文、长文档的摘要',
    },
    translation: {
      name: '文本翻译',
      description: '进行高质量的语言翻译',
      color: 'bg-green-100 text-green-800',
      example: '中英文互译、多语言翻译',
    },
    qa: {
      name: '问答任务',
      description: '回答问题并提供详细解释',
      color: 'bg-orange-100 text-orange-800',
      example: '知识问答、阅读理解、专业咨询',
    },
    generation: {
      name: '内容生成',
      description: '创造性内容生成',
      color: 'bg-purple-100 text-purple-800',
      example: '文章写作、创意故事、营销文案',
    },
    analysis: {
      name: '文本分析',
      description: '深入分析文本内容',
      color: 'bg-red-100 text-red-800',
      example: '情感分析、主题提取、观点挖掘',
    },
  };

  const stimulusTypes = {
    keyword: {
      name: '关键词刺激',
      description: '生成关键概念和要点提示',
      color: 'bg-blue-100 text-blue-700',
      icon: Target,
    },
    instruction: {
      name: '指令刺激',
      description: '生成具体的执行指令',
      color: 'bg-green-100 text-green-700',
      icon: Settings,
    },
    example: {
      name: '示例刺激',
      description: '生成相关示例和类比',
      color: 'bg-yellow-100 text-yellow-700',
      icon: Brain,
    },
    constraint: {
      name: '约束刺激',
      description: '生成限制条件和要求',
      color: 'bg-red-100 text-red-700',
      icon: Zap,
    },
    style: {
      name: '风格刺激',
      description: '生成风格和语调指导',
      color: 'bg-purple-100 text-purple-700',
      icon: TrendingUp,
    },
  };

  const handleSubmit = async () => {
    if (request.task.trim().length === 0 || request.input.trim().length === 0) {
      return;
    }

    setIsLoading(true);
    setResponse(null);
    setCurrentStep('');
    setCurrentRound(0);
    setStimulusGenerations([]);
    setExecutions([]);
    setOptimizations([]);

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/dsp', {
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
                      `开始DSP优化 - ${data.optimizationRounds} 轮迭代`
                    );
                    break;
                  case 'stimulus_generated':
                    setCurrentRound(data.round);
                    setCurrentStep(`第 ${data.round} 轮：策略模型生成刺激`);
                    setStimulusGenerations((prev) => [...prev, data.stimulus]);
                    break;
                  case 'execution_complete':
                    setCurrentStep(
                      `第 ${data.execution.round} 轮：主模型执行完成`
                    );
                    setExecutions((prev) => [...prev, data.execution]);
                    break;
                  case 'optimization_complete':
                    setCurrentStep(
                      `第 ${data.optimization.round} 轮：策略优化完成`
                    );
                    setOptimizations((prev) => [...prev, data.optimization]);
                    break;
                  case 'final_result':
                    setResponse(data.result);
                    setCurrentStep('DSP优化完成！');
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
        console.error('DSP Error:', error);
        setCurrentStep(`错误: ${error.message}`);
      }
      setIsLoading(false);
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
      setCurrentStep('已停止DSP优化');
    }
  };

  const resetForm = () => {
    setResponse(null);
    setStimulusGenerations([]);
    setExecutions([]);
    setOptimizations([]);
    setCurrentStep('');
    setCurrentRound(0);
  };

  return (
    <TestPageLayout
      title="DSP 方向性刺激提示"
      description="通过策略模型生成方向性刺激，指导主模型产生更高质量的输出"
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
                  DSP 工作原理
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-gray-600">
                  <p className="mb-4">
                    <strong>方向性刺激提示（DSP）</strong>
                    是Li等人（2023）提出的一种新颖的提示技术，通过训练小型策略模型来生成方向性刺激，指导大型LLM产生更高质量的输出。
                  </p>

                  <div className="space-y-3">
                    <div className="border-l-4 border-blue-500 pl-4">
                      <h4 className="font-semibold text-blue-700">
                        1. 策略模型 (Policy LM)
                      </h4>
                      <p>
                        小型可训练模型，专门负责生成针对性的方向性刺激提示。
                      </p>
                    </div>

                    <div className="border-l-4 border-green-500 pl-4">
                      <h4 className="font-semibold text-green-700">
                        2. 主执行模型 (Main LM)
                      </h4>
                      <p>大型冻结模型，接收刺激指导后执行具体任务。</p>
                    </div>

                    <div className="border-l-4 border-purple-500 pl-4">
                      <h4 className="font-semibold text-purple-700">
                        3. 强化学习优化
                      </h4>
                      <p>通过多轮迭代优化策略模型的刺激生成能力。</p>
                    </div>

                    <div className="border-l-4 border-orange-500 pl-4">
                      <h4 className="font-semibold text-orange-700">
                        4. 方向性刺激
                      </h4>
                      <p>
                        关键词、指令、示例、约束、风格等不同类型的指导信息。
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-semibold text-blue-800 mb-2">
                      核心优势
                    </h4>
                    <ul className="text-blue-700 space-y-1">
                      <li>
                        • <strong>成本效率</strong>：小型策略模型训练成本低
                      </li>
                      <li>
                        • <strong>灵活适配</strong>：针对不同任务生成专门刺激
                      </li>
                      <li>
                        • <strong>质量提升</strong>：显著改善主模型输出质量
                      </li>
                      <li>
                        • <strong>迭代优化</strong>：通过反馈持续改进
                      </li>
                    </ul>
                  </div>

                  <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <h4 className="font-semibold text-yellow-800 mb-2">
                      与传统提示的区别
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-yellow-700">
                      <div>
                        <strong>传统提示：</strong>
                        <ul className="list-disc list-inside space-y-1">
                          <li>静态固定提示</li>
                          <li>人工设计</li>
                          <li>一次性使用</li>
                        </ul>
                      </div>
                      <div>
                        <strong>DSP：</strong>
                        <ul className="list-disc list-inside space-y-1">
                          <li>动态生成刺激</li>
                          <li>模型自动优化</li>
                          <li>迭代改进</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="test" className="space-y-6">
            {/* 任务配置 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  任务配置
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="task">任务描述</Label>
                    <Input
                      id="task"
                      placeholder="描述具体的任务..."
                      value={request.task}
                      onChange={(e) =>
                        setRequest((prev) => ({
                          ...prev,
                          task: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="taskType">任务类型</Label>
                    <Select
                      value={request.taskType}
                      onValueChange={(value: DSPRequest['taskType']) =>
                        setRequest((prev) => ({ ...prev, taskType: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(taskTypes).map(([key, type]) => (
                          <SelectItem key={key} value={key}>
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <Badge className={type.color}>
                                  {type.name}
                                </Badge>
                              </div>
                              <span className="text-xs text-gray-500">
                                {type.example}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="input">输入内容</Label>
                  <Textarea
                    id="input"
                    placeholder="输入要处理的内容..."
                    value={request.input}
                    onChange={(e) =>
                      setRequest((prev) => ({ ...prev, input: e.target.value }))
                    }
                    className="min-h-[120px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="targetObjective">目标要求</Label>
                  <Textarea
                    id="targetObjective"
                    placeholder="描述期望的输出目标和质量要求..."
                    value={request.targetObjective}
                    onChange={(e) =>
                      setRequest((prev) => ({
                        ...prev,
                        targetObjective: e.target.value,
                      }))
                    }
                    className="min-h-[80px]"
                  />
                </div>
              </CardContent>
            </Card>

            {/* DSP参数配置 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  DSP参数配置
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="stimulusType">刺激类型</Label>
                  <Select
                    value={request.stimulusType}
                    onValueChange={(value: DSPRequest['stimulusType']) =>
                      setRequest((prev) => ({ ...prev, stimulusType: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(stimulusTypes).map(([key, type]) => {
                        const IconComponent = type.icon;
                        return (
                          <SelectItem key={key} value={key}>
                            <div className="flex items-center gap-2">
                              <IconComponent className="h-4 w-4" />
                              <Badge className={type.color}>{type.name}</Badge>
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

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="optimizationRounds">优化轮次</Label>
                    <Input
                      id="optimizationRounds"
                      type="number"
                      min="1"
                      max="10"
                      value={request.optimizationRounds}
                      onChange={(e) =>
                        setRequest((prev) => ({
                          ...prev,
                          optimizationRounds: parseInt(e.target.value) || 3,
                        }))
                      }
                    />
                  </div>

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
                    <Label htmlFor="policyModel">策略模型</Label>
                    <Select
                      value={request.policyModelName}
                      onValueChange={(value) =>
                        setRequest((prev) => ({
                          ...prev,
                          policyModelName: value,
                        }))
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

                  <div className="space-y-2">
                    <Label htmlFor="mainModel">主执行模型</Label>
                    <Select
                      value={request.mainModelName}
                      onValueChange={(value) =>
                        setRequest((prev) => ({
                          ...prev,
                          mainModelName: value,
                        }))
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

            {/* 执行控制 */}
            <Card>
              <CardHeader>
                <CardTitle>开始DSP优化</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <Button
                    onClick={handleSubmit}
                    disabled={
                      isLoading ||
                      request.task.trim().length === 0 ||
                      request.input.trim().length === 0
                    }
                    className="flex-1"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    {isLoading ? '优化中...' : '开始优化'}
                  </Button>

                  {isLoading && (
                    <Button variant="outline" onClick={handleStop}>
                      停止
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    onClick={resetForm}
                    disabled={isLoading}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    重置
                  </Button>
                </div>

                {/* 实时进度 */}
                {isLoading && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      <span className="text-blue-700 font-medium">DSP状态</span>
                    </div>

                    {currentStep && (
                      <p className="text-blue-600 mb-2">{currentStep}</p>
                    )}

                    <div className="bg-white rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${(currentRound / request.optimizationRounds) * 100}%`,
                        }}
                      ></div>
                    </div>
                    <p className="text-sm text-blue-600 mt-1">
                      {currentRound} / {request.optimizationRounds} 轮优化
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 实时结果展示 */}
            {stimulusGenerations.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    实时优化过程
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {stimulusGenerations.map((stimulus, index) => {
                    const execution = executions[index];
                    const optimization = optimizations[index];

                    return (
                      <div
                        key={stimulus.round}
                        className="border border-gray-200 rounded-lg p-4"
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <Badge variant="outline">
                            第 {stimulus.round} 轮
                          </Badge>
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                          <Badge
                            className={
                              stimulusTypes[
                                stimulus.stimulusType as keyof typeof stimulusTypes
                              ].color
                            }
                          >
                            {
                              stimulusTypes[
                                stimulus.stimulusType as keyof typeof stimulusTypes
                              ].name
                            }
                          </Badge>
                          {execution && (
                            <>
                              <ChevronRight className="h-4 w-4 text-gray-400" />
                              <Badge className="bg-green-100 text-green-800">
                                质量: {(execution.quality * 100).toFixed(1)}%
                              </Badge>
                            </>
                          )}
                        </div>

                        <div className="space-y-3">
                          <div>
                            <Label className="text-sm font-medium text-gray-700">
                              策略刺激
                            </Label>
                            <p className="text-sm text-gray-600 bg-blue-50 p-2 rounded border mt-1">
                              {stimulus.stimulus}
                            </p>
                          </div>

                          {execution && (
                            <div>
                              <Label className="text-sm font-medium text-gray-700">
                                执行输出
                              </Label>
                              <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded border mt-1">
                                {execution.output.length > 200
                                  ? execution.output.substring(0, 200) + '...'
                                  : execution.output}
                              </p>
                            </div>
                          )}

                          {optimization && (
                            <div className="text-xs text-gray-500 bg-yellow-50 p-2 rounded border">
                              <strong>优化策略:</strong> {optimization.strategy}
                              <br />
                              <strong>下轮方向:</strong>{' '}
                              {optimization.nextDirection}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* 最终结果 */}
            {response && (
              <>
                {/* 优化统计 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      优化统计
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {response.optimizations.length + 1}
                      </div>
                      <div className="text-sm text-blue-700">优化轮次</div>
                    </div>

                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {(response.bestStimulus.quality * 100).toFixed(1)}%
                      </div>
                      <div className="text-sm text-green-700">最佳质量</div>
                    </div>

                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">
                        {response.improvementRate > 0 ? '+' : ''}
                        {response.improvementRate.toFixed(1)}%
                      </div>
                      <div className="text-sm text-purple-700">改进幅度</div>
                    </div>

                    <div className="text-center p-3 bg-orange-50 rounded-lg">
                      <div className="text-2xl font-bold text-orange-600">
                        {(response.totalTime / 1000).toFixed(1)}s
                      </div>
                      <div className="text-sm text-orange-700">总耗时</div>
                    </div>
                  </CardContent>
                </Card>

                {/* 最佳结果 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-green-600" />
                      最佳结果
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="bg-green-100 text-green-800">
                          第 {response.bestStimulus.round} 轮
                        </Badge>
                        <Badge variant="outline">
                          质量:{' '}
                          {(response.bestStimulus.quality * 100).toFixed(1)}%
                        </Badge>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <Label className="text-sm font-medium text-green-800">
                            最佳刺激
                          </Label>
                          <p className="text-sm text-green-700 bg-white p-3 rounded border mt-1">
                            {response.bestStimulus.stimulus}
                          </p>
                        </div>

                        <div>
                          <Label className="text-sm font-medium text-green-800">
                            最终输出
                          </Label>
                          <div className="text-sm text-green-700 bg-white p-3 rounded border mt-1 whitespace-pre-wrap">
                            {response.bestStimulus.output}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 优化历程 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="h-5 w-5" />
                      优化历程
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {response.executions.map((execution, index) => (
                        <div
                          key={execution.round}
                          className="flex items-center gap-3 p-3 border rounded-lg"
                        >
                          <div className="text-center">
                            <div className="w-8 h-8 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-sm font-bold">
                              {execution.round}
                            </div>
                          </div>

                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium">
                                质量评分
                              </span>
                              <Badge variant="outline">
                                {(execution.quality * 100).toFixed(1)}%
                              </Badge>
                              {index > 0 && (
                                <Badge
                                  className={
                                    execution.quality >
                                    response.executions[index - 1].quality
                                      ? 'bg-green-100 text-green-800'
                                      : execution.quality <
                                          response.executions[index - 1].quality
                                        ? 'bg-red-100 text-red-800'
                                        : 'bg-gray-100 text-gray-800'
                                  }
                                >
                                  {execution.quality >
                                  response.executions[index - 1].quality
                                    ? '↗ 提升'
                                    : execution.quality <
                                        response.executions[index - 1].quality
                                      ? '↘ 下降'
                                      : '→ 持平'}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-gray-500">
                              {execution.improvement}
                            </p>
                          </div>

                          <div className="text-right">
                            <div className="text-xs text-gray-500">
                              {execution.executionTime}ms
                            </div>
                          </div>
                        </div>
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
