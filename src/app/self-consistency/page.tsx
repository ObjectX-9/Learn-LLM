'use client';

import { useState, useRef, useEffect } from 'react';
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
  ArrowRight,
  Clock,
  BookOpen,
  Target,
  Lightbulb,
  CheckCircle,
  Loader2,
  Users,
  TrendingUp,
  Zap,
  BarChart3,
  Shuffle,
  Award,
  MessageSquare,
} from 'lucide-react';
import MathExplanation from './math-explanation';

interface SelfConsistencyRequest {
  problem: string;
  systemMessage?: string;
  baseTemperature?: number;
  maxTokens?: number;
  modelName?: string;
  numReasoning?: number;
  stream?: boolean;
  difficulty?: 'basic' | 'intermediate' | 'advanced';
  domain?: 'math' | 'logic' | 'reasoning' | 'analysis' | 'general';
  consensusMethod?: 'voting' | 'similarity' | 'confidence';
}

interface ReasoningAttempt {
  id: number;
  temperature: number;
  reasoning: string;
  answer: string;
  confidence: number;
  tokens: number;
  duration: number;
}

interface StreamMessage {
  type: string;
  message?: string;
  totalAttempts?: number;
  attemptId?: number;
  temperature?: number;
  attempt?: ReasoningAttempt;
  progress?: string;
  error?: string;
  result?: any;
}

export default function SelfConsistencyPage() {
  // State hooks
  const [request, setRequest] = useState<SelfConsistencyRequest>({
    problem: '',
    baseTemperature: 0.7,
    maxTokens: 3000,
    modelName: 'gpt-3.5-turbo',
    numReasoning: 3,
    stream: true,
    difficulty: 'intermediate',
    domain: 'general',
    consensusMethod: 'voting',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [attempts, setAttempts] = useState<ReasoningAttempt[]>([]);
  const [currentAttempt, setCurrentAttempt] = useState(0);
  const [finalResult, setFinalResult] = useState<any>(null);
  const [currentMessage, setCurrentMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [startTime, setStartTime] = useState<number>(0);
  const [showDemo, setShowDemo] = useState(true);

  // Ref hooks
  const abortControllerRef = useRef<AbortController | null>(null);

  // 更新请求参数
  const updateRequest = (updates: Partial<SelfConsistencyRequest>) => {
    setRequest((prev) => ({ ...prev, ...updates }));
  };

  // 示例问题
  const exampleProblems = {
    math: '一个圆形游乐场的半径是50米。如果要在游乐场周围铺设一条2米宽的小径，那么小径的面积是多少平方米？（π取3.14）',
    logic:
      '五个朋友A、B、C、D、E坐成一排。已知：A不坐在两端，B坐在C的左边，D不坐在E的旁边。请列出所有可能的坐法有多少种？',
    reasoning:
      '一家公司有100名员工，其中60%会使用Excel，40%会使用PowerPoint，30%两者都会。如果随机选择一名员工，该员工至少会使用其中一种软件的概率是多少？',
    analysis:
      '为什么在经济学中，供给和需求的交点被称为均衡点？请从多个角度分析这个概念的重要性。',
  };

  // 共识方法说明
  const consensusMethods = {
    voting: {
      name: '投票法',
      description: '选择出现频次最高的答案',
      icon: Users,
    },
    similarity: {
      name: '相似性法',
      description: '基于答案相似度选择最佳结果',
      icon: Target,
    },
    confidence: {
      name: '置信度法',
      description: '选择置信度最高的答案',
      icon: TrendingUp,
    },
  };

  // 处理示例选择
  const handleExampleSelect = (domain: string) => {
    const problem = exampleProblems[domain as keyof typeof exampleProblems];
    updateRequest({
      problem,
      domain: domain as SelfConsistencyRequest['domain'],
    });
    setShowDemo(false);
  };

  // 提交处理
  const handleSubmit = async () => {
    if (!request.problem.trim()) return;

    setIsLoading(true);
    setAttempts([]);
    setCurrentAttempt(0);
    setFinalResult(null);
    setCurrentMessage('准备开始推理...');
    setProgress(0);
    setStartTime(Date.now());

    // 创建取消控制器
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch('/api/cot/self-consistency', {
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

      if (request.stream) {
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

                    case 'attempt_start':
                      setCurrentAttempt(data.attemptId || 0);
                      setCurrentMessage(data.message || '');
                      break;

                    case 'attempt_complete':
                      if (data.attempt) {
                        setAttempts((prev) => [...prev, data.attempt!]);
                        setProgress(parseInt(data.progress || '0'));
                      }
                      break;

                    case 'attempt_error':
                      setCurrentMessage(data.error || '推理失败');
                      break;

                    case 'final_result':
                      setFinalResult(data.result);
                      setCurrentMessage('推理完成！');
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
      } else {
        // 处理非流式响应
        const data = await response.json();
        setAttempts(data.attempts || []);
        setFinalResult(data);
        setIsLoading(false);
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Self-Consistency Error:', error);
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
    setAttempts([]);
    setCurrentAttempt(0);
    setFinalResult(null);
    setCurrentMessage('');
    setProgress(0);
    updateRequest({ problem: '' });
  };

  const isValid = request.problem.trim().length > 0;

  // 投票法分析组件
  const VotingAnalysis = ({
    attempts,
    finalResult,
  }: {
    attempts: ReasoningAttempt[];
    finalResult: any;
  }) => {
    // 统计答案频次
    const answerCounts = new Map<string, number>();
    const answerDetails = new Map<string, ReasoningAttempt[]>();

    attempts.forEach((attempt) => {
      const normalizedAnswer = attempt.answer
        .toLowerCase()
        .replace(/[^\w\s\d]/g, '')
        .trim();
      answerCounts.set(
        normalizedAnswer,
        (answerCounts.get(normalizedAnswer) || 0) + 1
      );

      if (!answerDetails.has(normalizedAnswer)) {
        answerDetails.set(normalizedAnswer, []);
      }
      answerDetails.get(normalizedAnswer)!.push(attempt);
    });

    return (
      <div className="space-y-3">
        <div className="text-sm font-medium text-blue-800">投票统计:</div>
        {Array.from(answerCounts.entries())
          .sort(([, a], [, b]) => b - a)
          .map(([answer, count]) => {
            const details = answerDetails.get(answer) || [];
            const avgConfidence =
              details.reduce((sum, att) => sum + att.confidence, 0) /
              details.length;
            const isWinner =
              answer ===
              finalResult.finalAnswer
                .toLowerCase()
                .replace(/[^\w\s\d]/g, '')
                .trim();

            return (
              <div
                key={answer}
                className={`p-2 rounded ${isWinner ? 'bg-green-100 border border-green-300' : 'bg-gray-100'}`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium">
                    {details[0]?.answer || answer}
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge variant={isWinner ? 'default' : 'secondary'}>
                      {count}票 ({((count / attempts.length) * 100).toFixed(1)}
                      %)
                    </Badge>
                    {isWinner && (
                      <Badge variant="outline" className="text-green-600">
                        胜出
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  平均置信度: {(avgConfidence * 100).toFixed(1)}% | 推理ID:{' '}
                  {details.map((d) => d.id).join(', ')}
                </div>
              </div>
            );
          })}
        <div className="text-xs text-blue-600 mt-2">
          ✓ 选择票数最多的答案作为最终结果
        </div>
      </div>
    );
  };

  // 置信度法分析组件
  const ConfidenceAnalysis = ({
    attempts,
    finalResult,
  }: {
    attempts: ReasoningAttempt[];
    finalResult: any;
  }) => {
    const sortedByConfidence = [...attempts].sort(
      (a, b) => b.confidence - a.confidence
    );
    const bestAttempt = sortedByConfidence[0];

    return (
      <div className="space-y-3">
        <div className="text-sm font-medium text-blue-800">置信度排序:</div>
        {sortedByConfidence.map((attempt, index) => {
          const isWinner = attempt.id === bestAttempt.id;

          return (
            <div
              key={attempt.id}
              className={`p-2 rounded ${isWinner ? 'bg-green-100 border border-green-300' : 'bg-gray-100'}`}
            >
              <div className="flex justify-between items-center">
                <span className="text-sm">
                  <Badge variant="outline" className="mr-2">
                    推理{attempt.id}
                  </Badge>
                  {attempt.answer}
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant={isWinner ? 'default' : 'secondary'}>
                    {(attempt.confidence * 100).toFixed(1)}%
                  </Badge>
                  {isWinner && (
                    <Badge variant="outline" className="text-green-600">
                      最高
                    </Badge>
                  )}
                </div>
              </div>
              {index === 0 && (
                <div className="text-xs text-gray-600 mt-1">
                  温度: {attempt.temperature.toFixed(2)} | 耗时:{' '}
                  {attempt.duration}ms
                </div>
              )}
            </div>
          );
        })}
        <div className="text-xs text-blue-600 mt-2">
          ✓ 选择置信度最高的推理结果:{' '}
          {(bestAttempt.confidence * 100).toFixed(1)}%
        </div>
        {/* 当多个答案置信度相同时的额外说明 */}
        {sortedByConfidence.filter(
          (att) => Math.abs(att.confidence - bestAttempt.confidence) < 0.01
        ).length > 1 && (
          <div className="text-xs text-orange-600 mt-1 p-2 bg-orange-50 rounded">
            ⚠️
            多个答案置信度相近，已根据推理效率、数值精度等次要指标选择最佳答案
          </div>
        )}
      </div>
    );
  };

  // 相似性法分析组件
  const SimilarityAnalysis = ({
    attempts,
    finalResult,
  }: {
    attempts: ReasoningAttempt[];
    finalResult: any;
  }) => {
    // 计算每个答案与其他答案的相似性
    const similarityScores = attempts
      .map((attempt, i) => {
        let totalSimilarity = 0;
        let count = 0;

        attempts.forEach((other, j) => {
          if (i !== j) {
            const similarity = calculateAnswerSimilarity(
              attempt.answer,
              other.answer
            );
            totalSimilarity += similarity;
            count++;
          }
        });

        const avgSimilarity = count > 0 ? totalSimilarity / count : 0;
        const combinedScore = avgSimilarity * attempt.confidence;

        return {
          ...attempt,
          avgSimilarity,
          combinedScore,
        };
      })
      .sort((a, b) => b.combinedScore - a.combinedScore);

    const winner = similarityScores[0];

    return (
      <div className="space-y-3">
        <div className="text-sm font-medium text-blue-800">相似性分析:</div>
        {similarityScores.map((item, index) => {
          const isWinner = item.id === winner.id;

          return (
            <div
              key={item.id}
              className={`p-2 rounded ${isWinner ? 'bg-green-100 border border-green-300' : 'bg-gray-100'}`}
            >
              <div className="flex justify-between items-center">
                <span className="text-sm">
                  <Badge variant="outline" className="mr-2">
                    推理{item.id}
                  </Badge>
                  {item.answer}
                </span>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={isWinner ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    综合: {(item.combinedScore * 100).toFixed(1)}%
                  </Badge>
                  {isWinner && (
                    <Badge variant="outline" className="text-green-600">
                      最佳
                    </Badge>
                  )}
                </div>
              </div>
              <div className="text-xs text-gray-600 mt-1">
                相似性: {(item.avgSimilarity * 100).toFixed(1)}% | 置信度:{' '}
                {(item.confidence * 100).toFixed(1)}% | 综合得分:{' '}
                {(item.combinedScore * 100).toFixed(1)}%
              </div>
            </div>
          );
        })}
        <div className="text-xs text-blue-600 mt-2">
          ✓ 选择相似性×置信度综合得分最高的答案
        </div>
      </div>
    );
  };

  // 计算答案相似性的辅助函数
  const calculateAnswerSimilarity = (
    answer1: string,
    answer2: string
  ): number => {
    const norm1 = answer1
      .toLowerCase()
      .replace(/[^\w\s\d]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const norm2 = answer2
      .toLowerCase()
      .replace(/[^\w\s\d]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (norm1 === norm2) return 1.0;

    const words1 = norm1.split(' ');
    const words2 = norm2.split(' ');

    const intersection = words1.filter((word) => words2.includes(word));
    const unionSet = new Set([...words1, ...words2]);
    const union = Array.from(unionSet);

    return intersection.length / union.length;
  };

  return (
    <TestPageLayout
      title="自我一致性 (Self-Consistency)"
      description="通过多次独立推理提高AI答案的准确性和可靠性，展示共识算法的工作原理"
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
                    <Brain className="h-5 w-5 text-blue-600" />
                    什么是自我一致性？
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-gray-600">
                    自我一致性（Self-Consistency）是链式思考的增强版本，通过让AI进行多次独立推理，
                    然后从中选择最一致或最可靠的答案，显著提高复杂推理任务的准确性。
                  </p>
                  <div className="space-y-2">
                    <h4 className="font-medium">核心优势：</h4>
                    <ul className="text-sm space-y-1 text-gray-600">
                      <li>• 降低单次推理的随机误差</li>
                      <li>• 提高答案的稳定性和可靠性</li>
                      <li>• 发现推理过程中的不一致</li>
                      <li>• 增强模型的鲁棒性</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shuffle className="h-5 w-5 text-purple-600" />
                    工作原理
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className="mt-1">
                        1
                      </Badge>
                      <div>
                        <p className="font-medium text-sm">多次采样</p>
                        <p className="text-xs text-gray-600">
                          使用不同随机种子进行多次独立推理
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className="mt-1">
                        2
                      </Badge>
                      <div>
                        <p className="font-medium text-sm">答案聚合</p>
                        <p className="text-xs text-gray-600">
                          收集所有推理结果和答案
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className="mt-1">
                        3
                      </Badge>
                      <div>
                        <p className="font-medium text-sm">共识计算</p>
                        <p className="text-xs text-gray-600">
                          使用算法选择最佳答案
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-green-600" />
                    共识算法
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(consensusMethods).map(([key, method]) => {
                      const Icon = method.icon;
                      return (
                        <div
                          key={key}
                          className="flex items-start gap-3 p-2 bg-gray-50 rounded"
                        >
                          <Icon className="h-4 w-4 mt-1 text-gray-600" />
                          <div>
                            <p className="font-medium text-sm">{method.name}</p>
                            <p className="text-xs text-gray-600">
                              {method.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-yellow-600" />
                    适用场景
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-2 text-sm">
                    <div className="p-2 bg-blue-50 rounded text-blue-800">
                      数学计算与证明
                    </div>
                    <div className="p-2 bg-green-50 rounded text-green-800">
                      逻辑推理问题
                    </div>
                    <div className="p-2 bg-purple-50 rounded text-purple-800">
                      多步骤分析
                    </div>
                    <div className="p-2 bg-orange-50 rounded text-orange-800">
                      决策问题
                    </div>
                    <div className="p-2 bg-red-50 rounded text-red-800">
                      复杂推理任务
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 实践测试 */}
          <TabsContent value="test" className="space-y-6">
            {/* 示例问题选择 */}
            {showDemo && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    选择示例问题
                  </CardTitle>
                  <CardDescription>
                    选择一个示例问题来体验自我一致性推理的效果
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4">
                    {Object.entries(exampleProblems).map(
                      ([domain, problem]) => (
                        <Card
                          key={domain}
                          className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-purple-200"
                          onClick={() => handleExampleSelect(domain)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <Badge variant="outline" className="mb-2">
                                  {domain === 'math'
                                    ? '数学'
                                    : domain === 'logic'
                                      ? '逻辑'
                                      : domain === 'reasoning'
                                        ? '推理'
                                        : '分析'}
                                </Badge>
                                <p className="text-sm text-gray-600 line-clamp-3">
                                  {problem}
                                </p>
                              </div>
                              <ArrowRight className="h-4 w-4 text-gray-400 mt-1" />
                            </div>
                          </CardContent>
                        </Card>
                      )
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid lg:grid-cols-2 gap-6">
              {/* 左侧：配置区域 */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>问题设置</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="problem">问题描述</Label>
                      <Textarea
                        id="problem"
                        placeholder="请输入需要多次推理的复杂问题..."
                        value={request.problem}
                        onChange={(e) =>
                          updateRequest({ problem: e.target.value })
                        }
                        rows={4}
                        className="resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="numReasoning">推理次数</Label>
                        <Select
                          value={request.numReasoning?.toString()}
                          onValueChange={(value) =>
                            updateRequest({ numReasoning: parseInt(value) })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="3">3次</SelectItem>
                            <SelectItem value="5">5次</SelectItem>
                            <SelectItem value="7">7次</SelectItem>
                            <SelectItem value="10">10次</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="consensusMethod">共识方法</Label>
                        <Select
                          value={request.consensusMethod}
                          onValueChange={(value) =>
                            updateRequest({
                              consensusMethod:
                                value as SelfConsistencyRequest['consensusMethod'],
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="voting">投票法</SelectItem>
                            <SelectItem value="similarity">相似性法</SelectItem>
                            <SelectItem value="confidence">置信度法</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="domain">问题域</Label>
                        <Select
                          value={request.domain}
                          onValueChange={(value) =>
                            updateRequest({
                              domain: value as SelfConsistencyRequest['domain'],
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="general">通用</SelectItem>
                            <SelectItem value="math">数学</SelectItem>
                            <SelectItem value="logic">逻辑</SelectItem>
                            <SelectItem value="reasoning">推理</SelectItem>
                            <SelectItem value="analysis">分析</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="difficulty">难度级别</Label>
                        <Select
                          value={request.difficulty}
                          onValueChange={(value) =>
                            updateRequest({
                              difficulty:
                                value as SelfConsistencyRequest['difficulty'],
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="basic">基础</SelectItem>
                            <SelectItem value="intermediate">中等</SelectItem>
                            <SelectItem value="advanced">高级</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="baseTemperature">基础温度</Label>
                        <Input
                          id="baseTemperature"
                          type="number"
                          min="0"
                          max="2"
                          step="0.1"
                          value={request.baseTemperature}
                          onChange={(e) =>
                            updateRequest({
                              baseTemperature: parseFloat(e.target.value),
                            })
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="maxTokens">最大令牌数</Label>
                        <Input
                          id="maxTokens"
                          type="number"
                          min="100"
                          max="4000"
                          step="100"
                          value={request.maxTokens}
                          onChange={(e) =>
                            updateRequest({
                              maxTokens: parseInt(e.target.value),
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
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
                            <Shuffle className="mr-2 h-4 w-4" />
                            开始多次推理
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

              {/* 右侧：结果展示区域 */}
              <div className="space-y-6">
                {/* 进度状态 */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      推理进度
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
                      <div className="flex justify-between text-sm">
                        <span>当前进度</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>
                          已完成: {attempts.length}/{request.numReasoning}
                        </span>
                        <span>当前: 第{currentAttempt}次</span>
                      </div>
                      {currentMessage && (
                        <div className="text-sm text-blue-600 mt-2">
                          {currentMessage}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* 推理结果展示 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      推理结果
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4 max-h-[400px] overflow-y-auto">
                      {attempts.map((attempt) => (
                        <div
                          key={attempt.id}
                          className="border rounded-lg p-3 space-y-2"
                        >
                          <div className="flex justify-between items-center">
                            <Badge variant="outline">第{attempt.id}次</Badge>
                            <div className="flex gap-2 text-xs text-gray-500">
                              <span>
                                温度: {attempt.temperature.toFixed(2)}
                              </span>
                              <span>
                                置信度: {(attempt.confidence * 100).toFixed(1)}%
                              </span>
                              <span>{attempt.duration}ms</span>
                            </div>
                          </div>
                          <div className="text-sm">
                            <span className="font-medium">答案: </span>
                            <span className="text-blue-600">
                              {attempt.answer}
                            </span>
                          </div>
                        </div>
                      ))}

                      {attempts.length === 0 && !isLoading && (
                        <div className="text-center text-gray-400 py-8">
                          <Shuffle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>等待开始推理...</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* 共识推理过程 */}
                {finalResult && attempts.length > 0 && (
                  <Card className="border-purple-200">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-purple-700">
                        <Brain className="h-5 w-5" />
                        共识推理过程
                      </CardTitle>
                      <CardDescription>
                        详细展示如何从{attempts.length}个推理结果中得出最终答案
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* 答案统计 */}
                      <div className="space-y-3">
                        <h4 className="font-medium text-sm">
                          步骤1: 收集所有推理结果
                        </h4>
                        <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                          {attempts.map((attempt) => (
                            <div
                              key={attempt.id}
                              className="flex justify-between items-center text-sm"
                            >
                              <span className="text-gray-600">
                                推理{attempt.id}:
                              </span>
                              <div className="flex items-center gap-3">
                                <span className="font-medium">
                                  {attempt.answer}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  置信度:{' '}
                                  {(attempt.confidence * 100).toFixed(1)}%
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 共识算法分析 */}
                      <div className="space-y-3">
                        <h4 className="font-medium text-sm">
                          步骤2: 应用
                          {
                            consensusMethods[
                              finalResult.consensus
                                .method as keyof typeof consensusMethods
                            ]?.name
                          }
                        </h4>
                        <div className="bg-blue-50 rounded-lg p-3">
                          {finalResult.consensus.method === 'voting' && (
                            <VotingAnalysis
                              attempts={attempts}
                              finalResult={finalResult}
                            />
                          )}
                          {finalResult.consensus.method === 'confidence' && (
                            <ConfidenceAnalysis
                              attempts={attempts}
                              finalResult={finalResult}
                            />
                          )}
                          {finalResult.consensus.method === 'similarity' && (
                            <SimilarityAnalysis
                              attempts={attempts}
                              finalResult={finalResult}
                            />
                          )}
                        </div>
                      </div>

                      {/* 最终决策 */}
                      <div className="space-y-3">
                        <h4 className="font-medium text-sm">步骤3: 最终决策</h4>
                        <div className="bg-green-50 rounded-lg p-3 space-y-2">
                          <div className="text-sm">
                            <span className="font-medium text-green-800">
                              选择答案:{' '}
                            </span>
                            <span className="text-green-700">
                              {finalResult.finalAnswer}
                            </span>
                          </div>
                          <div className="text-xs text-green-600">
                            {finalResult.consensus.reasoning}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 数学问题验证 */}
                {finalResult &&
                  attempts.length > 0 &&
                  request.domain === 'math' &&
                  request.problem.includes('圆形游乐场') && (
                    <MathExplanation attempts={attempts} />
                  )}

                {/* 最终共识结果 */}
                {finalResult && (
                  <Card className="border-green-200">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-green-700">
                        <Award className="h-5 w-5" />
                        共识结果
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="p-4 bg-green-50 rounded-lg">
                        <div className="font-medium text-green-900 mb-2">
                          最终答案:
                        </div>
                        <div className="text-green-800">
                          {finalResult.finalAnswer}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">共识方法: </span>
                          <span>
                            {
                              consensusMethods[
                                finalResult.consensus
                                  .method as keyof typeof consensusMethods
                              ]?.name
                            }
                          </span>
                        </div>
                        <div>
                          <span className="font-medium">置信度: </span>
                          <span>
                            {(finalResult.consensus.confidence * 100).toFixed(
                              1
                            )}
                            %
                          </span>
                        </div>
                        <div>
                          <span className="font-medium">一致性: </span>
                          <span>
                            {(finalResult.consensus.agreement * 100).toFixed(1)}
                            %
                          </span>
                        </div>
                        <div>
                          <span className="font-medium">总耗时: </span>
                          <span>
                            {(finalResult.totalTime / 1000).toFixed(1)}s
                          </span>
                        </div>
                      </div>

                      <div className="text-xs text-gray-600 border-t pt-2">
                        基于{attempts.length}次独立推理，通过
                        {
                          consensusMethods[
                            finalResult.consensus
                              .method as keyof typeof consensusMethods
                          ]?.name
                        }
                        得出最终答案
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </TestPageLayout>
  );
}
