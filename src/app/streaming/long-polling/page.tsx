'use client';

import { useState, useRef, useEffect } from 'react';
import { Streamdown } from 'streamdown';
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
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Clock,
  Play,
  Square,
  RotateCcw,
  Copy,
  Timer,
  Activity,
  CheckCircle,
  AlertCircle,
  Info,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';

interface PollingMessage {
  id: string;
  type: 'info' | 'data' | 'success' | 'error' | 'polling';
  content: string;
  timestamp: number;
  sequence?: number;
}

const pollingExamples = [
  {
    id: 'text-polling',
    name: '文本长轮询',
    description: 'Long Polling文本数据演示',
    endpoint: '/api/streaming/long-polling',
    method: 'GET',
    icon: '📝',
  },
  {
    id: 'ai-chat',
    name: 'AI对话轮询',
    description: 'AI聊天内容的长轮询',
    endpoint: '/api/streaming/long-polling',
    method: 'POST',
    icon: '🤖',
  },
  {
    id: 'data-stream',
    name: '数据流轮询',
    description: '实时数据的长轮询推送',
    endpoint: '/api/streaming/long-polling',
    method: 'GET',
    icon: '📊',
  },
  {
    id: 'notification',
    name: '通知轮询',
    description: '系统通知的长轮询',
    endpoint: '/api/streaming/long-polling',
    method: 'GET',
    icon: '🔔',
  },
  {
    id: 'log-stream',
    name: '日志轮询',
    description: '实时日志的长轮询',
    endpoint: '/api/streaming/long-polling',
    method: 'POST',
    icon: '📋',
  },
];

export default function LongPollingPage() {
  const [isPolling, setIsPolling] = useState(false);
  const [messages, setMessages] = useState<PollingMessage[]>([]);
  const [customMessage, setCustomMessage] = useState(
    '请介绍一下Long Polling技术的优缺点和适用场景'
  );
  const [selectedExample, setSelectedExample] = useState('ai-chat');
  const [pollingStatus, setPollingStatus] = useState<
    'idle' | 'polling' | 'completed' | 'error'
  >('idle');
  const [stats, setStats] = useState({
    pollsCount: 0,
    messagesReceived: 0,
    duration: 0,
    avgResponseTime: 0,
  });
  const [streamingContent, setStreamingContent] = useState('');

  const pollingControllerRef = useRef<AbortController | null>(null);
  const clientIdRef = useRef<string>('');
  const sequenceRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const responseTimes = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      if (pollingControllerRef.current) {
        pollingControllerRef.current.abort();
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, []);

  const addMessage = (
    type: PollingMessage['type'],
    content: string,
    sequence?: number
  ) => {
    const message: PollingMessage = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      type,
      content,
      timestamp: Date.now(),
      sequence,
    };
    setMessages((prev) => [...prev, message]);
    setStats((prev) => ({
      ...prev,
      messagesReceived: prev.messagesReceived + 1,
    }));
  };

  const performLongPolling = async () => {
    console.log('🔄 performLongPolling called');
    // 检查AbortController而不是isPolling状态
    if (
      !pollingControllerRef.current ||
      pollingControllerRef.current.signal.aborted
    ) {
      console.log('⚠️ 轮询已取消，退出performLongPolling');
      return;
    }

    const pollStartTime = Date.now();

    try {
      const example = pollingExamples.find((ex) => ex.id === selectedExample);
      if (!example) return;

      let url = example.endpoint;
      let requestInit: RequestInit = {
        signal: pollingControllerRef.current?.signal,
      };

      if (example.method === 'GET') {
        const params = new URLSearchParams();
        if (clientIdRef.current) params.set('clientId', clientIdRef.current);
        if (customMessage) params.set('message', customMessage);
        params.set(
          'type',
          selectedExample === 'text-polling'
            ? 'text'
            : selectedExample === 'data-stream'
              ? 'data-stream'
              : 'notification'
        );
        params.set('sequence', sequenceRef.current.toString());
        params.set('timeout', '15000'); // 15秒超时
        url += `?${params.toString()}`;
      } else {
        requestInit = {
          ...requestInit,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: customMessage,
            type: selectedExample === 'log-stream' ? 'log-stream' : 'ai-chat',
            sequence: sequenceRef.current,
            timeout: 15000,
            clientId: clientIdRef.current || undefined, // 传递客户端ID
          }),
        };
      }

      console.log('📡 发起Long Polling请求:', {
        url,
        sequence: sequenceRef.current,
      });

      const response = await fetch(url, requestInit);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const responseTime = Date.now() - pollStartTime;

      // 记录响应时间
      responseTimes.current.push(responseTime);
      if (responseTimes.current.length > 10) {
        responseTimes.current = responseTimes.current.slice(-10);
      }

      const avgTime =
        responseTimes.current.reduce((a, b) => a + b, 0) /
        responseTimes.current.length;

      setStats((prev) => ({
        ...prev,
        pollsCount: prev.pollsCount + 1,
        avgResponseTime: Math.round(avgTime),
      }));

      console.log('📦 收到Long Polling响应:', data);

      if (data.type === 'timeout') {
        addMessage('info', `⏱️ 轮询超时 (${responseTime}ms)，继续下次轮询...`);
      } else if (data.type === 'data' && data.messages) {
        // 处理接收到的消息
        for (const msg of data.messages) {
          handlePollingMessage(msg);
        }
        sequenceRef.current = data.sequence;
        clientIdRef.current = data.clientId;

        // 检查是否有完成消息
        const hasCompleteMessage = data.messages.some(
          (msg: any) =>
            msg.type &&
            (msg.type === 'complete' ||
              msg.type === 'chat-complete' ||
              msg.type === 'data-complete' ||
              msg.type === 'log-complete' ||
              msg.type === 'notification-complete' ||
              msg.type === 'error' ||
              msg.type === 'chat-error')
        );

        if (hasCompleteMessage) {
          setPollingStatus('completed');
          setIsPolling(false);
          return;
        }
      } else if (data.type === 'error') {
        addMessage('error', `❌ 服务器错误: ${data.message}`);
        setPollingStatus('error');
        setIsPolling(false);
        return;
      }

      // 如果还在轮询状态，继续下一次轮询
      console.log('🔍 检查是否继续轮询:', { hasMore: data.hasMore });
      if (data.hasMore !== false) {
        console.log('⏭️ 安排下次轮询...');
        setTimeout(() => {
          // 检查最新的轮询状态
          if (
            pollingControllerRef.current &&
            !pollingControllerRef.current.signal.aborted
          ) {
            performLongPolling();
          }
        }, 100);
      } else {
        console.log('✅ 轮询完成，hasMore:', data.hasMore);
        setPollingStatus('completed');
        setIsPolling(false);
      }
    } catch (error) {
      console.error('❌ Long Polling错误:', error);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          addMessage('info', '⏹️ 轮询已取消');
        } else {
          addMessage('error', `❌ 轮询失败: ${error.message}`);
          setPollingStatus('error');
        }
      }

      setIsPolling(false);
    }
  };

  const handlePollingMessage = (data: any) => {
    const { type, content, message } = data;

    switch (type) {
      case 'start':
      case 'chat-start':
      case 'data-start':
      case 'log-start':
      case 'notification-start':
        addMessage('info', data.message || message, data.sequence);
        break;

      case 'data':
        addMessage('polling', content, data.sequence);
        break;

      case 'chat-stream':
        if (content) {
          setStreamingContent((prev) => prev + content);
          addMessage('polling', `AI输出: ${content}`, data.sequence);
        }
        break;

      case 'data-point':
        addMessage(
          'polling',
          `📊 数据点 ${data.index}: 值=${data.value?.toFixed(2)}, CPU=${data.cpu?.toFixed(1)}%, 内存=${data.memory?.toFixed(1)}%`,
          data.sequence
        );
        break;

      case 'notification':
        addMessage(
          'polling',
          `🔔 [${data.level?.toUpperCase() || 'INFO'}] ${data.title}: ${data.message}`,
          data.sequence
        );
        break;

      case 'log-entry':
        addMessage(
          'polling',
          `[${data.level?.toUpperCase()}] ${data.message}`,
          data.sequence
        );
        break;

      case 'complete':
      case 'chat-complete':
      case 'data-complete':
      case 'log-complete':
      case 'notification-complete':
        addMessage('success', data.message || `✅ ${type} 完成`, data.sequence);
        setPollingStatus('completed');
        setIsPolling(false);
        break;

      case 'error':
      case 'chat-error':
        addMessage('error', data.message || message, data.sequence);
        setPollingStatus('error');
        setIsPolling(false);
        break;

      default:
        addMessage('data', JSON.stringify(data), data.sequence);
        break;
    }
  };

  const startLongPolling = async () => {
    console.log('🚀 开始Long Polling');

    if (isPolling) {
      console.log('⚠️ 已在轮询中，忽略重复请求');
      return;
    }

    if (pollingControllerRef.current) {
      pollingControllerRef.current.abort();
    }

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }

    // 先设置refs和清理状态
    sequenceRef.current = 0;
    clientIdRef.current = '';
    responseTimes.current = [];
    startTimeRef.current = Date.now();

    // 创建新的AbortController
    pollingControllerRef.current = new AbortController();

    // 设置状态
    setIsPolling(true);
    setPollingStatus('polling');
    setMessages([]);
    setStreamingContent('');
    setStats({
      pollsCount: 0,
      messagesReceived: 0,
      duration: 0,
      avgResponseTime: 0,
    });

    // 开始计时
    durationIntervalRef.current = setInterval(() => {
      setStats((prev) => ({
        ...prev,
        duration: Date.now() - startTimeRef.current,
      }));
    }, 100);

    const example = pollingExamples.find((ex) => ex.id === selectedExample);
    addMessage('info', `🚀 开始连接到: ${example?.name}`);
    addMessage('success', '✅ Long Polling已启动');

    // 使用setTimeout确保状态更新完成后再开始轮询
    setTimeout(() => {
      performLongPolling();
    }, 10);
  };

  const stopLongPolling = () => {
    if (pollingControllerRef.current) {
      pollingControllerRef.current.abort();
      pollingControllerRef.current = null;
    }

    setIsPolling(false);
    setPollingStatus('idle');

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }

    addMessage('info', '⏹️ 手动停止轮询');
  };

  const clearMessages = () => {
    setMessages([]);
    setStreamingContent('');
    setStats({
      pollsCount: 0,
      messagesReceived: 0,
      duration: 0,
      avgResponseTime: 0,
    });
  };

  const copyMessages = () => {
    const text = messages
      .map(
        (msg) =>
          `[${new Date(msg.timestamp).toLocaleTimeString()}] ${msg.content}`
      )
      .join('\n');
    navigator.clipboard.writeText(text);
    addMessage('success', '📋 消息已复制到剪贴板');
  };

  const getStatusBadge = () => {
    switch (pollingStatus) {
      case 'polling':
        return <Badge className="bg-blue-100 text-blue-800">轮询中...</Badge>;
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">已完成</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-800">轮询错误</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">未开始</Badge>;
    }
  };

  const getMessageIcon = (type: PollingMessage['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'info':
        return <Info className="h-4 w-4 text-blue-600" />;
      case 'polling':
        return <RefreshCw className="h-4 w-4 text-orange-600" />;
      default:
        return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) {
      return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
    }
    return `${seconds}s`;
  };

  return (
    <TestPageLayout
      title="Long Polling"
      description="HTTP长轮询实时通信技术演示"
    >
      <div className="p-6 space-y-6">
        {/* Long Polling介绍 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-600" />
              什么是 Long Polling？
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-700">
              Long
              Polling（长轮询）是一种实现实时通信的技术，客户端发起HTTP请求后，
              服务器会保持连接直到有新数据返回或超时。相比传统轮询，减少了不必要的请求，
              是WebSocket和SSE出现之前的主流实时通信方案。
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg">
                <Clock className="h-6 w-6 text-orange-600 mb-2" />
                <h4 className="font-medium mb-1">保持连接</h4>
                <p className="text-sm text-gray-600">
                  服务器保持连接直到有数据或超时
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <Timer className="h-6 w-6 text-green-600 mb-2" />
                <h4 className="font-medium mb-1">减少请求</h4>
                <p className="text-sm text-gray-600">
                  相比短轮询显著减少HTTP请求数
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <TrendingUp className="h-6 w-6 text-blue-600 mb-2" />
                <h4 className="font-medium mb-1">兼容性好</h4>
                <p className="text-sm text-gray-600">
                  基于HTTP，兼容性和可靠性高
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 控制面板 */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">控制面板</CardTitle>
                <CardDescription>选择示例并控制Long Polling</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 轮询状态 */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">轮询状态</span>
                  {getStatusBadge()}
                </div>

                {/* 示例选择 */}
                <div>
                  <Label>选择示例</Label>
                  <div className="mt-2 grid grid-cols-1 gap-2">
                    {pollingExamples.map((example) => (
                      <div
                        key={example.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedExample === example.id
                            ? 'border-orange-500 bg-orange-50'
                            : 'hover:border-gray-300'
                        }`}
                        onClick={() => setSelectedExample(example.id)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{example.icon}</span>
                          <div>
                            <p className="font-medium text-sm">
                              {example.name}
                            </p>
                            <p className="text-xs text-gray-600">
                              {example.description}
                            </p>
                            <p className="text-xs text-orange-600 mt-1">
                              {example.method} {example.endpoint}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 自定义消息 */}
                <div>
                  <Label htmlFor="custom-message">
                    {selectedExample === 'ai-chat' ? '对话内容' : '自定义消息'}{' '}
                    (可选)
                  </Label>
                  <Input
                    id="custom-message"
                    placeholder={
                      selectedExample === 'ai-chat'
                        ? '输入您想问AI的问题...'
                        : '输入自定义文本...'
                    }
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    className="mt-1"
                  />
                </div>

                {/* 控制按钮 */}
                <div className="flex gap-2">
                  <Button
                    onClick={startLongPolling}
                    disabled={isPolling}
                    className="flex-1"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    开始轮询
                  </Button>
                  {isPolling && (
                    <Button variant="outline" onClick={stopLongPolling}>
                      <Square className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* 统计信息 */}
                <div className="pt-4 border-t">
                  <h4 className="font-medium text-sm mb-2">轮询统计</h4>
                  <div className="space-y-1 text-xs text-gray-600">
                    <div className="flex justify-between">
                      <span>轮询次数:</span>
                      <span>{stats.pollsCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>消息数:</span>
                      <span>{stats.messagesReceived}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>平均响应:</span>
                      <span>{stats.avgResponseTime}ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span>持续时间:</span>
                      <span>{formatDuration(stats.duration)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 消息展示 */}
          <div className="lg:col-span-2 space-y-6">
            {/* AI聊天的Streamdown展示 */}
            {selectedExample === 'ai-chat' && (
              <Card className="h-auto">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    🤖 AI对话长轮询展示
                    <Badge variant="secondary">Streamdown</Badge>
                  </CardTitle>
                  <CardDescription>
                    使用Long Polling获取AI回答，支持Markdown渲染
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg p-4 bg-white min-h-[200px] max-h-96 overflow-y-auto">
                    {streamingContent ? (
                      <Streamdown
                        parseIncompleteMarkdown={true}
                        className="prose prose-sm max-w-none text-gray-800"
                      >
                        {streamingContent}
                      </Streamdown>
                    ) : (
                      <div className="text-center text-gray-500 py-12">
                        <div className="text-4xl mb-4">🤖</div>
                        <p>点击"开始轮询"开始AI对话</p>
                        <p className="text-xs mt-2">
                          AI回答将通过Long Polling获取
                        </p>
                      </div>
                    )}
                  </div>

                  {/* 轮询状态指示器 */}
                  {isPolling && selectedExample === 'ai-chat' && (
                    <div className="flex items-center gap-2 mt-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                        <span>Long Polling中...</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        已接收: {streamingContent.length} 字符
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 实时消息流 */}
            <Card className="h-auto">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">轮询消息流</CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={copyMessages}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={clearMessages}>
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-96 overflow-y-auto border rounded-lg p-4 bg-gray-50">
                  {messages.length === 0 ? (
                    <div className="text-center text-gray-500 py-12">
                      <Clock className="h-12 w-12 mx-auto mb-4 opacity-30" />
                      <p>点击"开始轮询"开始接收Long Polling数据</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className="flex items-start gap-2 p-2 rounded bg-white shadow-sm"
                        >
                          {getMessageIcon(message.type)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs text-gray-500">
                                {new Date(
                                  message.timestamp
                                ).toLocaleTimeString()}
                              </span>
                              {message.sequence !== undefined && (
                                <Badge variant="outline" className="text-xs">
                                  #{message.sequence}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm break-words">
                              {message.content}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* 技术细节 */}
        <Card>
          <CardHeader>
            <CardTitle>Long Polling 技术细节</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="frontend" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="frontend">前端实现</TabsTrigger>
                <TabsTrigger value="backend">后端实现</TabsTrigger>
                <TabsTrigger value="workflow">工作流程</TabsTrigger>
              </TabsList>

              <TabsContent value="frontend" className="space-y-4">
                <h4 className="font-medium">前端 Long Polling 循环</h4>
                <Textarea
                  readOnly
                  value={`// Long Polling实现
const performLongPolling = async () => {
  while (isPolling) {
    try {
      const response = await fetch('/api/streaming/long-polling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sequence: currentSequence,
          timeout: 15000 // 15秒超时
        })
      });

      const data = await response.json();
      
      if (data.type === 'timeout') {
        // 超时，继续下次轮询
        console.log('轮询超时，继续...');
        continue;
      }
      
      if (data.messages) {
        // 处理新消息
        data.messages.forEach(handleMessage);
        currentSequence = data.sequence;
      }
      
      // 短暂延迟后继续轮询
      await new Promise(r => setTimeout(r, 100));
      
    } catch (error) {
      console.error('轮询错误:', error);
      break;
    }
  }
};

// 开始轮询
performLongPolling();`}
                  className="h-80 font-mono text-sm"
                />
              </TabsContent>

              <TabsContent value="backend" className="space-y-4">
                <h4 className="font-medium">Next.js Long Polling 实现</h4>
                <Textarea
                  readOnly
                  value={`// 消息队列管理
const messageQueues = new Map<string, any[]>();
const clientSequences = new Map<string, number>();

export async function POST(request: NextRequest) {
  const { sequence, timeout = 30000 } = await request.json();
  
  // 等待新数据或超时
  const result = await waitForNewData(clientId, sequence, timeout);
  
  return Response.json(result);
}

// 等待新数据
async function waitForNewData(clientId: string, requestSequence: number, timeout: number) {
  const startTime = Date.now();
  const maxWaitTime = Math.min(timeout, 60000);

  while (Date.now() - startTime < maxWaitTime) {
    const queue = messageQueues.get(clientId) || [];
    const currentSequence = clientSequences.get(clientId) || 0;

    // 检查是否有新数据
    if (currentSequence > requestSequence) {
      const newMessages = queue.filter(msg => msg.sequence > requestSequence);
      return {
        type: 'data',
        messages: newMessages,
        sequence: currentSequence,
        hasMore: true
      };
    }

    // 等待50ms再检查
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  // 超时返回
  return {
    type: 'timeout',
    sequence: requestSequence,
    hasMore: true
  };
}`}
                  className="h-80 font-mono text-sm"
                />
              </TabsContent>

              <TabsContent value="workflow" className="space-y-4">
                <h4 className="font-medium">Long Polling 工作流程</h4>
                <Textarea
                  readOnly
                  value={`// Long Polling 工作流程

1. 客户端发起请求
   - 包含上次接收的序列号
   - 设置超时时间（如15-30秒）

2. 服务器处理请求
   - 检查是否有新于序列号的数据
   - 如有数据：立即返回
   - 如无数据：保持连接等待

3. 服务器等待阶段
   - 循环检查新数据（每50ms）
   - 到达超时时间则返回timeout
   - 有新数据时立即返回

4. 客户端处理响应
   - 收到数据：处理消息，更新序列号
   - 收到超时：记录日志，继续轮询
   - 发生错误：重试或停止轮询

5. 循环继续
   - 客户端立即或短暂延迟后发起下次请求
   - 重复整个流程直到停止

优点:
- 减少无效请求（相比短轮询）
- 实时性较好（相比定时轮询）
- 兼容性强（基于HTTP）

缺点:
- 服务器需要保持大量连接
- 超时处理复杂
- 不如WebSocket/SSE高效`}
                  className="h-80 font-mono text-sm"
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </TestPageLayout>
  );
}
