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
  Package,
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

interface ChunkedMessage {
  id: string;
  type: 'info' | 'data' | 'success' | 'error' | 'chunk';
  content: string;
  timestamp: number;
  chunkSize?: number;
}

const chunkedExamples = [
  {
    id: 'text-stream',
    name: '文本分块传输',
    description: 'Chunked编码的文本流式输出演示',
    endpoint: '/api/streaming/chunked',
    method: 'GET',
    icon: '📝',
  },
  {
    id: 'ai-chat',
    name: 'AI对话流',
    description: 'AI聊天内容的分块传输',
    endpoint: '/api/streaming/chunked',
    method: 'POST',
    icon: '🤖',
  },
  {
    id: 'data-stream',
    name: '实时数据流',
    description: '模拟监控数据的分块推送',
    endpoint: '/api/streaming/chunked',
    method: 'GET',
    icon: '📊',
  },
  {
    id: 'log-stream',
    name: '日志流传输',
    description: '实时日志数据的分块输出',
    endpoint: '/api/streaming/chunked',
    method: 'POST',
    icon: '📋',
  },
];

export default function ChunkedPage() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [messages, setMessages] = useState<ChunkedMessage[]>([]);
  const [customMessage, setCustomMessage] = useState(
    '请介绍一下Chunked Transfer编码的工作原理和应用场景'
  );
  const [selectedExample, setSelectedExample] = useState('ai-chat');
  const [streamingStatus, setStreamingStatus] = useState<
    'idle' | 'streaming' | 'completed' | 'error'
  >('idle');
  const [stats, setStats] = useState({
    chunksReceived: 0,
    bytesReceived: 0,
    duration: 0,
  });
  const [streamingContent, setStreamingContent] = useState('');

  const abortControllerRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, []);

  const addMessage = (
    type: ChunkedMessage['type'],
    content: string,
    chunkSize?: number
  ) => {
    const message: ChunkedMessage = {
      id: Date.now().toString(),
      type,
      content,
      timestamp: Date.now(),
      chunkSize,
    };
    setMessages((prev) => [...prev, message]);
    setStats((prev) => ({
      ...prev,
      chunksReceived: prev.chunksReceived + 1,
      bytesReceived: prev.bytesReceived + content.length,
    }));
  };

  const parseChunkedData = async (
    reader: ReadableStreamDefaultReader<Uint8Array>
  ) => {
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          console.log('✅ Chunked流读取完成');
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // 解析Chunked格式数据
        while (true) {
          const crlfIndex = buffer.indexOf('\r\n');
          if (crlfIndex === -1) break;

          const chunkSizeHex = buffer.substring(0, crlfIndex);
          const chunkSize = parseInt(chunkSizeHex, 16);

          if (chunkSize === 0) {
            // 结束块
            console.log('🔚 收到结束块');
            addMessage('success', '✅ Chunked传输完成');
            setStreamingStatus('completed');
            setIsStreaming(false);
            return;
          }

          const chunkStart = crlfIndex + 2;
          const chunkEnd = chunkStart + chunkSize;

          if (buffer.length < chunkEnd + 2) {
            // 数据不完整，等待更多数据
            break;
          }

          const chunkData = buffer.substring(chunkStart, chunkEnd);
          buffer = buffer.substring(chunkEnd + 2); // 移除处理过的数据

          console.log(`📦 收到数据块 (${chunkSize} bytes):`, chunkData);

          try {
            const parsedData = JSON.parse(chunkData);
            handleChunkedMessage(parsedData, chunkSize);
          } catch (error) {
            console.error('❌ 解析JSON失败:', error);
            addMessage(
              'error',
              `❌ 数据格式错误: ${chunkData.substring(0, 100)}...`,
              chunkSize
            );
          }
        }
      }
    } catch (error) {
      console.error('❌ 读取流数据出错:', error);
      if (error instanceof Error && error.name !== 'AbortError') {
        addMessage('error', `❌ 读取数据失败: ${error.message}`);
        setStreamingStatus('error');
      }
    } finally {
      setIsStreaming(false);
    }
  };

  const handleChunkedMessage = (data: any, chunkSize: number) => {
    const { type, content, message } = data;

    switch (type) {
      case 'start':
      case 'chat-start':
      case 'data-start':
      case 'log-start':
        addMessage('info', data.message || message, chunkSize);
        break;

      case 'data':
        addMessage('chunk', content, chunkSize);
        break;

      case 'chat-stream':
        if (content) {
          setStreamingContent((prev) => prev + content);
          addMessage('chunk', `AI输出: ${content}`, chunkSize);
        }
        break;

      case 'data-point':
        addMessage(
          'chunk',
          `📊 数据点 ${data.index}: 值=${data.value?.toFixed(2)}, CPU=${data.cpu?.toFixed(1)}%, 内存=${data.memory?.toFixed(1)}%`,
          chunkSize
        );
        break;

      case 'log-entry':
        addMessage(
          'chunk',
          `[${data.level.toUpperCase()}] ${data.message}`,
          chunkSize
        );
        break;

      case 'complete':
      case 'chat-complete':
      case 'data-complete':
      case 'log-complete':
        addMessage('success', data.message || `✅ ${type} 完成`, chunkSize);
        break;

      case 'error':
      case 'chat-error':
        addMessage('error', data.message || message, chunkSize);
        setStreamingStatus('error');
        break;

      default:
        addMessage('data', JSON.stringify(data), chunkSize);
        break;
    }
  };

  const startChunkedStream = async () => {
    console.log('🚀 开始Chunked Transfer流式传输');

    if (isStreaming) {
      console.log('⚠️ 已在流式传输中，忽略重复请求');
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }

    setIsStreaming(true);
    setStreamingStatus('streaming');
    setMessages([]);
    setStreamingContent('');
    setStats({ chunksReceived: 0, bytesReceived: 0, duration: 0 });
    startTimeRef.current = Date.now();

    // 开始计时
    durationIntervalRef.current = setInterval(() => {
      setStats((prev) => ({
        ...prev,
        duration: Date.now() - startTimeRef.current,
      }));
    }, 100);

    const example = chunkedExamples.find((ex) => ex.id === selectedExample);
    if (!example) {
      addMessage('error', '❌ 未找到选中的示例');
      setIsStreaming(false);
      return;
    }

    abortControllerRef.current = new AbortController();

    try {
      addMessage('info', `🚀 连接到: ${example.name}`);

      let url = example.endpoint;
      let requestInit: RequestInit = {
        signal: abortControllerRef.current.signal,
      };

      if (example.method === 'GET') {
        const params = new URLSearchParams();
        if (customMessage) params.set('message', customMessage);
        if (selectedExample === 'data-stream')
          params.set('type', 'data-stream');
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
          }),
        };
      }

      console.log('📡 发起请求:', url, requestInit);
      const response = await fetch(url, requestInit);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      const transferEncoding = response.headers.get('transfer-encoding');

      console.log('📦 响应头:', {
        contentType,
        transferEncoding,
        status: response.status,
      });

      addMessage('success', `✅ 连接建立 (${transferEncoding})`);

      if (!response.body) {
        throw new Error('响应体为空');
      }

      const reader = response.body.getReader();
      await parseChunkedData(reader);
    } catch (error) {
      console.error('❌ Chunked传输错误:', error);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          addMessage('info', '⏹️ 传输已取消');
        } else {
          addMessage('error', `❌ 传输失败: ${error.message}`);
          setStreamingStatus('error');
        }
      }
    } finally {
      setIsStreaming(false);
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    }
  };

  const stopChunkedStream = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setIsStreaming(false);
    setStreamingStatus('idle');

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }

    addMessage('info', '⏹️ 手动停止传输');
  };

  const clearMessages = () => {
    setMessages([]);
    setStreamingContent('');
    setStats({ chunksReceived: 0, bytesReceived: 0, duration: 0 });
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
    switch (streamingStatus) {
      case 'streaming':
        return <Badge className="bg-blue-100 text-blue-800">传输中...</Badge>;
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">已完成</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-800">传输错误</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">未开始</Badge>;
    }
  };

  const getMessageIcon = (type: ChunkedMessage['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'info':
        return <Info className="h-4 w-4 text-blue-600" />;
      case 'chunk':
        return <Package className="h-4 w-4 text-purple-600" />;
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
      title="Chunked Transfer Encoding"
      description="HTTP分块传输编码流式数据演示"
    >
      <div className="p-6 space-y-6">
        {/* Chunked Transfer介绍 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-purple-600" />
              什么是 Chunked Transfer Encoding？
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-700">
              Chunked Transfer Encoding（分块传输编码）是HTTP/1.1协议的一部分，
              允许服务器在不知道总内容长度的情况下发送数据。每个数据块都有自己的长度标识，
              非常适合动态生成内容和流式传输场景。
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg">
                <Package className="h-6 w-6 text-purple-600 mb-2" />
                <h4 className="font-medium mb-1">分块传输</h4>
                <p className="text-sm text-gray-600">数据分成多个块逐个发送</p>
              </div>
              <div className="p-4 border rounded-lg">
                <Clock className="h-6 w-6 text-green-600 mb-2" />
                <h4 className="font-medium mb-1">实时流式</h4>
                <p className="text-sm text-gray-600">
                  无需预知内容长度即可传输
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <TrendingUp className="h-6 w-6 text-blue-600 mb-2" />
                <h4 className="font-medium mb-1">高效传输</h4>
                <p className="text-sm text-gray-600">支持大文件和动态内容</p>
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
                <CardDescription>选择示例并控制Chunked传输</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 传输状态 */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">传输状态</span>
                  {getStatusBadge()}
                </div>

                {/* 示例选择 */}
                <div>
                  <Label>选择示例</Label>
                  <div className="mt-2 grid grid-cols-1 gap-2">
                    {chunkedExamples.map((example) => (
                      <div
                        key={example.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedExample === example.id
                            ? 'border-purple-500 bg-purple-50'
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
                            <p className="text-xs text-purple-600 mt-1">
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
                    onClick={startChunkedStream}
                    disabled={isStreaming}
                    className="flex-1"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    开始传输
                  </Button>
                  {isStreaming && (
                    <Button variant="outline" onClick={stopChunkedStream}>
                      <Square className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* 统计信息 */}
                <div className="pt-4 border-t">
                  <h4 className="font-medium text-sm mb-2">传输统计</h4>
                  <div className="space-y-1 text-xs text-gray-600">
                    <div className="flex justify-between">
                      <span>数据块:</span>
                      <span>{stats.chunksReceived}</span>
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
            {/* AI聊天的Streamdown展示 */}
            {selectedExample === 'ai-chat' && (
              <Card className="h-auto">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    🤖 AI对话流式展示
                    <Badge variant="secondary">Streamdown</Badge>
                  </CardTitle>
                  <CardDescription>
                    使用Chunked编码传输AI回答，支持Markdown渲染
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
                        <p>点击"开始传输"开始AI对话</p>
                        <p className="text-xs mt-2">
                          AI回答将通过Chunked编码流式传输
                        </p>
                      </div>
                    )}
                  </div>

                  {/* 流式状态指示器 */}
                  {isStreaming && selectedExample === 'ai-chat' && (
                    <div className="flex items-center gap-2 mt-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                        <span>Chunked传输中...</span>
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
                  <CardTitle className="text-lg">分块数据流</CardTitle>
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
                      <Package className="h-12 w-12 mx-auto mb-4 opacity-30" />
                      <p>点击"开始传输"开始接收Chunked数据</p>
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
                              {message.chunkSize !== undefined && (
                                <Badge variant="outline" className="text-xs">
                                  {message.chunkSize}B
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
            <CardTitle>Chunked Transfer 技术细节</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="frontend" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="frontend">前端实现</TabsTrigger>
                <TabsTrigger value="backend">后端实现</TabsTrigger>
                <TabsTrigger value="protocol">协议格式</TabsTrigger>
              </TabsList>

              <TabsContent value="frontend" className="space-y-4">
                <h4 className="font-medium">前端 Fetch API + ReadableStream</h4>
                <Textarea
                  readOnly
                  value={`// 发起Chunked请求
const response = await fetch('/api/streaming/chunked', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'Hello' })
});

// 读取Chunked数据流
const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });
  
  // 解析Chunked格式
  while (true) {
    const crlfIndex = buffer.indexOf('\\r\\n');
    if (crlfIndex === -1) break;

    const chunkSizeHex = buffer.substring(0, crlfIndex);
    const chunkSize = parseInt(chunkSizeHex, 16);
    
    if (chunkSize === 0) return; // 结束块
    
    const chunkData = buffer.substring(crlfIndex + 2, crlfIndex + 2 + chunkSize);
    console.log('收到数据块:', JSON.parse(chunkData));
    
    buffer = buffer.substring(crlfIndex + 2 + chunkSize + 2);
  }
}`}
                  className="h-80 font-mono text-sm"
                />
              </TabsContent>

              <TabsContent value="backend" className="space-y-4">
                <h4 className="font-medium">Next.js Chunked Stream 实现</h4>
                <Textarea
                  readOnly
                  value={`// 发送Chunked数据的辅助函数
function sendChunk(controller, encoder, data) {
  const jsonData = JSON.stringify(data);
  const chunkSize = jsonData.length.toString(16); // 十六进制长度
  controller.enqueue(encoder.encode(\`\${chunkSize}\\r\\n\${jsonData}\\r\\n\`));
}

export async function POST(request) {
  const encoder = new TextEncoder();
  
  const readable = new ReadableStream({
    async start(controller) {
      // 发送数据块
      sendChunk(controller, encoder, {
        type: 'start',
        message: '开始传输'
      });
      
      // 发送更多数据...
      for (let i = 0; i < 10; i++) {
        sendChunk(controller, encoder, {
          type: 'data',
          content: \`数据块 \${i + 1}\`
        });
        await new Promise(r => setTimeout(r, 500));
      }
      
      // 发送结束标记
      controller.enqueue(encoder.encode('0\\r\\n\\r\\n'));
      controller.close();
    }
  });
  
  return new Response(readable, {
    headers: {
      'Transfer-Encoding': 'chunked',
      'Content-Type': 'application/json',
    }
  });
}`}
                  className="h-80 font-mono text-sm"
                />
              </TabsContent>

              <TabsContent value="protocol" className="space-y-4">
                <h4 className="font-medium">Chunked编码格式</h4>
                <Textarea
                  readOnly
                  value={`// Chunked编码格式
chunk-size(hex) CRLF
chunk-data CRLF
...
0 CRLF
CRLF

// 示例：发送 "Hello World"
B\\r\\n
Hello World\\r\\n
0\\r\\n
\\r\\n

// chunk-size: B (十六进制) = 11 (十进制)
// chunk-data: "Hello World" (11字节)
// 最后的 0 表示传输结束

// 实际HTTP响应
HTTP/1.1 200 OK
Transfer-Encoding: chunked
Content-Type: application/json

1A\\r\\n
{"type":"start","message":"开始"}\\r\\n
1F\\r\\n
{"type":"data","content":"数据块1"}\\r\\n
0\\r\\n
\\r\\n`}
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
