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
  Code,
  Calculator,
  Calendar,
  Brain,
  Zap,
  CheckCircle,
} from 'lucide-react';

interface PALRequest {
  question: string;
  domain: 'math' | 'date' | 'logic' | 'physics' | 'general';
  language: 'python' | 'javascript';
  includeExecution?: boolean;
  temperature?: number;
  modelName?: string;
  stream?: boolean;
}

interface CodeStep {
  stepNumber: number;
  description: string;
  code: string;
  explanation: string;
  variables?: Record<string, any>;
}

interface PALResponse {
  question: string;
  domain: string;
  language: string;
  reasoningSteps: CodeStep[];
  generatedCode: string;
  simulatedResult: any;
  explanation: string;
  totalTime: number;
}

export default function PALPage() {
  const [request, setRequest] = useState<PALRequest>({
    question: '一个班级有40个学生，其中60%是女生，女生比男生多多少人？',
    domain: 'math',
    language: 'python',
    includeExecution: true,
    temperature: 0.3,
    modelName: 'gpt-3.5-turbo',
    stream: true,
  });

  const [response, setResponse] = useState<PALResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [reasoningSteps, setReasoningSteps] = useState<CodeStep[]>([]);
  const [executionResult, setExecutionResult] = useState<any>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const domains = {
    math: {
      name: '数学计算',
      description: '解决数学问题和计算',
      color: 'bg-blue-100 text-blue-800',
      icon: Calculator,
      examples: [
        '计算复合利息：本金1000元，年利率5%，10年后的金额',
        '几何问题：圆形花园半径8米，围栏成本每米50元，总成本多少？',
        '概率问题：投掷两个骰子，和为7的概率是多少？',
      ],
    },
    date: {
      name: '日期计算',
      description: '处理日期和时间问题',
      color: 'bg-green-100 text-green-800',
      icon: Calendar,
      examples: [
        '今天是2023年12月15日，100天后是什么日期？',
        '计算两个日期之间的天数差',
        '如果今年是闰年，2月有多少天？',
      ],
    },
    logic: {
      name: '逻辑推理',
      description: '解决逻辑和组合问题',
      color: 'bg-purple-100 text-purple-800',
      icon: Brain,
      examples: [
        '5个人排队，有多少种不同的排列方式？',
        '从10本书中选3本，有多少种选法？',
        '逻辑推理：如果A>B，B>C，那么A和C的关系？',
      ],
    },
    physics: {
      name: '物理计算',
      description: '解决物理公式和计算',
      color: 'bg-red-100 text-red-800',
      icon: Zap,
      examples: [
        '自由落体：从50米高处落下需要多长时间？',
        '速度计算：汽车在2小时内行驶120公里，平均速度？',
        '功率计算：1000瓦的电器使用3小时消耗多少电能？',
      ],
    },
    general: {
      name: '通用问题',
      description: '其他需要程序解决的问题',
      color: 'bg-gray-100 text-gray-800',
      icon: Code,
      examples: [
        '文本处理：统计一段文字中各字母出现的频率',
        '数据分析：计算一组数据的平均值、中位数、众数',
        '算法问题：判断一个数是否为质数',
      ],
    },
  };

  const languages = {
    python: {
      name: 'Python',
      description: '使用Python语言生成代码',
      color: 'bg-yellow-100 text-yellow-800',
    },
    javascript: {
      name: 'JavaScript',
      description: '使用JavaScript语言生成代码',
      color: 'bg-blue-100 text-blue-800',
    },
  };

  const handleSubmit = async () => {
    if (request.question.trim().length === 0) {
      return;
    }

    setIsLoading(true);
    setResponse(null);
    setCurrentStep('');
    setGeneratedCode('');
    setReasoningSteps([]);
    setExecutionResult(null);

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/pal', {
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
                    setCurrentStep(`开始PAL推理 - ${data.domain}`);
                    break;
                  case 'code_generated':
                    setCurrentStep('程序代码生成完成');
                    setGeneratedCode(data.code);
                    break;
                  case 'reasoning_step':
                    setReasoningSteps((prev) => [...prev, data.step]);
                    setCurrentStep(`分析推理步骤 ${data.step.stepNumber}`);
                    break;
                  case 'execution_result':
                    setExecutionResult(data.result);
                    setCurrentStep('模拟执行完成');
                    break;
                  case 'final_result':
                    setResponse(data.result);
                    setCurrentStep('PAL推理完成！');
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
        console.error('PAL Error:', error);
        setCurrentStep(`错误: ${error.message}`);
      }
      setIsLoading(false);
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
      setCurrentStep('已停止PAL推理');
    }
  };

  const setExampleQuestion = (example: string) => {
    setRequest((prev) => ({ ...prev, question: example }));
  };

  return (
    <TestPageLayout
      title="PAL 程序辅助语言模型"
      description="将自然语言问题转换为程序代码推理，提供精确的计算和逻辑解决方案"
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
                  <Code className="h-5 w-5" />
                  PAL 工作原理
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-gray-600">
                  <p className="mb-4">
                    <strong>程序辅助语言模型（PAL）</strong>
                    是Gao等人（2022）提出的一种新方法，它让LLM读取自然语言问题并生成程序作为中间推理步骤，而不是使用自由形式文本获得解决方案。
                  </p>

                  <div className="space-y-3">
                    <div className="border-l-4 border-blue-500 pl-4">
                      <h4 className="font-semibold text-blue-700">
                        1. 问题理解
                      </h4>
                      <p>
                        LLM分析自然语言问题，识别需要解决的核心计算或逻辑任务。
                      </p>
                    </div>

                    <div className="border-l-4 border-green-500 pl-4">
                      <h4 className="font-semibold text-green-700">
                        2. 代码生成
                      </h4>
                      <p>
                        将解决步骤转换为可执行的程序代码，每步都有清晰的注释说明。
                      </p>
                    </div>

                    <div className="border-l-4 border-purple-500 pl-4">
                      <h4 className="font-semibold text-purple-700">
                        3. 程序执行
                      </h4>
                      <p>
                        通过编程运行时（如Python解释器）执行代码获得精确结果。
                      </p>
                    </div>

                    <div className="border-l-4 border-orange-500 pl-4">
                      <h4 className="font-semibold text-orange-700">
                        4. 结果返回
                      </h4>
                      <p>程序输出作为问题的最终答案，确保计算的准确性。</p>
                    </div>
                  </div>

                  <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-semibold text-blue-800 mb-2">
                      与CoT的区别
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-blue-700">
                      <div>
                        <strong>CoT（思维链）：</strong>
                        <ul className="list-disc list-inside space-y-1 mt-1">
                          <li>使用自然语言推理</li>
                          <li>步骤描述可能不精确</li>
                          <li>容易出现计算错误</li>
                          <li>适合概念性推理</li>
                        </ul>
                      </div>
                      <div>
                        <strong>PAL：</strong>
                        <ul className="list-disc list-inside space-y-1 mt-1">
                          <li>使用程序代码推理</li>
                          <li>计算步骤精确可验证</li>
                          <li>避免算术错误</li>
                          <li>适合计算性问题</li>
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
                        • <strong>数学计算</strong>
                        ：复杂数学公式、几何计算、统计分析
                      </li>
                      <li>
                        • <strong>日期处理</strong>：日期计算、时间差、日历操作
                      </li>
                      <li>
                        • <strong>逻辑推理</strong>
                        ：组合排列、条件判断、算法问题
                      </li>
                      <li>
                        • <strong>物理计算</strong>
                        ：物理公式、单位转换、科学计算
                      </li>
                      <li>
                        • <strong>数据处理</strong>
                        ：统计分析、数据转换、格式处理
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
                  <Brain className="h-5 w-5" />
                  问题配置
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="question">自然语言问题</Label>
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
                    className="min-h-[100px]"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="domain">问题领域</Label>
                    <Select
                      value={request.domain}
                      onValueChange={(value: PALRequest['domain']) =>
                        setRequest((prev) => ({ ...prev, domain: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(domains).map(([key, domain]) => {
                          const IconComponent = domain.icon;
                          return (
                            <SelectItem key={key} value={key}>
                              <div className="flex items-center gap-2">
                                <IconComponent className="h-4 w-4" />
                                <Badge className={domain.color}>
                                  {domain.name}
                                </Badge>
                                <span className="text-sm text-gray-600">
                                  {domain.description}
                                </span>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="language">编程语言</Label>
                    <Select
                      value={request.language}
                      onValueChange={(value: PALRequest['language']) =>
                        setRequest((prev) => ({ ...prev, language: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(languages).map(([key, lang]) => (
                          <SelectItem key={key} value={key}>
                            <div className="flex items-center gap-2">
                              <Badge className={lang.color}>{lang.name}</Badge>
                              <span className="text-sm text-gray-600">
                                {lang.description}
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
                          temperature: parseFloat(e.target.value) || 0.3,
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

                  <div className="space-y-2">
                    <Label>模拟执行</Label>
                    <div className="flex items-center space-x-2 pt-2">
                      <input
                        type="checkbox"
                        id="includeExecution"
                        checked={request.includeExecution}
                        onChange={(e) =>
                          setRequest((prev) => ({
                            ...prev,
                            includeExecution: e.target.checked,
                          }))
                        }
                        className="rounded"
                      />
                      <Label htmlFor="includeExecution" className="text-sm">
                        模拟代码执行结果
                      </Label>
                    </div>
                  </div>
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
                  {domains[request.domain].examples.map((example, index) => (
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
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 执行控制 */}
            <Card>
              <CardHeader>
                <CardTitle>开始PAL推理</CardTitle>
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
                      <span className="text-blue-700 font-medium">PAL状态</span>
                    </div>
                    {currentStep && (
                      <p className="text-blue-600">{currentStep}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 生成的代码 */}
            {generatedCode && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Code className="h-5 w-5" />
                    生成的{languages[request.language].name}代码
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm">
                    <code>{generatedCode}</code>
                  </pre>
                </CardContent>
              </Card>
            )}

            {/* 推理步骤 */}
            {reasoningSteps.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    程序推理步骤
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {reasoningSteps.map((step, index) => (
                    <div
                      key={step.stepNumber}
                      className="border border-gray-200 rounded-lg p-4"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline">步骤 {step.stepNumber}</Badge>
                        <span className="font-medium text-gray-700">
                          {step.description}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <div>
                          <Label className="text-sm font-medium text-gray-600">
                            代码
                          </Label>
                          <pre className="bg-gray-100 p-2 rounded text-sm mt-1 overflow-x-auto">
                            <code>{step.code}</code>
                          </pre>
                        </div>

                        <div>
                          <Label className="text-sm font-medium text-gray-600">
                            说明
                          </Label>
                          <p className="text-sm text-gray-600 mt-1">
                            {step.explanation}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* 执行结果 */}
            {executionResult && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    模拟执行结果
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="text-green-800 font-mono">
                      {executionResult}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 最终结果 */}
            {response && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-purple-600" />
                    PAL推理完成
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {response.reasoningSteps.length}
                      </div>
                      <div className="text-sm text-blue-700">推理步骤</div>
                    </div>

                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {response.language.toUpperCase()}
                      </div>
                      <div className="text-sm text-green-700">编程语言</div>
                    </div>

                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">
                        {response.domain}
                      </div>
                      <div className="text-sm text-purple-700">问题领域</div>
                    </div>

                    <div className="text-center p-3 bg-orange-50 rounded-lg">
                      <div className="text-2xl font-bold text-orange-600">
                        {(response.totalTime / 1000).toFixed(1)}s
                      </div>
                      <div className="text-sm text-orange-700">处理时间</div>
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium text-gray-800 mb-2">解释说明</h4>
                    <p className="text-sm text-gray-600">
                      {response.explanation}
                    </p>
                  </div>

                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-700">
                      💡 <strong>PAL优势</strong>
                      ：通过程序代码推理，确保了计算的精确性和逻辑的严密性，避免了传统文本推理中可能出现的计算错误。
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
