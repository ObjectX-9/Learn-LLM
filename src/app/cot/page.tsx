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
} from 'lucide-react';

interface CoTRequest {
  problem: string;
  systemMessage?: string;
  temperature?: number;
  maxTokens?: number;
  modelName?: string;
  stream?: boolean;
  showSteps?: boolean;
  difficulty?: 'basic' | 'intermediate' | 'advanced';
  domain?: 'math' | 'logic' | 'reasoning' | 'analysis' | 'general';
}

interface StreamData {
  content: string;
  buffer: string;
  currentStep: number;
  isInStep: boolean;
  done: boolean;
}

interface ThinkingStep {
  id: string;
  title: string;
  content: string;
  status: 'pending' | 'thinking' | 'completed';
  timing: number;
}

export default function CoTPage() {
  // State hooks
  const [request, setRequest] = useState<CoTRequest>({
    problem: '',
    temperature: 0.3,
    maxTokens: 3000,
    modelName: 'gpt-3.5-turbo',
    stream: true,
    showSteps: true,
    difficulty: 'intermediate',
    domain: 'general',
  });
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [showDemo, setShowDemo] = useState(true);
  const [startTime, setStartTime] = useState<number>(0);

  // Ref hooks
  const abortControllerRef = useRef<AbortController | null>(null);
  const responseRef = useRef<HTMLDivElement>(null);

  // Effect hooks
  useEffect(() => {
    if (responseRef.current) {
      responseRef.current.scrollTop = responseRef.current.scrollHeight;
    }
  }, [response]);

  // 更新请求参数
  const updateRequest = (updates: Partial<CoTRequest>) => {
    setRequest((prev) => ({ ...prev, ...updates }));
  };

  // 示例问题
  const exampleProblems = {
    math: '如果一个班级有30名学生，其中60%是女生，而女生中有25%戴眼镜，男生中有40%戴眼镜，那么全班戴眼镜的学生总数是多少？',
    logic:
      '有三个盒子：红、蓝、绿。每个盒子里有一个球，分别是金、银、铜。已知：1）金球不在红盒子里；2）银球不在蓝盒子里；3）铜球不在绿盒子里。请推理出每个盒子里的球是什么颜色？',
    reasoning:
      '某公司要从5个候选人中选择3人组成项目团队。已知：A和B不能同时选择；C必须选择；D和E中至少要选择一个。有多少种不同的选择方案？',
    analysis:
      '分析为什么人类会产生拖延行为，并从心理学、行为经济学和神经科学三个角度来解释这一现象。',
  };

  // 处理示例选择
  const handleExampleSelect = (domain: string) => {
    const problem = exampleProblems[domain as keyof typeof exampleProblems];
    updateRequest({
      problem,
      domain: domain as CoTRequest['domain'],
    });
    setShowDemo(false);
  };

  // 提交处理
  const handleSubmit = async () => {
    if (!request.problem.trim()) return;

    setIsLoading(true);
    setResponse('');
    setCurrentStepIndex(0);
    setThinkingSteps([]);
    setStartTime(Date.now());

    // 创建取消控制器
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch('/api/cot', {
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
          let stepCount = 0;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data: StreamData = JSON.parse(line.slice(6));

                  if (data.done) {
                    setIsLoading(false);
                    break;
                  }

                  setResponse((prev) => prev + data.content);

                  // 更新步骤状态
                  if (data.currentStep > stepCount) {
                    stepCount = data.currentStep;
                    setCurrentStepIndex(stepCount);
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
        setResponse(data.content || JSON.stringify(data, null, 2));
        setIsLoading(false);
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('CoT Error:', error);
        setResponse(`错误: ${error.message}`);
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
    setResponse('');
    setCurrentStepIndex(0);
    setThinkingSteps([]);
    updateRequest({ problem: '' });
  };

  const isValid = request.problem.trim().length > 0;

  return (
    <TestPageLayout
      title="链式思考 (Chain of Thought)"
      description="探索AI的推理过程，了解模型如何一步步分析和解决复杂问题"
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
                    什么是链式思考？
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-gray-600">
                    链式思考（Chain of Thought,
                    CoT）是一种提示技术，通过引导AI模型展示其推理过程，
                    让模型像人类一样"一步一步思考"。
                  </p>
                  <div className="space-y-2">
                    <h4 className="font-medium">核心特点：</h4>
                    <ul className="text-sm space-y-1 text-gray-600">
                      <li>• 分步骤展示推理过程</li>
                      <li>• 提高复杂问题解决能力</li>
                      <li>• 增强结果的可解释性</li>
                      <li>• 减少推理错误</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-green-600" />
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
                        <p className="font-medium text-sm">问题分解</p>
                        <p className="text-xs text-gray-600">
                          将复杂问题拆分为简单子问题
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className="mt-1">
                        2
                      </Badge>
                      <div>
                        <p className="font-medium text-sm">逐步推理</p>
                        <p className="text-xs text-gray-600">
                          按顺序解决每个子问题
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className="mt-1">
                        3
                      </Badge>
                      <div>
                        <p className="font-medium text-sm">结果整合</p>
                        <p className="text-xs text-gray-600">
                          将各步骤结果组合成最终答案
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-yellow-600" />
                    应用场景
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="p-2 bg-blue-50 rounded text-blue-800">
                      数学计算
                    </div>
                    <div className="p-2 bg-green-50 rounded text-green-800">
                      逻辑推理
                    </div>
                    <div className="p-2 bg-purple-50 rounded text-purple-800">
                      问题分析
                    </div>
                    <div className="p-2 bg-orange-50 rounded text-orange-800">
                      决策制定
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    优势
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm space-y-2 text-gray-600">
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                      提高准确性
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                      增强可信度
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                      便于调试
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                      教育价值
                    </li>
                  </ul>
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
                    选择一个示例问题来体验链式思考的推理过程
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4">
                    {Object.entries(exampleProblems).map(
                      ([domain, problem]) => (
                        <Card
                          key={domain}
                          className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-blue-200"
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
                        placeholder="请输入你想让AI分析的问题..."
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
                        <Label htmlFor="domain">问题域</Label>
                        <Select
                          value={request.domain}
                          onValueChange={(value) =>
                            updateRequest({
                              domain: value as CoTRequest['domain'],
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
                              difficulty: value as CoTRequest['difficulty'],
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
                        <Label htmlFor="temperature">
                          创造性 (Temperature)
                        </Label>
                        <Input
                          id="temperature"
                          type="number"
                          min="0"
                          max="2"
                          step="0.1"
                          value={request.temperature}
                          onChange={(e) =>
                            updateRequest({
                              temperature: parseFloat(e.target.value),
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
                            思考中...
                          </>
                        ) : (
                          <>
                            <Brain className="mr-2 h-4 w-4" />
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

              {/* 右侧：结果展示区域 */}
              <div className="space-y-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="h-5 w-5" />
                      推理过程
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
                    <div
                      ref={responseRef}
                      className="min-h-[400px] max-h-[600px] overflow-y-auto bg-gray-50 rounded-lg p-4 space-y-3"
                    >
                      {response ? (
                        <div className="whitespace-pre-wrap text-sm leading-relaxed">
                          {response}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-40 text-gray-400">
                          <div className="text-center">
                            <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>AI正在准备思考...</p>
                          </div>
                        </div>
                      )}

                      {isLoading && (
                        <div className="flex items-center gap-2 text-blue-600">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm">
                            正在思考第 {currentStepIndex} 步...
                          </span>
                        </div>
                      )}
                    </div>
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
