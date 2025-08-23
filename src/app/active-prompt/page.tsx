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
  Plus,
  Trash2,
  Target,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Brain,
  BarChart3,
} from 'lucide-react';

interface ActivePromptRequest {
  task: string;
  taskType: 'reasoning' | 'classification' | 'qa' | 'math' | 'general';
  initialExamples: Array<{
    input: string;
    output?: string;
    reasoning?: string;
  }>;
  testQuestions: string[];
  numGenerations: number;
  uncertaintyThreshold: number;
  temperature?: number;
  modelName?: string;
  stream?: boolean;
}

interface GenerationResult {
  questionIndex: number;
  question: string;
  generations: Array<{
    answer: string;
    reasoning: string;
    confidence: number;
  }>;
  uncertainty: number;
  consistency: number;
  needsAnnotation: boolean;
}

interface UncertaintyMeasure {
  disagreementScore: number;
  consistencyScore: number;
  confidenceVariance: number;
  overallUncertainty: number;
}

interface ActivePromptResponse {
  task: string;
  taskType: string;
  initialExamples: any[];
  results: GenerationResult[];
  uncertaintyRanking: Array<{
    questionIndex: number;
    question: string;
    uncertainty: number;
    priority: 'high' | 'medium' | 'low';
  }>;
  recommendedAnnotations: Array<{
    questionIndex: number;
    question: string;
    suggestedAnswer: string;
    reasoning: string;
  }>;
  statistics: {
    totalQuestions: number;
    highUncertaintyCount: number;
    averageUncertainty: number;
    improvementPotential: number;
  };
  totalTime: number;
}

export default function ActivePromptPage() {
  const [request, setRequest] = useState<ActivePromptRequest>({
    task: '数学推理问题求解',
    taskType: 'math',
    initialExamples: [
      {
        input: '小明有12个苹果，吃了3个，又买了5个，现在有多少个？',
        output: '14个苹果',
        reasoning:
          '小明原有12个苹果，吃了3个后剩12-3=9个，又买了5个，所以现在有9+5=14个苹果。',
      },
    ],
    testQuestions: [
      '一个班级有40个学生，其中60%是男生，女生有多少个？',
      '如果一个数的3倍加上5等于20，这个数是多少？',
      '小红用18元买了3支笔和2个本子，已知每支笔4元，每个本子多少元？',
      '一个长方形的长是8cm，宽是5cm，周长是多少？',
      '某商品原价100元，打8折后又降价10元，现在售价是多少？',
    ],
    numGenerations: 4,
    uncertaintyThreshold: 0.6,
    temperature: 0.8,
    modelName: 'gpt-3.5-turbo',
    stream: true,
  });

  const [response, setResponse] = useState<ActivePromptResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [results, setResults] = useState<GenerationResult[]>([]);
  const [processedCount, setProcessedCount] = useState(0);

  const abortControllerRef = useRef<AbortController | null>(null);

  const taskTypes = {
    reasoning: {
      name: '逻辑推理',
      description: '需要逻辑分析的复杂推理问题',
      color: 'bg-blue-100 text-blue-800',
    },
    classification: {
      name: '分类任务',
      description: '对内容进行分类和判断',
      color: 'bg-green-100 text-green-800',
    },
    qa: {
      name: '问答任务',
      description: '基于信息回答问题',
      color: 'bg-orange-100 text-orange-800',
    },
    math: {
      name: '数学问题',
      description: '数学计算和解题推理',
      color: 'bg-red-100 text-red-800',
    },
    general: {
      name: '通用任务',
      description: '其他类型的通用问题',
      color: 'bg-gray-100 text-gray-800',
    },
  };

  const priorityColors = {
    high: 'bg-red-100 text-red-800 border-red-300',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    low: 'bg-green-100 text-green-800 border-green-300',
  };

  const priorityIcons = {
    high: AlertTriangle,
    medium: TrendingUp,
    low: CheckCircle,
  };

  const handleSubmit = async () => {
    if (
      request.task.trim().length === 0 ||
      request.testQuestions.length === 0
    ) {
      return;
    }

    setIsLoading(true);
    setResponse(null);
    setCurrentStep('');
    setCurrentQuestion('');
    setResults([]);
    setProcessedCount(0);

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/active-prompt', {
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
                      `开始Active-Prompt主动学习 - ${data.totalQuestions} 个问题`
                    );
                    break;
                  case 'question_start':
                    setCurrentQuestion(data.question);
                    setCurrentStep(
                      `处理问题 ${data.questionIndex + 1}/${request.testQuestions.length}`
                    );
                    break;
                  case 'generation_complete':
                    setResults((prev) => [...prev, data.generation]);
                    setProcessedCount((prev) => prev + 1);
                    break;
                  case 'final_result':
                    setResponse(data.result);
                    setCurrentStep('Active-Prompt分析完成！');
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
        console.error('Active-Prompt Error:', error);
        setCurrentStep(`错误: ${error.message}`);
      }
      setIsLoading(false);
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
      setCurrentStep('已停止Active-Prompt分析');
    }
  };

  const addExample = () => {
    setRequest((prev) => ({
      ...prev,
      initialExamples: [
        ...prev.initialExamples,
        { input: '', output: '', reasoning: '' },
      ],
    }));
  };

  const removeExample = (index: number) => {
    setRequest((prev) => ({
      ...prev,
      initialExamples: prev.initialExamples.filter((_, i) => i !== index),
    }));
  };

  const updateExample = (index: number, field: string, value: string) => {
    setRequest((prev) => ({
      ...prev,
      initialExamples: prev.initialExamples.map((example, i) =>
        i === index ? { ...example, [field]: value } : example
      ),
    }));
  };

  const addQuestion = () => {
    setRequest((prev) => ({
      ...prev,
      testQuestions: [...prev.testQuestions, ''],
    }));
  };

  const removeQuestion = (index: number) => {
    setRequest((prev) => ({
      ...prev,
      testQuestions: prev.testQuestions.filter((_, i) => i !== index),
    }));
  };

  const updateQuestion = (index: number, value: string) => {
    setRequest((prev) => ({
      ...prev,
      testQuestions: prev.testQuestions.map((question, i) =>
        i === index ? value : question
      ),
    }));
  };

  return (
    <TestPageLayout
      title="Active-Prompt 主动提示"
      description="通过不确定度分析智能选择最需要人工标注的样本，优化CoT示例质量"
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
                  Active-Prompt 工作原理
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-gray-600">
                  <p className="mb-4">
                    <strong>Active-Prompt</strong>
                    是一种智能的提示优化方法，解决了传统CoT方法依赖固定人工注释范例的问题，通过主动学习找到最有价值的标注样本。
                  </p>

                  <div className="space-y-3">
                    <div className="border-l-4 border-blue-500 pl-4">
                      <h4 className="font-semibold text-blue-700">
                        1. 多次生成 (Multiple Generation)
                      </h4>
                      <p>对每个问题生成k个可能的答案，获得多样化的解答角度。</p>
                    </div>

                    <div className="border-l-4 border-green-500 pl-4">
                      <h4 className="font-semibold text-green-700">
                        2. 不确定度计算 (Uncertainty Estimation)
                      </h4>
                      <p>
                        基于答案的不一致性计算不确定度：分歧程度、一致性、置信度方差。
                      </p>
                    </div>

                    <div className="border-l-4 border-purple-500 pl-4">
                      <h4 className="font-semibold text-purple-700">
                        3. 主动选择 (Active Selection)
                      </h4>
                      <p>
                        优先选择不确定度最高的问题进行人工标注，最大化标注价值。
                      </p>
                    </div>

                    <div className="border-l-4 border-orange-500 pl-4">
                      <h4 className="font-semibold text-orange-700">
                        4. 示例优化 (Example Optimization)
                      </h4>
                      <p>用新标注的高质量示例替换原有示例，提升整体性能。</p>
                    </div>
                  </div>

                  <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-semibold text-blue-800 mb-2">
                      核心优势
                    </h4>
                    <ul className="text-blue-700 space-y-1">
                      <li>
                        • <strong>智能筛选</strong>：自动识别最有价值的标注样本
                      </li>
                      <li>
                        • <strong>不确定度量化</strong>：基于多维度指标科学评估
                      </li>
                      <li>
                        • <strong>成本优化</strong>：减少不必要的人工标注工作
                      </li>
                      <li>
                        • <strong>性能提升</strong>：用更少的标注获得更好的效果
                      </li>
                    </ul>
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
                    <Textarea
                      id="task"
                      placeholder="描述您要解决的任务类型..."
                      value={request.task}
                      onChange={(e) =>
                        setRequest((prev) => ({
                          ...prev,
                          task: e.target.value,
                        }))
                      }
                      className="min-h-[80px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="taskType">任务类型</Label>
                    <Select
                      value={request.taskType}
                      onValueChange={(value: ActivePromptRequest['taskType']) =>
                        setRequest((prev) => ({ ...prev, taskType: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(taskTypes).map(([key, type]) => (
                          <SelectItem key={key} value={key}>
                            <div className="flex items-center gap-2">
                              <Badge className={type.color}>{type.name}</Badge>
                              <span className="text-sm text-gray-600">
                                {type.description}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="numGenerations">生成次数 (k)</Label>
                    <Input
                      id="numGenerations"
                      type="number"
                      min="2"
                      max="10"
                      value={request.numGenerations}
                      onChange={(e) =>
                        setRequest((prev) => ({
                          ...prev,
                          numGenerations: parseInt(e.target.value) || 4,
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="uncertaintyThreshold">不确定度阈值</Label>
                    <Input
                      id="uncertaintyThreshold"
                      type="number"
                      min="0"
                      max="1"
                      step="0.1"
                      value={request.uncertaintyThreshold}
                      onChange={(e) =>
                        setRequest((prev) => ({
                          ...prev,
                          uncertaintyThreshold:
                            parseFloat(e.target.value) || 0.6,
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
                          temperature: parseFloat(e.target.value) || 0.8,
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

            {/* 初始示例 */}
            <Card>
              <CardHeader>
                <CardTitle>初始CoT示例</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {request.initialExamples.map((example, index) => (
                  <div
                    key={index}
                    className="border border-gray-200 rounded-lg p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">示例 {index + 1}</h4>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeExample(index)}
                        disabled={request.initialExamples.length <= 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label>问题输入</Label>
                        <Textarea
                          placeholder="输入问题..."
                          value={example.input}
                          onChange={(e) =>
                            updateExample(index, 'input', e.target.value)
                          }
                          className="min-h-[60px]"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>标准答案（可选）</Label>
                        <Input
                          placeholder="标准答案..."
                          value={example.output || ''}
                          onChange={(e) =>
                            updateExample(index, 'output', e.target.value)
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>推理过程（可选）</Label>
                        <Textarea
                          placeholder="详细推理步骤..."
                          value={example.reasoning || ''}
                          onChange={(e) =>
                            updateExample(index, 'reasoning', e.target.value)
                          }
                          className="min-h-[60px]"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <Button
                  variant="outline"
                  onClick={addExample}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  添加示例
                </Button>
              </CardContent>
            </Card>

            {/* 测试问题 */}
            <Card>
              <CardHeader>
                <CardTitle>测试问题集</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {request.testQuestions.map((question, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="flex-1">
                      <Input
                        placeholder={`测试问题 ${index + 1}...`}
                        value={question}
                        onChange={(e) => updateQuestion(index, e.target.value)}
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeQuestion(index)}
                      disabled={request.testQuestions.length <= 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                <Button
                  variant="outline"
                  onClick={addQuestion}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  添加测试问题
                </Button>
              </CardContent>
            </Card>

            {/* 执行控制 */}
            <Card>
              <CardHeader>
                <CardTitle>开始Active-Prompt分析</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <Button
                    onClick={handleSubmit}
                    disabled={
                      isLoading ||
                      request.task.trim().length === 0 ||
                      request.testQuestions.length === 0
                    }
                    className="flex-1"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    {isLoading ? '分析中...' : '开始分析'}
                  </Button>

                  {isLoading && (
                    <Button variant="outline" onClick={handleStop}>
                      停止
                    </Button>
                  )}
                </div>

                {/* 实时进度 */}
                {isLoading && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      <span className="text-blue-700 font-medium">
                        Active-Prompt状态
                      </span>
                    </div>

                    {currentStep && (
                      <p className="text-blue-600 mb-1">{currentStep}</p>
                    )}

                    {currentQuestion && (
                      <p className="text-blue-500 text-sm bg-white p-2 rounded border">
                        当前问题: {currentQuestion}
                      </p>
                    )}

                    <div className="mt-2 bg-white rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${(processedCount / request.testQuestions.length) * 100}%`,
                        }}
                      ></div>
                    </div>
                    <p className="text-sm text-blue-600 mt-1">
                      {processedCount} / {request.testQuestions.length}{' '}
                      问题已处理
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 实时结果 */}
            {results.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    实时分析结果 ({results.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {results.slice(-3).map((result, index) => (
                    <div
                      key={result.questionIndex}
                      className="border border-gray-200 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">
                          问题 {result.questionIndex + 1}
                        </span>
                        <div className="flex items-center gap-2">
                          <Badge
                            className={
                              result.needsAnnotation
                                ? 'bg-red-100 text-red-800'
                                : 'bg-green-100 text-green-800'
                            }
                          >
                            {result.needsAnnotation ? '需要标注' : '质量良好'}
                          </Badge>
                          <Badge variant="outline">
                            不确定度: {(result.uncertainty * 100).toFixed(1)}%
                          </Badge>
                        </div>
                      </div>

                      <p className="text-sm text-gray-600 mb-2">
                        {result.question}
                      </p>

                      <div className="text-xs text-gray-500">
                        一致性: {(result.consistency * 100).toFixed(1)}% |
                        生成次数: {result.generations.length} | 平均置信度:{' '}
                        {(
                          (result.generations.reduce(
                            (sum, g) => sum + g.confidence,
                            0
                          ) /
                            result.generations.length) *
                          100
                        ).toFixed(1)}
                        %
                      </div>
                    </div>
                  ))}

                  {results.length > 3 && (
                    <p className="text-center text-sm text-gray-500">
                      ... 更多结果请查看最终分析报告
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 最终结果 */}
            {response && (
              <>
                {/* 统计概览 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      分析统计
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {response.statistics.totalQuestions}
                      </div>
                      <div className="text-sm text-blue-700">总问题数</div>
                    </div>

                    <div className="text-center p-3 bg-red-50 rounded-lg">
                      <div className="text-2xl font-bold text-red-600">
                        {response.statistics.highUncertaintyCount}
                      </div>
                      <div className="text-sm text-red-700">高不确定度</div>
                    </div>

                    <div className="text-center p-3 bg-yellow-50 rounded-lg">
                      <div className="text-2xl font-bold text-yellow-600">
                        {(response.statistics.averageUncertainty * 100).toFixed(
                          1
                        )}
                        %
                      </div>
                      <div className="text-sm text-yellow-700">
                        平均不确定度
                      </div>
                    </div>

                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {(
                          response.statistics.improvementPotential * 100
                        ).toFixed(1)}
                        %
                      </div>
                      <div className="text-sm text-green-700">改进潜力</div>
                    </div>
                  </CardContent>
                </Card>

                {/* 不确定度排名 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      不确定度排名
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {response.uncertaintyRanking
                      .slice(0, 10)
                      .map((item, index) => {
                        const PriorityIcon = priorityIcons[item.priority];
                        return (
                          <div
                            key={item.questionIndex}
                            className="flex items-center gap-3 p-3 border rounded-lg"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-bold text-gray-500">
                                #{index + 1}
                              </span>
                              <PriorityIcon className="h-4 w-4" />
                            </div>

                            <div className="flex-1">
                              <p className="font-medium">{item.question}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge
                                  className={priorityColors[item.priority]}
                                >
                                  {item.priority === 'high'
                                    ? '高优先级'
                                    : item.priority === 'medium'
                                      ? '中优先级'
                                      : '低优先级'}
                                </Badge>
                                <span className="text-sm text-gray-500">
                                  不确定度:{' '}
                                  {(item.uncertainty * 100).toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </CardContent>
                </Card>

                {/* 标注推荐 */}
                {response.recommendedAnnotations.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-orange-600" />
                        推荐标注样本
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {response.recommendedAnnotations.map(
                        (annotation, index) => (
                          <div
                            key={annotation.questionIndex}
                            className="border border-orange-200 rounded-lg p-4 bg-orange-50"
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className="bg-orange-100 text-orange-800">
                                优先级 {index + 1}
                              </Badge>
                              <span className="font-medium">
                                问题 {annotation.questionIndex + 1}
                              </span>
                            </div>

                            <div className="space-y-3">
                              <div>
                                <Label className="text-sm font-medium text-orange-800">
                                  问题
                                </Label>
                                <p className="text-sm text-orange-700 bg-white p-2 rounded border">
                                  {annotation.question}
                                </p>
                              </div>

                              <div>
                                <Label className="text-sm font-medium text-orange-800">
                                  建议答案
                                </Label>
                                <p className="text-sm text-orange-700 bg-white p-2 rounded border">
                                  {annotation.suggestedAnswer}
                                </p>
                              </div>

                              <div>
                                <Label className="text-sm font-medium text-orange-800">
                                  建议推理
                                </Label>
                                <p className="text-sm text-orange-700 bg-white p-2 rounded border">
                                  {annotation.reasoning}
                                </p>
                              </div>
                            </div>
                          </div>
                        )
                      )}

                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-700">
                          💡 <strong>建议</strong>
                          ：优先对上述样本进行人工标注，然后用新的高质量示例替换初始CoT示例，可以显著提升模型在此类任务上的表现。
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </TestPageLayout>
  );
}
