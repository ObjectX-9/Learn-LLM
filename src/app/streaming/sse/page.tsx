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
  Radio,
  Play,
  Square,
  RotateCcw,
  Copy,
  Clock,
  Activity,
  CheckCircle,
  AlertCircle,
  Info,
  TrendingUp,
} from 'lucide-react';

interface StreamMessage {
  id: string;
  type: 'info' | 'data' | 'success' | 'error';
  content: string;
  timestamp: number;
}

const sseExamples = [
  {
    id: 'gpt-chat',
    name: 'ChatGPT对话',
    description: '类似ChatGPT的AI流式对话',
    endpoint: '/api/streaming/sse/gpt',
    icon: '🤖',
  },
  {
    id: 'text-stream',
    name: '文本流式输出',
    description: '模拟AI文本生成过程',
    endpoint: '/api/streaming/sse/text',
    icon: '📝',
  },
  {
    id: 'data-stream',
    name: '数据流推送',
    description: '实时数据更新和统计',
    endpoint: '/api/streaming/sse/data',
    icon: '📊',
  },
  {
    id: 'notification',
    name: '通知推送',
    description: '实时通知和状态更新',
    endpoint: '/api/streaming/sse/notification',
    icon: '🔔',
  },
  {
    id: 'log-stream',
    name: '日志流',
    description: '实时日志输出和监控',
    endpoint: '/api/streaming/sse/logs',
    icon: '📋',
  },
];

export default function SSEPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<StreamMessage[]>([]);
  const [customMessage, setCustomMessage] =
    useState('请告诉我关于人工智能的未来发展前景');
  const [selectedExample, setSelectedExample] = useState('gpt-chat');
  const [connectionStatus, setConnectionStatus] = useState<
    'disconnected' | 'connecting' | 'connected' | 'error'
  >('disconnected');
  const [stats, setStats] = useState({
    messagesReceived: 0,
    bytesReceived: 0,
    duration: 0,
  });
  const [streamingContent, setStreamingContent] = useState(''); // 累积ChatGPT流式内容

  const eventSourceRef = useRef<EventSource | null>(null);
  const startTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 组件卸载时清理资源
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
      }
    };
  }, []);

  const addMessage = (type: StreamMessage['type'], content: string) => {
    const message: StreamMessage = {
      id: Date.now().toString(),
      type,
      content,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, message]);
    setStats((prev) => ({
      ...prev,
      messagesReceived: prev.messagesReceived + 1,
      bytesReceived: prev.bytesReceived + content.length,
    }));
  };

  const startSSE = () => {
    console.log('🚀 前端开始SSE连接');

    // 防止重复连接
    if (isConnected || connectionStatus === 'connecting') {
      console.log('⚠️ 连接中或已连接，忽略重复请求');
      return;
    }

    if (eventSourceRef.current) {
      console.log('🔄 关闭旧连接');
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // 清理之前的定时器
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
    if (healthCheckIntervalRef.current) {
      clearInterval(healthCheckIntervalRef.current);
    }

    setConnectionStatus('connecting');
    setMessages([]);
    setStreamingContent(''); // 清空流式内容
    setStats({ messagesReceived: 0, bytesReceived: 0, duration: 0 });
    startTimeRef.current = Date.now();

    const example = sseExamples.find((ex) => ex.id === selectedExample);
    const url = `${example?.endpoint}?message=${encodeURIComponent(customMessage)}`;

    console.log('📡 创建EventSource:', url);
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    console.log('📡 EventSource创建完成, readyState:', eventSource.readyState);

    // 连接管理变量
    let connectionTimeoutId: NodeJS.Timeout;
    let isConnectionActive = true;

    // 设置连接超时
    connectionTimeoutId = setTimeout(() => {
      if (
        isConnectionActive &&
        eventSource.readyState === EventSource.CONNECTING
      ) {
        isConnectionActive = false;
        setConnectionStatus('error');
        setIsConnected(false);
        addMessage('error', '❌ 连接超时，请检查网络或稍后重试');
        eventSource.close();
      }
    }, 10000); // 10秒超时

    // 开始计时
    durationIntervalRef.current = setInterval(() => {
      setStats((prev) => ({
        ...prev,
        duration: Date.now() - startTimeRef.current,
      }));
    }, 100);

    eventSource.onopen = () => {
      console.log('✅ EventSource连接已打开');
      isConnectionActive = false; // 标记连接成功，停止超时检测
      clearTimeout(connectionTimeoutId); // 清除超时
      setConnectionStatus('connected');
      setIsConnected(true);
      addMessage('info', `🚀 已连接到: ${example?.name}`);
      addMessage('success', '✅ SSE连接已建立');

      // 启动健康检查
      healthCheckIntervalRef.current = setInterval(() => {
        if (eventSource.readyState === EventSource.CLOSED) {
          console.log('💔 健康检查发现连接已断开');
          setConnectionStatus('error');
          setIsConnected(false);
          addMessage('error', '❌ 检测到连接已断开');
          if (healthCheckIntervalRef.current) {
            clearInterval(healthCheckIntervalRef.current);
          }
        }
      }, 5000); // 每5秒检查一次
    };

    eventSource.onmessage = (event) => {
      console.log('📩 收到消息:', event.data);
      try {
        const data = JSON.parse(event.data);
        if (data.content) {
          addMessage('data', data.content);
          // 如果是ChatGPT示例，累积内容用于Streamdown渲染
          if (selectedExample === 'gpt-chat') {
            setStreamingContent((prev) => prev + data.content);
          }
        } else if (data.error) {
          addMessage('error', `⚠️ ${data.error}`);
        } else {
          addMessage('data', event.data);
        }
      } catch {
        // 如果不是JSON格式，直接显示原始数据
        addMessage('data', event.data);
      }
    };

    // 自定义事件监听
    eventSource.addEventListener('status', (event) => {
      console.log('📍 收到status事件:', event.data);
      addMessage('info', `📍 状态: ${event.data}`);
    });

    eventSource.addEventListener('progress', (event) => {
      console.log('⏳ 收到progress事件:', event.data);
      addMessage('info', `⏳ 进度: ${event.data}`);
    });

    eventSource.addEventListener('complete', (event) => {
      console.log('🎉 收到complete事件:', event.data);
      addMessage('success', `🎉 完成: ${event.data}`);

      // 演示完成后，主动关闭连接，避免自动重连
      console.log('🔚 演示完成，准备关闭连接');
      setTimeout(() => {
        if (eventSourceRef.current === eventSource) {
          console.log('🔚 优雅关闭EventSource连接');
          addMessage('info', '🔚 演示完成，正在关闭连接...');

          // 优雅关闭连接
          eventSource.close();
          eventSourceRef.current = null;
          setConnectionStatus('disconnected');
          setIsConnected(false);

          // 清理定时器
          if (healthCheckIntervalRef.current) {
            clearInterval(healthCheckIntervalRef.current);
          }
          if (durationIntervalRef.current) {
            clearInterval(durationIntervalRef.current);
          }

          console.log('✅ 连接已安全关闭');
        }
      }, 2000); // 等待2秒后关闭，让用户看到完成消息
    });

    eventSource.onerror = (error) => {
      console.error(
        '❌ SSE Error:',
        error,
        'readyState:',
        eventSource.readyState
      );
      isConnectionActive = false; // 标记连接过程结束
      clearTimeout(connectionTimeoutId); // 清除超时

      // 根据连接状态处理错误
      if (eventSource.readyState === EventSource.CLOSED) {
        console.log('💀 连接已关闭状态的错误');
        setConnectionStatus('error');
        setIsConnected(false);
        addMessage('error', '❌ SSE连接失败或已断开');

        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
        }
        if (healthCheckIntervalRef.current) {
          clearInterval(healthCheckIntervalRef.current);
        }
      } else if (eventSource.readyState === EventSource.CONNECTING) {
        console.log('🔄 连接中状态的错误，可能在重连');
        // 连接中的错误，可能是在重连
        addMessage('info', '🔄 SSE连接中断，浏览器会自动重连...');
      } else {
        console.log('⚡ 打开状态的错误，可能是网络波动');
        // OPEN状态下的错误，通常是临时网络问题
        addMessage('info', '⚠️ 网络波动，连接仍在尝试中...');
      }
    };

    eventSource.addEventListener('close', () => {
      console.log('🔚 收到close事件');
      isConnectionActive = false; // 标记连接过程结束
      clearTimeout(connectionTimeoutId); // 清除超时
      setConnectionStatus('disconnected');
      setIsConnected(false);
      addMessage('info', '🔚 SSE连接已关闭');

      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
      }
    });
  };

  const stopSSE = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setConnectionStatus('disconnected');
    setIsConnected(false);
    setStreamingContent(''); // 清空流式内容

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }

    if (healthCheckIntervalRef.current) {
      clearInterval(healthCheckIntervalRef.current);
    }

    addMessage('info', '⏹️ 手动停止SSE连接');
  };

  const clearMessages = () => {
    setMessages([]);
    setStreamingContent(''); // 清空流式内容
    setStats({ messagesReceived: 0, bytesReceived: 0, duration: 0 });
    // 不改变连接状态，只清理消息
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
    switch (connectionStatus) {
      case 'connecting':
        return (
          <Badge className="bg-yellow-100 text-yellow-800">连接中...</Badge>
        );
      case 'connected':
        return <Badge className="bg-green-100 text-green-800">已连接</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-800">连接错误</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">未连接</Badge>;
    }
  };

  const getMessageIcon = (type: StreamMessage['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'info':
        return <Info className="h-4 w-4 text-blue-600" />;
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
      title="Server-Sent Events (SSE)"
      description="HTML5标准的服务端推送技术演示"
    >
      <div className="p-6 space-y-6">
        {/* SSE 介绍 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Radio className="h-5 w-5 text-blue-600" />
              什么是 Server-Sent Events？
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-700">
              Server-Sent Events (SSE) 是 HTML5
              的一项标准，允许服务器主动向客户端推送数据。
              它基于HTTP协议，使用简单的文本格式，非常适合实时通知、数据更新等场景。
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg">
                <Radio className="h-6 w-6 text-blue-600 mb-2" />
                <h4 className="font-medium mb-1">自动重连</h4>
                <p className="text-sm text-gray-600">连接断开时自动重新连接</p>
              </div>
              <div className="p-4 border rounded-lg">
                <Clock className="h-6 w-6 text-green-600 mb-2" />
                <h4 className="font-medium mb-1">实时推送</h4>
                <p className="text-sm text-gray-600">服务器主动推送，延迟低</p>
              </div>
              <div className="p-4 border rounded-lg">
                <TrendingUp className="h-6 w-6 text-purple-600 mb-2" />
                <h4 className="font-medium mb-1">简单易用</h4>
                <p className="text-sm text-gray-600">基于HTTP，实现简单</p>
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
                <CardDescription>选择示例并控制SSE连接</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 连接状态 */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">连接状态</span>
                  {getStatusBadge()}
                </div>

                {/* 示例选择 */}
                <div>
                  <Label>选择示例</Label>
                  <div className="mt-2 grid grid-cols-1 gap-2">
                    {sseExamples.map((example) => (
                      <div
                        key={example.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedExample === example.id
                            ? 'border-blue-500 bg-blue-50'
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
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 自定义消息 */}
                <div>
                  <Label htmlFor="custom-message">
                    {selectedExample === 'gpt-chat' ? '对话消息' : '自定义消息'}{' '}
                    (可选)
                  </Label>
                  <Input
                    id="custom-message"
                    placeholder={
                      selectedExample === 'gpt-chat'
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
                    onClick={startSSE}
                    disabled={isConnected}
                    className="flex-1"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    开始连接
                  </Button>
                  {isConnected && (
                    <Button variant="outline" onClick={stopSSE}>
                      <Square className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* 统计信息 */}
                <div className="pt-4 border-t">
                  <h4 className="font-medium text-sm mb-2">连接统计</h4>
                  <div className="space-y-1 text-xs text-gray-600">
                    <div className="flex justify-between">
                      <span>消息数量:</span>
                      <span>{stats.messagesReceived}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>数据量:</span>
                      <span>{formatBytes(stats.bytesReceived)}</span>
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
            {/* ChatGPT风格的Streamdown展示 */}
            {selectedExample === 'gpt-chat' && (
              <Card className="h-auto">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    🤖 ChatGPT风格流式展示
                    <Badge variant="secondary">Streamdown</Badge>
                  </CardTitle>
                  <CardDescription>
                    使用Streamdown组件渲染流式Markdown内容，支持不完整的Markdown块
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
                        <p>点击"开始连接"开始ChatGPT对话</p>
                        <p className="text-xs mt-2">
                          AI回答将在这里以流式方式渲染
                        </p>
                      </div>
                    )}
                  </div>

                  {/* 流式状态指示器 */}
                  {isConnected && selectedExample === 'gpt-chat' && (
                    <div className="flex items-center gap-2 mt-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span>实时流式输出中...</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        已接收: {streamingContent.length} 字符
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
            <Card className="h-auto">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">实时消息流</CardTitle>
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
                      <Radio className="h-12 w-12 mx-auto mb-4 opacity-30" />
                      <p>点击"开始连接"开始接收SSE消息</p>
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
            <CardTitle>SSE 技术细节</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="frontend" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="frontend">前端代码</TabsTrigger>
                <TabsTrigger value="backend">后端实现</TabsTrigger>
                <TabsTrigger value="protocol">协议格式</TabsTrigger>
              </TabsList>

              <TabsContent value="frontend" className="space-y-4">
                <h4 className="font-medium">前端 EventSource API</h4>
                <Textarea
                  readOnly
                  value={`// 创建SSE连接
const eventSource = new EventSource('/api/streaming/sse');

// 监听消息
eventSource.onmessage = (event) => {
  console.log('收到数据:', event.data);
};

// 监听自定义事件
eventSource.addEventListener('status', (event) => {
  console.log('状态更新:', event.data);
});

// 错误处理
eventSource.onerror = (error) => {
  console.error('SSE错误:', error);
};

// 关闭连接
eventSource.close();`}
                  className="h-64 font-mono text-sm"
                />
              </TabsContent>

              <TabsContent value="backend" className="space-y-4">
                <h4 className="font-medium">Next.js API Route</h4>
                <Textarea
                  readOnly
                  value={`// /api/streaming/sse/route.ts
export async function GET() {
  const encoder = new TextEncoder();
  
  const readable = new ReadableStream({
    start(controller) {
      // 发送消息
      controller.enqueue(
        encoder.encode('data: Hello World\\n\\n')
      );
      
      // 发送自定义事件
      controller.enqueue(
        encoder.encode('event: status\\ndata: connected\\n\\n')
      );
    }
  });
  
  return new Response(readable, {
    headers: {
      'Content-Type': 'text/stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}`}
                  className="h-64 font-mono text-sm"
                />
              </TabsContent>

              <TabsContent value="protocol" className="space-y-4">
                <h4 className="font-medium">SSE 数据格式</h4>
                <Textarea
                  readOnly
                  value={`// 基本消息格式
data: Hello World

// 多行数据
data: 第一行
data: 第二行

// 自定义事件
event: notification
data: 新消息

// 带ID的消息
id: 123
data: 可重连的消息

// 设置重连时间(毫秒)
retry: 3000

// 注意: 每个消息都必须以两个换行符结尾 \\n\\n`}
                  className="h-64 font-mono text-sm"
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </TestPageLayout>
  );
}
