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
  Link,
  Workflow,
  FileText,
  Code,
  Database,
  BarChart3,
  Play,
  Eye,
  Settings,
  ArrowDown,
} from 'lucide-react';

interface PromptStep {
  id: string;
  name: string;
  systemMessage: string;
  promptTemplate: string;
  outputVariable: string;
  inputVariables?: string[];
}

interface PromptChainRequest {
  chainType:
    | 'document-qa'
    | 'text-analysis'
    | 'code-explanation'
    | 'data-processing'
    | 'custom';
  steps: PromptStep[];
  initialInputs: Record<string, string>;
  modelName?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

interface StepResult {
  stepId: string;
  stepName: string;
  input: string;
  output: string;
  variables: Record<string, string>;
  duration: number;
  tokens: number;
}

interface StreamMessage {
  type: string;
  message?: string;
  chainType?: string;
  totalSteps?: number;
  stepIndex?: number;
  stepId?: string;
  stepName?: string;
  stepResult?: StepResult;
  progress?: string;
  result?: any;
  error?: string;
}

export default function PromptChainingPage() {
  // State hooks
  const [selectedTemplate, setSelectedTemplate] =
    useState<string>('document-qa');
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [currentMessage, setCurrentMessage] = useState('');
  const [stepResults, setStepResults] = useState<StepResult[]>([]);
  const [finalResult, setFinalResult] = useState<any>(null);
  const [startTime, setStartTime] = useState<number>(0);
  const [showDemo, setShowDemo] = useState(true);

  // 输入数据
  const [inputs, setInputs] = useState<Record<string, string>>({
    document: '',
    question: '',
    text: '',
    code: '',
    data: '',
  });

  // Ref hooks
  const abortControllerRef = useRef<AbortController | null>(null);

  // 模板定义
  const templates = {
    'document-qa': {
      name: '文档问答',
      description: '先提取相关引文，再基于引文回答问题',
      icon: FileText,
      requiredInputs: ['document', 'question'],
      example: {
        document: `提示工程是一门相对较新的学科，关注提示词的开发和优化，来高效地使用语言模型（LM）处理各种应用和研究主题。提示工程技能有助于更好地了解大型语言模型（LLM）的能力和局限性。

常见的提示技术包括：
- 零样本提示（Zero-shot prompting）
- 少样本提示（Few-shot prompting）  
- 链式思考提示（Chain-of-thought prompting）
- 自我一致性（Self-consistency）
- 生成知识提示（Generate knowledge prompting）
- 思维树（Tree of thoughts）

这些技术可以帮助研究人员和开发者更好地设计提示词，提高模型在特定任务上的表现。`,
        question: '文档中提到了哪些提示技术？',
      },
    },
    'text-analysis': {
      name: '文本分析',
      description: '先提取主要主题，再进行详细分析',
      icon: BarChart3,
      requiredInputs: ['text'],
      example: {
        text: `人工智能的发展正在改变我们的生活方式。从智能手机的语音助手到自动驾驶汽车，AI技术已经渗透到各个领域。在医疗行业，AI帮助诊断疾病和发现新药；在教育领域，个性化学习平台提供定制化的学习体验；在金融服务中，AI用于风险评估和欺诈检测。

然而，AI的快速发展也带来了挑战。就业市场可能受到冲击，隐私和数据安全问题日益突出，算法偏见可能导致不公平的结果。因此，我们需要在推动AI创新的同时，建立相应的伦理规范和监管框架，确保AI技术能够造福全人类。`,
      },
    },
    'code-explanation': {
      name: '代码解释',
      description: '先提取关键代码部分，再详细解释工作原理',
      icon: Code,
      requiredInputs: ['code'],
      example: {
        code: `def fibonacci(n):
    """计算斐波那契数列的第n项"""
    if n <= 0:
        return 0
    elif n == 1:
        return 1
    else:
        # 使用递归计算
        return fibonacci(n-1) + fibonacci(n-2)

def fibonacci_optimized(n):
    """优化版本的斐波那契数列计算"""
    if n <= 0:
        return 0
    elif n == 1:
        return 1
    
    # 使用迭代避免重复计算
    a, b = 0, 1
    for i in range(2, n + 1):
        a, b = b, a + b
    return b

# 测试两种实现
print(f"递归版本: {fibonacci(10)}")
print(f"优化版本: {fibonacci_optimized(10)}")`,
      },
    },
    'data-processing': {
      name: '数据处理',
      description: '先进行数据清洗，再执行数据分析',
      icon: Database,
      requiredInputs: ['data'],
      example: {
        data: `name,age,salary,department
张三,28,8000,技术部
李四,,9000,销售部
王五,35,12000,技术部
赵六,42,15000,
孙七,29,7500,销售部
周八,31,,技术部
吴九,38,11000,市场部
郑十,25,6000,销售部`,
      },
    },
  };

  // 更新输入数据
  const updateInput = (key: string, value: string) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  // 处理模板选择
  const handleTemplateSelect = (templateKey: string) => {
    setSelectedTemplate(templateKey);
    const template = templates[templateKey as keyof typeof templates];

    // 填入示例数据
    const newInputs = { ...inputs };
    if (template.example) {
      Object.entries(template.example).forEach(([key, value]) => {
        newInputs[key] = value;
      });
    }
    setInputs(newInputs);
    setShowDemo(false);
  };

  // 提交处理
  const handleSubmit = async () => {
    const template = templates[selectedTemplate as keyof typeof templates];

    // 检查必需输入
    for (const requiredInput of template.requiredInputs) {
      if (!inputs[requiredInput]?.trim()) {
        alert(`请填写 ${requiredInput} 字段`);
        return;
      }
    }

    setIsLoading(true);
    setCurrentStep(0);
    setTotalSteps(0);
    setCurrentMessage('准备执行链式提示...');
    setStepResults([]);
    setFinalResult(null);
    setStartTime(Date.now());

    // 创建取消控制器
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      // 构建请求数据
      const requestData: PromptChainRequest = {
        chainType: selectedTemplate as any,
        steps: [], // API会自动填充模板
        initialInputs: inputs,
        modelName: 'gpt-3.5-turbo',
        temperature: 0.7,
        maxTokens: 2000,
        stream: true,
      };

      const response = await fetch('/api/prompt-chaining', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
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
                    setTotalSteps(data.totalSteps || 0);
                    break;

                  case 'step_start':
                    setCurrentStep(data.stepIndex || 0);
                    setCurrentMessage(data.message || '');
                    break;

                  case 'step_complete':
                    if (data.stepResult) {
                      setStepResults((prev) => [...prev, data.stepResult!]);
                    }
                    break;

                  case 'step_error':
                    setCurrentMessage(data.error || '步骤执行失败');
                    break;

                  case 'final_result':
                    setFinalResult(data.result);
                    setCurrentMessage('链式提示执行完成！');
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
        console.error('Prompt Chaining Error:', error);
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
    setTotalSteps(0);
    setCurrentMessage('');
    setStepResults([]);
    setFinalResult(null);
    setInputs({
      document: '',
      question: '',
      text: '',
      code: '',
      data: '',
    });
  };

  const selectedTemplateData =
    templates[selectedTemplate as keyof typeof templates];
  const isValid = selectedTemplateData.requiredInputs.every((input) =>
    inputs[input]?.trim()
  );

  return (
    <TestPageLayout
      title="链式提示 (Prompt Chaining)"
      description="将复杂任务分解为多个子任务，通过提示链逐步完成，提高可控性和可靠性"
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
                    <Link className="h-5 w-5 text-blue-600" />
                    什么是链式提示？
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-gray-600">
                    链式提示（Prompt
                    Chaining）是一种将复杂任务分解为多个子任务的技术。
                    每个子任务使用单独的提示词，前一个任务的输出作为下一个任务的输入，
                    形成一个处理链条。
                  </p>
                  <div className="space-y-2">
                    <h4 className="font-medium">核心优势：</h4>
                    <ul className="text-sm space-y-1 text-gray-600">
                      <li>• 提高复杂任务的处理质量</li>
                      <li>• 增强过程的透明度和可控性</li>
                      <li>• 便于调试和优化各个环节</li>
                      <li>• 提高系统的可靠性</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Workflow className="h-5 w-5 text-green-600" />
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
                        <p className="font-medium text-sm">任务分解</p>
                        <p className="text-xs text-gray-600">
                          将复杂任务拆分为简单子任务
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className="mt-1">
                        2
                      </Badge>
                      <div>
                        <p className="font-medium text-sm">序列执行</p>
                        <p className="text-xs text-gray-600">
                          按顺序执行每个子任务
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className="mt-1">
                        3
                      </Badge>
                      <div>
                        <p className="font-medium text-sm">结果传递</p>
                        <p className="text-xs text-gray-600">
                          前一步输出作为下一步输入
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-purple-600" />
                    应用场景
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-2 text-sm">
                    <div className="p-2 bg-blue-50 rounded text-blue-800">
                      文档问答系统
                    </div>
                    <div className="p-2 bg-green-50 rounded text-green-800">
                      内容分析处理
                    </div>
                    <div className="p-2 bg-purple-50 rounded text-purple-800">
                      代码解释说明
                    </div>
                    <div className="p-2 bg-orange-50 rounded text-orange-800">
                      数据处理流程
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    设计原则
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm space-y-2 text-gray-600">
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                      单一职责：每个步骤专注一个任务
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                      清晰接口：明确输入输出格式
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                      错误处理：每步都要考虑失败情况
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                      可观测性：过程可监控和调试
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 实践测试 */}
          <TabsContent value="test" className="space-y-6">
            {/* 模板选择 */}
            {showDemo && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    选择链式提示模板
                  </CardTitle>
                  <CardDescription>
                    选择一个预定义的链式提示模板来体验多步骤处理
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4">
                    {Object.entries(templates).map(([key, template]) => {
                      const Icon = template.icon;
                      return (
                        <Card
                          key={key}
                          className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-blue-200"
                          onClick={() => handleTemplateSelect(key)}
                        >
                          <CardContent className="p-4">
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <Icon className="h-5 w-5 text-blue-600" />
                                <Badge variant="outline">{template.name}</Badge>
                              </div>
                              <p className="text-sm text-gray-600">
                                {template.description}
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
              {/* 左侧：输入配置 */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      {selectedTemplateData.name}
                    </CardTitle>
                    <CardDescription>
                      {selectedTemplateData.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {selectedTemplateData.requiredInputs.map((inputKey) => (
                      <div key={inputKey} className="space-y-2">
                        <Label htmlFor={inputKey} className="capitalize">
                          {inputKey === 'document'
                            ? '文档内容'
                            : inputKey === 'question'
                              ? '问题'
                              : inputKey === 'text'
                                ? '文本内容'
                                : inputKey === 'code'
                                  ? '代码'
                                  : inputKey === 'data'
                                    ? '数据'
                                    : inputKey}
                        </Label>
                        <Textarea
                          id={inputKey}
                          placeholder={`请输入${
                            inputKey === 'document'
                              ? '文档内容'
                              : inputKey === 'question'
                                ? '问题'
                                : inputKey === 'text'
                                  ? '文本内容'
                                  : inputKey === 'code'
                                    ? '代码'
                                    : inputKey === 'data'
                                      ? '数据'
                                      : inputKey
                          }...`}
                          value={inputs[inputKey] || ''}
                          onChange={(e) =>
                            updateInput(inputKey, e.target.value)
                          }
                          rows={inputKey === 'question' ? 2 : 6}
                          className="resize-none font-mono text-sm"
                        />
                      </div>
                    ))}

                    <div className="flex gap-2 pt-4">
                      <Button
                        onClick={handleSubmit}
                        disabled={!isValid || isLoading}
                        className="flex-1"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            执行中...
                          </>
                        ) : (
                          <>
                            <Play className="mr-2 h-4 w-4" />
                            开始执行
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

              {/* 右侧：执行过程和结果 */}
              <div className="space-y-6">
                {/* 执行进度 */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="flex items-center gap-2">
                      <Workflow className="h-5 w-5" />
                      执行进度
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
                        <span>当前步骤</span>
                        <span>
                          {currentStep} / {totalSteps}
                        </span>
                      </div>

                      {totalSteps > 0 && (
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{
                              width: `${(currentStep / totalSteps) * 100}%`,
                            }}
                          />
                        </div>
                      )}

                      {currentMessage && (
                        <div className="text-sm text-blue-600 p-2 bg-blue-50 rounded">
                          {currentMessage}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* 步骤结果 */}
                {stepResults.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Eye className="h-5 w-5" />
                        执行步骤
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {stepResults.map((step, index) => (
                          <div
                            key={step.stepId}
                            className="border rounded-lg p-3 space-y-2"
                          >
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">
                                  步骤 {index + 1}
                                </Badge>
                                <span className="font-medium text-sm">
                                  {step.stepName}
                                </span>
                              </div>
                              <div className="flex gap-2 text-xs text-gray-500">
                                <span>{step.duration}ms</span>
                                <span>{step.tokens} tokens</span>
                              </div>
                            </div>

                            <div className="text-sm">
                              <div className="font-medium text-green-600 mb-1">
                                输出:
                              </div>
                              <div className="bg-gray-50 rounded p-2 text-xs max-h-20 overflow-y-auto">
                                {step.output}
                              </div>
                            </div>

                            {index < stepResults.length - 1 && (
                              <div className="flex justify-center">
                                <ArrowDown className="h-4 w-4 text-gray-400" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 最终结果 */}
                {finalResult && (
                  <Card className="border-green-200">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-green-700">
                        <CheckCircle className="h-5 w-5" />
                        最终结果
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="p-3 bg-green-50 rounded-lg">
                        <h4 className="font-medium text-green-900 mb-2">
                          处理结果:
                        </h4>
                        <div className="text-green-800 text-sm whitespace-pre-wrap">
                          {finalResult.finalResult}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">总步骤: </span>
                          <span>{finalResult.steps?.length || 0}</span>
                        </div>
                        <div>
                          <span className="font-medium">总耗时: </span>
                          <span>{finalResult.totalTime}ms</span>
                        </div>
                        <div>
                          <span className="font-medium">总Token: </span>
                          <span>{finalResult.totalTokens}</span>
                        </div>
                        <div>
                          <span className="font-medium">链式类型: </span>
                          <span>{selectedTemplateData.name}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 空状态 */}
                {!isLoading && stepResults.length === 0 && !finalResult && (
                  <Card>
                    <CardContent className="flex items-center justify-center h-40 text-gray-400">
                      <div className="text-center">
                        <Link className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>等待开始执行链式提示...</p>
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
