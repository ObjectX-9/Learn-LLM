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
  Layers,
  Zap,
  Search,
  FileText,
  TrendingUp,
  Archive,
  Workflow,
} from 'lucide-react';

interface GenerateKnowledgeRequest {
  question: string;
  domain?:
    | 'general'
    | 'science'
    | 'history'
    | 'geography'
    | 'sports'
    | 'daily-life';
  numKnowledge?: number;
  modelName?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

interface KnowledgeItem {
  id: number;
  content: string;
  confidence: number;
  tokens: number;
  duration: number;
}

interface StreamMessage {
  type: string;
  message?: string;
  question?: string;
  step?: number;
  knowledge?: KnowledgeItem[];
  duration?: number;
  result?: any;
  error?: string;
}

export default function GenerateKnowledgePage() {
  // State hooks
  const [request, setRequest] = useState<GenerateKnowledgeRequest>({
    question: '',
    domain: 'general',
    numKnowledge: 2,
    modelName: 'gpt-3.5-turbo',
    temperature: 0.7,
    maxTokens: 2000,
    stream: true,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [currentMessage, setCurrentMessage] = useState('');
  const [generatedKnowledge, setGeneratedKnowledge] = useState<KnowledgeItem[]>(
    []
  );
  const [finalResult, setFinalResult] = useState<any>(null);
  const [startTime, setStartTime] = useState<number>(0);
  const [showDemo, setShowDemo] = useState(true);

  // Ref hooks
  const abortControllerRef = useRef<AbortController | null>(null);

  // 更新请求参数
  const updateRequest = (updates: Partial<GenerateKnowledgeRequest>) => {
    setRequest((prev) => ({ ...prev, ...updates }));
  };

  // 示例问题
  const exampleQuestions = {
    general: '眼镜总是会起雾吗？',
    science: '光的速度在不同介质中是恒定的吗？',
    history: '罗马帝国是在5世纪完全灭亡的吗？',
    geography: '撒哈拉沙漠是世界上最大的沙漠吗？',
    sports: '高尔夫球的目标是获得比其他人更高的得分吗？',
    'daily-life': '每天喝8杯水对所有人都有益吗？',
  };

  // 领域说明
  const domainDescriptions = {
    general: {
      name: '通用常识',
      icon: Brain,
      description: '日常生活中的常见概念和现象',
    },
    science: {
      name: '科学知识',
      icon: Zap,
      description: '物理、化学、生物等科学领域',
    },
    history: {
      name: '历史事件',
      icon: Archive,
      description: '历史人物、事件和时期',
    },
    geography: {
      name: '地理知识',
      icon: Target,
      description: '地形、气候、国家和城市',
    },
    sports: {
      name: '体育运动',
      icon: TrendingUp,
      description: '各种体育项目的规则和知识',
    },
    'daily-life': {
      name: '日常生活',
      icon: FileText,
      description: '健康、饮食、生活习惯等',
    },
  };

  // 处理示例选择
  const handleExampleSelect = (domain: string) => {
    const question = exampleQuestions[domain as keyof typeof exampleQuestions];
    updateRequest({
      question,
      domain: domain as GenerateKnowledgeRequest['domain'],
    });
    setShowDemo(false);
  };

  // 提交处理
  const handleSubmit = async () => {
    if (!request.question.trim()) return;

    setIsLoading(true);
    setCurrentStep(0);
    setCurrentMessage('准备开始生成知识...');
    setGeneratedKnowledge([]);
    setFinalResult(null);
    setStartTime(Date.now());

    // 创建取消控制器
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch('/api/generate-knowledge', {
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

                    case 'step_start':
                      setCurrentStep(data.step || 0);
                      setCurrentMessage(data.message || '');
                      break;

                    case 'knowledge_generated':
                      if (data.knowledge) {
                        setGeneratedKnowledge(data.knowledge);
                        setCurrentMessage(
                          `知识生成完成，耗时 ${data.duration}ms`
                        );
                      }
                      break;

                    case 'final_result':
                      setFinalResult(data.result);
                      setCurrentMessage('生成知识提示推理完成！');
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
        setGeneratedKnowledge(data.generatedKnowledge || []);
        setFinalResult(data);
        setIsLoading(false);
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Generate Knowledge Error:', error);
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
    setCurrentStep(0);
    setCurrentMessage('');
    setGeneratedKnowledge([]);
    setFinalResult(null);
    updateRequest({ question: '' });
  };

  const isValid = request.question.trim().length > 0;

  return (
    <TestPageLayout
      title="生成知识提示 (Generate Knowledge)"
      description="通过先生成相关知识，再进行推理，提高AI在复杂任务上的表现"
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
                    <Layers className="h-5 w-5 text-blue-600" />
                    什么是生成知识提示？
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-gray-600">
                    生成知识提示（Generate Knowledge）是一种两步骤的推理技术。
                    首先让AI生成与问题相关的背景知识，然后利用这些知识来回答原问题，
                    特别适用于需要常识推理的任务。
                  </p>
                  <div className="space-y-2">
                    <h4 className="font-medium">核心优势：</h4>
                    <ul className="text-sm space-y-1 text-gray-600">
                      <li>• 提供必要的背景知识支持</li>
                      <li>• 减少知识盲区的影响</li>
                      <li>• 提高复杂推理的准确性</li>
                      <li>• 增强答案的可信度</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Workflow className="h-5 w-5 text-green-600" />
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
                        <p className="font-medium text-sm">知识生成</p>
                        <p className="text-xs text-gray-600">
                          为给定问题生成相关的背景知识
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className="mt-1">
                        2
                      </Badge>
                      <div>
                        <p className="font-medium text-sm">知识整合</p>
                        <p className="text-xs text-gray-600">
                          将生成的知识与原问题结合
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className="mt-1">
                        3
                      </Badge>
                      <div>
                        <p className="font-medium text-sm">推理回答</p>
                        <p className="text-xs text-gray-600">
                          基于知识进行推理并给出答案
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="h-5 w-5 text-purple-600" />
                    适用场景
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-2 text-sm">
                    <div className="p-2 bg-blue-50 rounded text-blue-800">
                      常识推理问题
                    </div>
                    <div className="p-2 bg-green-50 rounded text-green-800">
                      事实性问答
                    </div>
                    <div className="p-2 bg-purple-50 rounded text-purple-800">
                      复杂判断任务
                    </div>
                    <div className="p-2 bg-orange-50 rounded text-orange-800">
                      需要背景知识的推理
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    技术特点
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm space-y-2 text-gray-600">
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                      Few-shot示例引导知识生成
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                      多个知识项增强鲁棒性
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                      知识置信度评估
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                      透明的推理过程
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
                    选择一个领域的示例问题来体验生成知识提示的效果
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-4">
                    {Object.entries(domainDescriptions).map(([key, domain]) => {
                      const Icon = domain.icon;
                      return (
                        <Card
                          key={key}
                          className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-blue-200"
                          onClick={() => handleExampleSelect(key)}
                        >
                          <CardContent className="p-4">
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <Icon className="h-5 w-5 text-blue-600" />
                                <Badge variant="outline">{domain.name}</Badge>
                              </div>
                              <p className="text-xs text-gray-600">
                                {domain.description}
                              </p>
                              <p className="text-sm font-medium">
                                "
                                {
                                  exampleQuestions[
                                    key as keyof typeof exampleQuestions
                                  ]
                                }
                                "
                              </p>
                              <div className="flex justify-end">
                                <ArrowRight className="h-4 w-4 text-gray-400" />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
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
                      <Label htmlFor="question">问题描述</Label>
                      <Textarea
                        id="question"
                        placeholder="请输入需要背景知识支持的问题..."
                        value={request.question}
                        onChange={(e) =>
                          updateRequest({ question: e.target.value })
                        }
                        rows={3}
                        className="resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="domain">知识领域</Label>
                        <Select
                          value={request.domain}
                          onValueChange={(value) =>
                            updateRequest({
                              domain:
                                value as GenerateKnowledgeRequest['domain'],
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(domainDescriptions).map(
                              ([key, domain]) => (
                                <SelectItem key={key} value={key}>
                                  {domain.name}
                                </SelectItem>
                              )
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="numKnowledge">知识数量</Label>
                        <Select
                          value={request.numKnowledge?.toString()}
                          onValueChange={(value) =>
                            updateRequest({ numKnowledge: parseInt(value) })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1个</SelectItem>
                            <SelectItem value="2">2个</SelectItem>
                            <SelectItem value="3">3个</SelectItem>
                            <SelectItem value="4">4个</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="temperature">创造性</Label>
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
                          min="500"
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
                            生成中...
                          </>
                        ) : (
                          <>
                            <Layers className="mr-2 h-4 w-4" />
                            开始生成知识
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

              {/* 右侧：过程展示区域 */}
              <div className="space-y-6">
                {/* 进度状态 */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="flex items-center gap-2">
                      <Workflow className="h-5 w-5" />
                      处理进度
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
                      <div className="flex items-center gap-3">
                        <Badge
                          variant={currentStep >= 1 ? 'default' : 'outline'}
                        >
                          步骤1: 知识生成
                        </Badge>
                        <Badge
                          variant={currentStep >= 2 ? 'default' : 'outline'}
                        >
                          步骤2: 知识整合推理
                        </Badge>
                      </div>

                      {currentMessage && (
                        <div className="text-sm text-blue-600 p-2 bg-blue-50 rounded">
                          {currentMessage}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* 生成的知识展示 */}
                {generatedKnowledge.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        生成的知识
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {generatedKnowledge.map((knowledge) => (
                          <div
                            key={knowledge.id}
                            className="border rounded-lg p-3 space-y-2"
                          >
                            <div className="flex justify-between items-center">
                              <Badge variant="outline">
                                知识 {knowledge.id}
                              </Badge>
                              <div className="flex gap-2 text-xs text-gray-500">
                                <span>
                                  置信度:{' '}
                                  {(knowledge.confidence * 100).toFixed(1)}%
                                </span>
                                <span>{knowledge.duration}ms</span>
                              </div>
                            </div>
                            <p className="text-sm text-gray-700">
                              {knowledge.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 最终推理结果 */}
                {finalResult && (
                  <Card className="border-green-200">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-green-700">
                        <CheckCircle className="h-5 w-5" />
                        推理结果
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {finalResult.reasoning && (
                        <div className="p-3 bg-blue-50 rounded-lg">
                          <h4 className="font-medium text-blue-900 mb-2">
                            推理过程:
                          </h4>
                          <p className="text-sm text-blue-800">
                            {finalResult.reasoning}
                          </p>
                        </div>
                      )}

                      <div className="p-3 bg-green-50 rounded-lg">
                        <h4 className="font-medium text-green-900 mb-2">
                          最终答案:
                        </h4>
                        <p className="text-green-800">
                          {finalResult.finalAnswer}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">知识生成耗时: </span>
                          <span>
                            {finalResult.steps?.knowledgeGeneration}ms
                          </span>
                        </div>
                        <div>
                          <span className="font-medium">推理耗时: </span>
                          <span>
                            {finalResult.steps?.knowledgeIntegration}ms
                          </span>
                        </div>
                        <div>
                          <span className="font-medium">总耗时: </span>
                          <span>{finalResult.totalTime}ms</span>
                        </div>
                        <div>
                          <span className="font-medium">知识数量: </span>
                          <span>
                            {finalResult.generatedKnowledge?.length || 0}个
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 空状态 */}
                {!isLoading &&
                  generatedKnowledge.length === 0 &&
                  !finalResult && (
                    <Card>
                      <CardContent className="flex items-center justify-center h-40 text-gray-400">
                        <div className="text-center">
                          <Layers className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>等待开始生成知识...</p>
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
