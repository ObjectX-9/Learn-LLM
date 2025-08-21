'use client';

import { useState, useRef, useEffect } from 'react';
import { Streamdown } from 'streamdown';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Settings,
  Play,
  Square,
  Share,
  Download,
  RotateCcw,
  Star,
  MessageSquare,
} from 'lucide-react';

interface PromptTestRequest {
  prompt: string;
  systemMessage?: string;
  temperature?: number;
  maxTokens?: number;
  modelName?: string;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stream?: boolean;
  responseFormat?:
    | 'text'
    | 'json'
    | 'markdown'
    | 'html'
    | 'table'
    | 'code'
    | 'score';
  testType?: string;
}

interface TestResult {
  id: string;
  timestamp: number;
  request: PromptTestRequest;
  response: string;
  score?: number;
  notes?: string;
  duration?: number;
}

interface PromptTemplate {
  id: string;
  name: string;
  prompt: string;
  systemMessage?: string;
  responseFormat: string;
  description: string;
}

interface PromptTestBaseProps {
  testType: string;
  title: string;
  description: string;
  templates: PromptTemplate[];
  defaultResponseFormat?: string;
  children?: React.ReactNode;
}

export default function PromptTestBase({
  testType,
  title,
  description,
  templates,
  defaultResponseFormat = 'text',
  children,
}: PromptTestBaseProps) {
  const [request, setRequest] = useState<PromptTestRequest>({
    prompt: '',
    systemMessage: '',
    temperature: 0.7,
    maxTokens: 2000,
    modelName: 'gpt-3.5-turbo',
    topP: 1,
    frequencyPenalty: 0,
    presencePenalty: 0,
    stream: true,
    responseFormat: defaultResponseFormat as any,
    testType: testType,
  });

  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<TestResult[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [currentScore, setCurrentScore] = useState<number>(0);
  const [currentNotes, setCurrentNotes] = useState('');

  const abortControllerRef = useRef<AbortController | null>(null);

  // 加载历史记录
  useEffect(() => {
    const savedHistory = localStorage.getItem(
      `prompt-test-history-${testType}`
    );
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }
  }, [testType]);

  // 保存历史记录
  const saveToHistory = (result: TestResult) => {
    const newHistory = [result, ...history].slice(0, 50); // 保留最近50条
    setHistory(newHistory);
    localStorage.setItem(
      `prompt-test-history-${testType}`,
      JSON.stringify(newHistory)
    );
  };

  // 应用模板
  const applyTemplate = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setRequest((prev) => ({
        ...prev,
        prompt: template.prompt,
        systemMessage: template.systemMessage || '',
        responseFormat: template.responseFormat as any,
      }));
      setSelectedTemplate(templateId);
    }
  };

  // 发送请求
  const handleSubmit = async () => {
    if (!request.prompt.trim()) return;

    setIsLoading(true);
    setResponse('');
    const startTime = Date.now();

    try {
      abortControllerRef.current = new AbortController();

      const response = await fetch('/api/prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (request.stream) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';

        while (reader) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.content) {
                  fullResponse += data.content;
                  setResponse(fullResponse);
                }
                if (data.done) {
                  const duration = Date.now() - startTime;
                  const result: TestResult = {
                    id: Date.now().toString(),
                    timestamp: Date.now(),
                    request: { ...request },
                    response: fullResponse,
                    duration,
                  };
                  saveToHistory(result);
                }
              } catch (e) {
                // 忽略解析错误
              }
            }
          }
        }
      } else {
        const data = await response.json();
        const duration = Date.now() - startTime;
        setResponse(data.content);

        const result: TestResult = {
          id: Date.now().toString(),
          timestamp: Date.now(),
          request: { ...request },
          response: data.content,
          duration,
        };
        saveToHistory(result);
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        setResponse(`错误: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 停止生成
  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  };

  // 评分和备注
  const saveScoreAndNotes = (resultId: string) => {
    const updatedHistory = history.map((item) =>
      item.id === resultId
        ? { ...item, score: currentScore, notes: currentNotes }
        : item
    );
    setHistory(updatedHistory);
    localStorage.setItem(
      `prompt-test-history-${testType}`,
      JSON.stringify(updatedHistory)
    );
    setCurrentScore(0);
    setCurrentNotes('');
  };

  // 分享模板
  const shareTemplate = () => {
    const template = {
      name: '自定义模板',
      prompt: request.prompt,
      systemMessage: request.systemMessage,
      testType: request.testType,
      responseFormat: request.responseFormat,
      parameters: {
        temperature: request.temperature,
        maxTokens: request.maxTokens,
        topP: request.topP,
        frequencyPenalty: request.frequencyPenalty,
        presencePenalty: request.presencePenalty,
      },
    };

    navigator.clipboard.writeText(JSON.stringify(template, null, 2));
    alert('模板已复制到剪贴板！');
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 页面头部 */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>

      <Tabs defaultValue="test" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="test">测试</TabsTrigger>
          <TabsTrigger value="templates">模板</TabsTrigger>
          <TabsTrigger value="history">历史</TabsTrigger>
        </TabsList>

        <TabsContent value="test" className="space-y-6">
          {/* 自定义内容区域 */}
          {children}

          {/* 基础配置 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                测试配置
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="responseFormat">返回格式</Label>
                  <Select
                    value={request.responseFormat}
                    onValueChange={(value) =>
                      setRequest((prev) => ({
                        ...prev,
                        responseFormat: value as any,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">纯文本</SelectItem>
                      <SelectItem value="json">JSON格式</SelectItem>
                      <SelectItem value="markdown">Markdown</SelectItem>
                      <SelectItem value="html">HTML</SelectItem>
                      <SelectItem value="table">表格格式</SelectItem>
                      <SelectItem value="code">代码块</SelectItem>
                      <SelectItem value="score">评分格式</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="model">模型选择</Label>
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
                      <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* 高级设置 */}
              <div className="space-y-4">
                <Button
                  variant="outline"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  {showAdvanced ? '隐藏高级设置' : '显示高级设置'}
                </Button>

                {showAdvanced && (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                          <Label>温度值: {request.temperature}</Label>
                          <Input
                            type="range"
                            min="0"
                            max="2"
                            step="0.1"
                            value={request.temperature}
                            onChange={(e) =>
                              setRequest((prev) => ({
                                ...prev,
                                temperature: parseFloat(e.target.value),
                              }))
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>最大Token: {request.maxTokens}</Label>
                          <Input
                            type="range"
                            min="100"
                            max="4000"
                            step="100"
                            value={request.maxTokens}
                            onChange={(e) =>
                              setRequest((prev) => ({
                                ...prev,
                                maxTokens: parseInt(e.target.value),
                              }))
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Top-p: {request.topP}</Label>
                          <Input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={request.topP}
                            onChange={(e) =>
                              setRequest((prev) => ({
                                ...prev,
                                topP: parseFloat(e.target.value),
                              }))
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>频率惩罚: {request.frequencyPenalty}</Label>
                          <Input
                            type="range"
                            min="-2"
                            max="2"
                            step="0.1"
                            value={request.frequencyPenalty}
                            onChange={(e) =>
                              setRequest((prev) => ({
                                ...prev,
                                frequencyPenalty: parseFloat(e.target.value),
                              }))
                            }
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 输入区域 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>系统消息</CardTitle>
                <CardDescription>
                  设定AI的角色和行为方式（可选）
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={request.systemMessage}
                  onChange={(e) =>
                    setRequest((prev) => ({
                      ...prev,
                      systemMessage: e.target.value,
                    }))
                  }
                  placeholder="例如：你是一个专业的写作助手..."
                  className="min-h-[100px]"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Prompt 内容 *</CardTitle>
                <CardDescription>输入你要测试的 Prompt</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={request.prompt}
                  onChange={(e) =>
                    setRequest((prev) => ({ ...prev, prompt: e.target.value }))
                  }
                  placeholder="输入你的prompt..."
                  className="min-h-[100px]"
                />
              </CardContent>
            </Card>
          </div>

          {/* 操作按钮 */}
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <Button
                onClick={handleSubmit}
                disabled={isLoading || !request.prompt.trim()}
                className="min-w-[120px]"
              >
                {isLoading ? (
                  <>
                    <Square className="mr-2 h-4 w-4" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    开始测试
                  </>
                )}
              </Button>

              {isLoading && (
                <Button variant="destructive" onClick={handleStop}>
                  <Square className="mr-2 h-4 w-4" />
                  停止
                </Button>
              )}

              <Button variant="outline" onClick={shareTemplate}>
                <Share className="mr-2 h-4 w-4" />
                分享模板
              </Button>
            </div>
          </div>

          {/* 结果显示 */}
          {response && (
            <Card>
              <CardHeader>
                <CardTitle>测试结果</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-y-auto border rounded-md p-4 bg-muted/50">
                  {request.responseFormat === 'markdown' ? (
                    <Streamdown>{response}</Streamdown>
                  ) : (
                    <pre className="whitespace-pre-wrap text-sm">
                      {response}
                    </pre>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>预设模板</CardTitle>
              <CardDescription>选择一个模板快速开始测试</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map((template) => (
                  <Card
                    key={template.id}
                    className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                      selectedTemplate === template.id
                        ? 'ring-2 ring-primary'
                        : ''
                    }`}
                    onClick={() => applyTemplate(template.id)}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">
                        {template.name}
                      </CardTitle>
                      <Badge variant="secondary" className="w-fit">
                        {template.responseFormat}
                      </Badge>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        {template.description}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>测试历史</CardTitle>
              <CardDescription>查看最近的测试记录</CardDescription>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  还没有测试记录
                </p>
              ) : (
                <div className="space-y-4">
                  {history.slice(0, 10).map((item) => (
                    <Card key={item.id} className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div className="text-sm text-muted-foreground">
                            {new Date(item.timestamp).toLocaleString()} |{' '}
                            {item.request.responseFormat} | {item.duration}ms
                          </div>
                          <p className="text-sm font-medium mt-1">
                            {item.request.prompt.slice(0, 100)}
                            {item.request.prompt.length > 100 && '...'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.score && (
                            <Badge variant="secondary">
                              <Star className="mr-1 h-3 w-3" />
                              {item.score}/10
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setRequest(item.request);
                              setResponse(item.response);
                            }}
                          >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            重新加载
                          </Button>
                        </div>
                      </div>

                      {/* 评分和备注 */}
                      <div className="flex gap-2 mt-3">
                        <Input
                          type="number"
                          min="1"
                          max="10"
                          placeholder="评分"
                          value={currentScore || ''}
                          onChange={(e) =>
                            setCurrentScore(parseInt(e.target.value))
                          }
                          className="w-20"
                        />
                        <Input
                          placeholder="备注..."
                          value={currentNotes}
                          onChange={(e) => setCurrentNotes(e.target.value)}
                          className="flex-1"
                        />
                        <Button
                          size="sm"
                          onClick={() => saveScoreAndNotes(item.id)}
                        >
                          保存
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
