'use client';

import { useState, useRef } from 'react';
import TestPageLayout from '@/components/TestPageLayout';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
  Brain,
  Lightbulb,
  Target,
  Calculator,
  Book,
  Puzzle,
  Play,
  Square,
  RotateCcw,
  Settings,
  Copy,
  Download,
} from 'lucide-react';
import { Streamdown } from 'streamdown';

// CoT模板定义
const COT_TEMPLATES = [
  {
    id: 'math-problem',
    name: '数学推理',
    prompt:
      '请逐步解决这个数学问题：{问题}\n\n请按照以下步骤：\n1. 理解问题：明确题目要求\n2. 分析条件：列出已知条件\n3. 制定策略：选择解题方法\n4. 逐步计算：展示每一步推理过程\n5. 验证答案：检查结果是否合理',
    complexity: 'medium',
    domain: '数学',
    icon: Calculator,
  },
  {
    id: 'logic-reasoning',
    name: '逻辑推理',
    prompt:
      '请分析这个逻辑问题：{问题}\n\n请按照以下思路：\n1. 问题分析：识别关键信息和逻辑关系\n2. 假设验证：逐一验证可能的答案\n3. 推理过程：展示逻辑推导步骤\n4. 结论验证：确保结论的合理性',
    complexity: 'complex',
    domain: '逻辑学',
    icon: Puzzle,
  },
  {
    id: 'scientific-reasoning',
    name: '科学推理',
    prompt:
      '请分析这个科学现象：{现象}\n\n请按照科学方法：\n1. 观察现象：描述观察到的现象\n2. 提出假设：基于现有知识提出可能的解释\n3. 理论分析：运用相关科学理论进行分析\n4. 推理过程：展示逻辑推导\n5. 结论总结：得出科学结论',
    complexity: 'complex',
    domain: '科学',
    icon: Book,
  },
];

// 示例问题
const EXAMPLE_QUESTIONS = [
  {
    title: '数学应用题',
    question:
      '一个水池有两个进水管和一个排水管。甲管单独灌满需要6小时，乙管单独灌满需要8小时，排水管单独排空需要12小时。如果三管同时开启，多长时间能灌满水池？',
    category: '数学',
  },
  {
    title: '逻辑推理题',
    question:
      '在一个逻辑谜题中，有三个人：张三总是说真话，李四总是说假话，王五有时说真话有时说假话。现在他们中的一人说："我不是张三"，请问这句话是谁说的？',
    category: '逻辑',
  },
  {
    title: '科学现象',
    question: '为什么天空是蓝色的？请用科学原理解释这个现象。',
    category: '科学',
  },
];

export default function CoTPage() {
  const [question, setQuestion] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [complexity, setComplexity] = useState('medium');
  const [domain, setDomain] = useState('通用');
  const [temperature, setTemperature] = useState(0.3);
  const [modelName, setModelName] = useState('gpt-4');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState('');
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 应用模板
  const applyTemplate = (templateId: string) => {
    const template = COT_TEMPLATES.find((t) => t.id === templateId);
    if (template) {
      setQuestion(template.prompt);
      setComplexity(template.complexity);
      setDomain(template.domain);
      setSelectedTemplate(templateId);
    }
  };

  // 应用示例问题
  const applyExample = (example: (typeof EXAMPLE_QUESTIONS)[0]) => {
    setQuestion(example.question);
    setDomain(example.category);
  };

  // 开始推理
  const handleStartReasoning = async () => {
    if (!question.trim()) {
      alert('请输入问题');
      return;
    }

    setIsLoading(true);
    setResponse('');
    setExecutionTime(null);
    const startTime = Date.now();

    try {
      abortControllerRef.current = new AbortController();

      const requestBody = {
        prompt: question,
        complexity,
        domain,
        temperature,
        modelName,
        stream: true,
      };

      const response = await fetch('/api/prompt/cot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('无法读取响应流');
      }

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ') && line.trim() !== 'data: ') {
            try {
              const jsonData = line.slice(6).trim();
              if (jsonData) {
                const data = JSON.parse(jsonData);

                if (data.content) {
                  // 实时追加内容，不是替换
                  setResponse((prev) => prev + data.content);
                }

                if (data.done) {
                  setExecutionTime(Date.now() - startTime);
                  setIsLoading(false);
                }
              }
            } catch (e) {
              console.warn('解析流式数据失败:', e, '原始数据:', line);
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        setResponse(`❌ **错误**: ${error.message}`);
        setIsLoading(false);
      }
    }
  };

  // 停止推理
  const handleStopReasoning = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsLoading(false);
  };

  // 清空内容
  const handleClear = () => {
    setQuestion('');
    setResponse('');
    setSelectedTemplate('');
    setExecutionTime(null);
  };

  // 复制结果
  const handleCopyResult = () => {
    navigator.clipboard.writeText(response);
    alert('结果已复制到剪贴板');
  };

  return (
    <TestPageLayout
      title="链式思考 (Chain of Thought)"
      description="通过逐步推理的方式解决复杂问题，提高AI推理的准确性和可解释性"
    >
      <div className="p-6 space-y-6">
        {/* 方法介绍 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-blue-600" />
              什么是链式思考 (CoT)？
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-700">
              链式思考是一种prompting技术，通过引导AI模型逐步展示推理过程，
              将复杂问题分解为多个中间步骤，从而提高推理准确性和结果的可解释性。
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg">
                <Target className="h-6 w-6 text-green-600 mb-2" />
                <h4 className="font-medium mb-1">提高准确性</h4>
                <p className="text-sm text-gray-600">通过逐步推理减少错误</p>
              </div>
              <div className="p-4 border rounded-lg">
                <Lightbulb className="h-6 w-6 text-yellow-600 mb-2" />
                <h4 className="font-medium mb-1">增强可解释性</h4>
                <p className="text-sm text-gray-600">展示完整的思维过程</p>
              </div>
              <div className="p-4 border rounded-lg">
                <Puzzle className="h-6 w-6 text-purple-600 mb-2" />
                <h4 className="font-medium mb-1">处理复杂问题</h4>
                <p className="text-sm text-gray-600">分解复杂推理任务</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左侧：输入和控制 */}
          <div className="space-y-6">
            {/* 模板选择 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">🧩 推理模板</CardTitle>
                <CardDescription>选择预定义的推理模板快速开始</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3">
                  {COT_TEMPLATES.map((template) => {
                    const Icon = template.icon;
                    return (
                      <div
                        key={template.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedTemplate === template.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'hover:border-gray-300'
                        }`}
                        onClick={() => applyTemplate(template.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-blue-600" />
                            <span className="font-medium">{template.name}</span>
                          </div>
                          <Badge variant="secondary">{template.domain}</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* 示例问题 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">💡 示例问题</CardTitle>
                <CardDescription>点击应用示例问题</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {EXAMPLE_QUESTIONS.map((example, index) => (
                    <div
                      key={index}
                      className="p-3 border rounded-lg cursor-pointer hover:border-gray-300 transition-colors"
                      onClick={() => applyExample(example)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-sm">{example.title}</h4>
                        <Badge variant="outline" className="text-xs">
                          {example.category}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-600 line-clamp-2">
                        {example.question}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 问题输入 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">📝 问题输入</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="question">问题或现象</Label>
                  <Textarea
                    id="question"
                    placeholder="请输入需要推理分析的问题或现象..."
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    rows={6}
                    className="mt-1"
                  />
                </div>

                {/* 参数设置 */}
                <Tabs defaultValue="basic" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="basic">基础设置</TabsTrigger>
                    <TabsTrigger value="advanced">高级设置</TabsTrigger>
                  </TabsList>

                  <TabsContent value="basic" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="complexity">推理复杂度</Label>
                        <Select
                          value={complexity}
                          onValueChange={setComplexity}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="simple">
                              Simple (1-2步)
                            </SelectItem>
                            <SelectItem value="medium">
                              Medium (3-5步)
                            </SelectItem>
                            <SelectItem value="complex">
                              Complex (6+步)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="domain">领域</Label>
                        <Select value={domain} onValueChange={setDomain}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="通用">通用</SelectItem>
                            <SelectItem value="数学">数学</SelectItem>
                            <SelectItem value="逻辑学">逻辑学</SelectItem>
                            <SelectItem value="科学">科学</SelectItem>
                            <SelectItem value="管理学">管理学</SelectItem>
                            <SelectItem value="创新学">创新学</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="advanced" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="temperature">
                          温度 ({temperature})
                        </Label>
                        <Input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={temperature}
                          onChange={(e) =>
                            setTemperature(Number(e.target.value))
                          }
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="model">模型</Label>
                        <Select value={modelName} onValueChange={setModelName}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="gpt-4">GPT-4</SelectItem>
                            <SelectItem value="gpt-3.5-turbo">
                              GPT-3.5 Turbo
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>

                {/* 控制按钮 */}
                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={handleStartReasoning}
                    disabled={isLoading || !question.trim()}
                    className="flex-1"
                  >
                    {isLoading ? (
                      <>
                        <Square className="h-4 w-4 mr-2" />
                        推理中...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        开始推理
                      </>
                    )}
                  </Button>

                  {isLoading && (
                    <Button variant="outline" onClick={handleStopReasoning}>
                      <Square className="h-4 w-4" />
                    </Button>
                  )}

                  <Button variant="outline" onClick={handleClear}>
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 右侧：结果展示 */}
          <div className="space-y-6">
            <Card className="h-full">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">🎯 推理结果</CardTitle>
                    {executionTime && (
                      <CardDescription>
                        执行时间: {(executionTime / 1000).toFixed(2)}秒
                      </CardDescription>
                    )}
                  </div>
                  {response && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopyResult}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {response ? (
                  <div className="prose prose-sm max-w-none">
                    <Streamdown
                      parseIncompleteMarkdown={true}
                      className="streamdown-cot"
                      allowedImagePrefixes={['*']}
                      allowedLinkPrefixes={['*']}
                    >
                      {response}
                    </Streamdown>
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-12">
                    <Brain className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>输入问题并点击"开始推理"查看链式思考过程</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* 最佳实践提示 */}
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-lg">💡 CoT 最佳实践</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  推理提示技巧
                </h4>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li>
                    • <strong>明确步骤</strong>：在问题中列出明确的推理步骤
                  </li>
                  <li>
                    • <strong>逐步引导</strong>
                    ：使用"首先"、"然后"、"接下来"等连接词
                  </li>
                  <li>
                    • <strong>要求解释</strong>：明确要求AI解释每个推理步骤
                  </li>
                  <li>
                    • <strong>验证环节</strong>：加入结果验证和合理性检查
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  参数建议
                </h4>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li>
                    • <strong>温度设置</strong>
                    ：使用较低温度(0.2-0.4)保证推理一致性
                  </li>
                  <li>
                    • <strong>模型选择</strong>：推荐使用GPT-4等强推理能力模型
                  </li>
                  <li>
                    • <strong>复杂度控制</strong>
                    ：根据问题难度选择合适的步骤数量
                  </li>
                  <li>
                    • <strong>领域专业性</strong>
                    ：选择合适的领域以获得更专业的分析
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </TestPageLayout>
  );
}
