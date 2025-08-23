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
  Lightbulb,
  Target,
  BarChart3,
  Crown,
} from 'lucide-react';

interface APERequest {
  task: string;
  taskType:
    | 'reasoning'
    | 'classification'
    | 'generation'
    | 'qa'
    | 'math'
    | 'general';
  examples: Array<{
    input: string;
    expectedOutput: string;
    reasoning?: string;
  }>;
  evaluationCriteria: string[];
  numCandidates: number;
  temperature?: number;
  modelName?: string;
  stream?: boolean;
}

interface CandidateInstruction {
  id: string;
  instruction: string;
  description: string;
  generationReasoning: string;
}

interface EvaluationResult {
  candidateId: string;
  instruction: string;
  results: Array<{
    exampleIndex: number;
    input: string;
    expectedOutput: string;
    actualOutput: string;
    score: number;
    reasoning: string;
  }>;
  overallScore: number;
  averageScore: number;
  successRate: number;
}

interface APEResponse {
  task: string;
  taskType: string;
  candidates: CandidateInstruction[];
  evaluations: EvaluationResult[];
  bestInstruction: {
    instruction: string;
    score: number;
    reasoning: string;
  };
  totalTime: number;
  improvement: string;
}

export default function APEPage() {
  const [request, setRequest] = useState<APERequest>({
    task: '解决数学推理问题，要求详细的步骤和验证',
    taskType: 'math',
    examples: [
      {
        input: '小明有24个苹果，给了小红1/3，又买了8个，最后有多少个？',
        expectedOutput:
          '小明给了小红8个苹果（24×1/3=8），剩下16个，又买了8个，最后有24个苹果。',
        reasoning: '需要分步计算：先计算给出的数量，再计算剩余，最后加上新买的',
      },
      {
        input: '一个圆的半径是5cm，面积是多少？',
        expectedOutput: '圆的面积 = π × r² = π × 5² = 25π ≈ 78.54 平方厘米',
        reasoning: '使用圆面积公式，需要显示计算过程和近似值',
      },
    ],
    evaluationCriteria: ['答案准确性', '步骤清晰度', '计算过程', '结果验证'],
    numCandidates: 3,
    temperature: 0.8,
    modelName: 'gpt-3.5-turbo',
    stream: true,
  });

  const [response, setResponse] = useState<APEResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState('');
  const [candidates, setCandidates] = useState<CandidateInstruction[]>([]);
  const [evaluations, setEvaluations] = useState<EvaluationResult[]>([]);
  const [currentEvaluation, setCurrentEvaluation] = useState<string>('');

  const abortControllerRef = useRef<AbortController | null>(null);

  const taskTypes = {
    reasoning: {
      name: '逻辑推理',
      description: '需要逐步分析和推理的复杂问题',
      color: 'bg-blue-100 text-blue-800',
    },
    classification: {
      name: '分类任务',
      description: '对内容进行分类和标注',
      color: 'bg-green-100 text-green-800',
    },
    generation: {
      name: '内容生成',
      description: '创造性的内容生成任务',
      color: 'bg-purple-100 text-purple-800',
    },
    qa: {
      name: '问答任务',
      description: '基于信息回答问题',
      color: 'bg-orange-100 text-orange-800',
    },
    math: {
      name: '数学问题',
      description: '需要数学计算和推理的问题',
      color: 'bg-red-100 text-red-800',
    },
    general: {
      name: '通用任务',
      description: '其他类型的通用任务',
      color: 'bg-gray-100 text-gray-800',
    },
  };

  const handleSubmit = async () => {
    if (request.task.trim().length === 0 || request.examples.length === 0) {
      return;
    }

    setIsLoading(true);
    setResponse(null);
    setCurrentStep('');
    setCandidates([]);
    setEvaluations([]);
    setCurrentEvaluation('');

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/ape', {
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
                    setCurrentStep(`开始APE优化 - ${data.taskType} 任务`);
                    break;
                  case 'candidates_generated':
                    setCurrentStep(
                      `生成了 ${data.candidates.length} 个候选指令`
                    );
                    setCandidates(data.candidates);
                    break;
                  case 'evaluation_start':
                    setCurrentEvaluation(
                      `评估候选指令: ${data.instruction.substring(0, 50)}...`
                    );
                    break;
                  case 'evaluation_complete':
                    setEvaluations((prev) => [...prev, data.evaluation]);
                    setCurrentEvaluation('');
                    break;
                  case 'final_result':
                    setResponse(data.result);
                    setCurrentStep('APE优化完成！');
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
        console.error('APE Error:', error);
        setCurrentStep(`错误: ${error.message}`);
      }
      setIsLoading(false);
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
      setCurrentStep('已停止APE优化');
    }
  };

  const addExample = () => {
    setRequest((prev) => ({
      ...prev,
      examples: [
        ...prev.examples,
        { input: '', expectedOutput: '', reasoning: '' },
      ],
    }));
  };

  const removeExample = (index: number) => {
    setRequest((prev) => ({
      ...prev,
      examples: prev.examples.filter((_, i) => i !== index),
    }));
  };

  const updateExample = (index: number, field: string, value: string) => {
    setRequest((prev) => ({
      ...prev,
      examples: prev.examples.map((example, i) =>
        i === index ? { ...example, [field]: value } : example
      ),
    }));
  };

  const addCriterion = () => {
    setRequest((prev) => ({
      ...prev,
      evaluationCriteria: [...prev.evaluationCriteria, ''],
    }));
  };

  const removeCriterion = (index: number) => {
    setRequest((prev) => ({
      ...prev,
      evaluationCriteria: prev.evaluationCriteria.filter((_, i) => i !== index),
    }));
  };

  const updateCriterion = (index: number, value: string) => {
    setRequest((prev) => ({
      ...prev,
      evaluationCriteria: prev.evaluationCriteria.map((criterion, i) =>
        i === index ? value : criterion
      ),
    }));
  };

  return (
    <TestPageLayout
      title="自动提示工程师 (APE)"
      description="自动生成和优化AI指令，通过多候选生成和评估选择最佳提示词"
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
                  <Lightbulb className="h-5 w-5" />
                  APE 工作原理
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-gray-600">
                  <p className="mb-4">
                    <strong>自动提示工程师（APE）</strong>
                    是一个用于自动指令生成和选择的框架，能够自动优化AI提示词以获得更好的性能。
                  </p>

                  <div className="space-y-3">
                    <div className="border-l-4 border-blue-500 pl-4">
                      <h4 className="font-semibold text-blue-700">
                        1. 候选指令生成
                      </h4>
                      <p>
                        基于任务描述和示例，LLM生成多个候选指令，每个指令都针对特定任务类型进行优化。
                      </p>
                    </div>

                    <div className="border-l-4 border-green-500 pl-4">
                      <h4 className="font-semibold text-green-700">
                        2. 性能评估
                      </h4>
                      <p>
                        使用测试样本评估每个候选指令的性能，计算准确率、成功率等指标。
                      </p>
                    </div>

                    <div className="border-l-4 border-purple-500 pl-4">
                      <h4 className="font-semibold text-purple-700">
                        3. 最优选择
                      </h4>
                      <p>
                        基于评估结果选择性能最佳的指令，并分析相比基准指令的改进程度。
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <h4 className="font-semibold text-yellow-800 mb-2">
                      APE 经典发现
                    </h4>
                    <p className="text-yellow-700">
                      APE发现了比人工设计的"让我们一步一步地思考"更好的CoT提示：
                      <br />
                      <span className="font-mono bg-white px-2 py-1 rounded mt-2 inline-block">
                        "让我们一步一步地解决这个问题，以确保我们有正确的答案。"
                      </span>
                    </p>
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
                      placeholder="描述您希望AI完成的任务..."
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
                      onValueChange={(value: APERequest['taskType']) =>
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="numCandidates">候选数量</Label>
                    <Input
                      id="numCandidates"
                      type="number"
                      min="1"
                      max="5"
                      value={request.numCandidates}
                      onChange={(e) =>
                        setRequest((prev) => ({
                          ...prev,
                          numCandidates: parseInt(e.target.value) || 3,
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="temperature">创造性 (Temperature)</Label>
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

            {/* 示例数据 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  训练示例
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {request.examples.map((example, index) => (
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
                        disabled={request.examples.length <= 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>输入</Label>
                        <Textarea
                          placeholder="输入内容..."
                          value={example.input}
                          onChange={(e) =>
                            updateExample(index, 'input', e.target.value)
                          }
                          className="min-h-[60px]"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>期望输出</Label>
                        <Textarea
                          placeholder="期望的输出..."
                          value={example.expectedOutput}
                          onChange={(e) =>
                            updateExample(
                              index,
                              'expectedOutput',
                              e.target.value
                            )
                          }
                          className="min-h-[60px]"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>推理说明（可选）</Label>
                      <Input
                        placeholder="说明推理过程..."
                        value={example.reasoning || ''}
                        onChange={(e) =>
                          updateExample(index, 'reasoning', e.target.value)
                        }
                      />
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

            {/* 评估标准 */}
            <Card>
              <CardHeader>
                <CardTitle>评估标准</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {request.evaluationCriteria.map((criterion, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      placeholder="评估标准..."
                      value={criterion}
                      onChange={(e) => updateCriterion(index, e.target.value)}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeCriterion(index)}
                      disabled={request.evaluationCriteria.length <= 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                <Button
                  variant="outline"
                  onClick={addCriterion}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  添加评估标准
                </Button>
              </CardContent>
            </Card>

            {/* 执行控制 */}
            <Card>
              <CardHeader>
                <CardTitle>开始APE优化</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <Button
                    onClick={handleSubmit}
                    disabled={
                      isLoading ||
                      request.task.trim().length === 0 ||
                      request.examples.length === 0
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
                </div>

                {/* 实时状态 */}
                {(currentStep || currentEvaluation) && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      <span className="text-blue-700 font-medium">APE状态</span>
                    </div>
                    {currentStep && (
                      <p className="text-blue-600 mt-1">{currentStep}</p>
                    )}
                    {currentEvaluation && (
                      <p className="text-blue-500 text-sm mt-1">
                        {currentEvaluation}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 候选指令展示 */}
            {candidates.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5" />
                    候选指令 ({candidates.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {candidates.map((candidate, index) => (
                    <div
                      key={candidate.id}
                      className="border border-gray-200 rounded-lg p-4"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline">候选 {index + 1}</Badge>
                        <span className="text-sm text-gray-500">
                          {candidate.id}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <div>
                          <Label className="text-sm font-medium">
                            指令内容
                          </Label>
                          <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded border">
                            {candidate.instruction}
                          </p>
                        </div>

                        {candidate.description && (
                          <div>
                            <Label className="text-sm font-medium">
                              设计说明
                            </Label>
                            <p className="text-sm text-gray-600">
                              {candidate.description}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* 评估结果 */}
            {evaluations.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    评估结果
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {evaluations.map((evaluation, index) => (
                    <div
                      key={evaluation.candidateId}
                      className="border border-gray-200 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">候选 {index + 1}</Badge>
                          <span className="text-sm font-medium">
                            {evaluation.instruction.substring(0, 50)}...
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className="bg-blue-100 text-blue-800">
                            平均分: {(evaluation.averageScore * 100).toFixed(1)}
                            %
                          </Badge>
                          <Badge className="bg-green-100 text-green-800">
                            成功率: {(evaluation.successRate * 100).toFixed(1)}%
                          </Badge>
                        </div>
                      </div>

                      <div className="text-xs text-gray-500">
                        总分: {evaluation.overallScore.toFixed(2)} | 测试样本:{' '}
                        {evaluation.results.length}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* 最终结果 */}
            {response && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Crown className="h-5 w-5 text-yellow-600" />
                    最优指令
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <h4 className="font-medium text-yellow-800 mb-2">
                      最佳指令
                    </h4>
                    <p className="text-yellow-700 font-mono bg-white p-3 rounded border">
                      {response.bestInstruction.instruction}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {(response.bestInstruction.score * 100).toFixed(1)}%
                      </div>
                      <div className="text-sm text-blue-700">综合得分</div>
                    </div>

                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {response.improvement}
                      </div>
                      <div className="text-sm text-green-700">性能改进</div>
                    </div>

                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">
                        {(response.totalTime / 1000).toFixed(1)}s
                      </div>
                      <div className="text-sm text-purple-700">优化耗时</div>
                    </div>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-lg">
                    <h4 className="font-medium text-gray-800 mb-1">选择理由</h4>
                    <p className="text-sm text-gray-600">
                      {response.bestInstruction.reasoning}
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
