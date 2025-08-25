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
  Wifi,
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
  WifiOff,
  Zap,
  Server,
} from 'lucide-react';

interface SocketMessage {
  id: string;
  type:
    | 'info'
    | 'data'
    | 'success'
    | 'error'
    | 'status'
    | 'notification'
    | 'log'
    | 'chat-stream'
    | 'chat-complete'
    | 'chat-error';
  content: string;
  timestamp: number;
  payload?: any;
}

interface ChatPayload {
  message: string;
  system?: string;
  temperature?: number;
  modelName?: string;
  streaming?: boolean;
}

const socketExamples = [
  {
    id: 'chat',
    name: 'AI聊天对话',
    description: '使用LangChain进行真实AI对话',
    icon: '🤖',
  },
  {
    id: 'chat-stream',
    name: '流式AI聊天',
    description: '实时流式AI对话演示',
    icon: '💬',
  },
  {
    id: 'data-stream',
    name: '实时数据流',
    description: '高频数据推送和图表更新',
    icon: '📊',
  },
  {
    id: 'notification',
    name: '推送通知',
    description: '实时通知和消息推送',
    icon: '🔔',
  },
  {
    id: 'log-stream',
    name: '日志流',
    description: '实时日志监控和输出',
    icon: '📋',
  },
  {
    id: 'ping-pong',
    name: '心跳检测',
    description: '连接状态监控和心跳',
    icon: '💓',
  },
];

export default function SocketPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<SocketMessage[]>([]);
  const [customMessage, setCustomMessage] = useState('你好，请介绍一下你自己');
  const [selectedExample, setSelectedExample] = useState('chat-stream');
  const [connectionStatus, setConnectionStatus] = useState<
    'disconnected' | 'connecting' | 'connected' | 'error'
  >('disconnected');
  const [stats, setStats] = useState({
    messagesReceived: 0,
    messagesSent: 0,
    bytesReceived: 0,
    duration: 0,
  });
  const [streamingContent, setStreamingContent] = useState(''); // ChatGPT风格累积内容
  const [dataValues, setDataValues] = useState<number[]>([]); // 数据流值
  const [notifications, setNotifications] = useState<any[]>([]); // 通知列表
  const [aiSettings, setAiSettings] = useState({
    temperature: 0.7,
    modelName: 'gpt-3.5-turbo',
    system: 'You are a helpful AI assistant. Please respond in Chinese.',
  });

  const wsRef = useRef<WebSocket | null>(null);
  const startTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 组件卸载时清理资源
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
    };
  }, []);

  const addMessage = (
    type: SocketMessage['type'],
    content: string,
    payload?: any
  ) => {
    const message: SocketMessage = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      type,
      content,
      timestamp: Date.now(),
      payload,
    };
    setMessages((prev) => [...prev, message]);
    setStats((prev) => ({
      ...prev,
      messagesReceived: prev.messagesReceived + 1,
      bytesReceived: prev.bytesReceived + content.length,
    }));
  };

  const connectWebSocket = () => {
    console.log('🚀 开始WebSocket连接');

    // 防止重复连接
    if (isConnected || connectionStatus === 'connecting') {
      console.log('⚠️ 连接中或已连接，忽略重复请求');
      return;
    }

    if (wsRef.current) {
      console.log('🔄 关闭旧连接');
      wsRef.current.close();
    }

    // 清理之前的定时器
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }

    setConnectionStatus('connecting');
    setMessages([]);
    setStreamingContent('');
    setDataValues([]);
    setNotifications([]);
    setStats({
      messagesReceived: 0,
      messagesSent: 0,
      bytesReceived: 0,
      duration: 0,
    });
    startTimeRef.current = Date.now();

    // 连接到集成的WebSocket服务器（同端口）
    const wsUrl = `ws://${window.location.host}/api/websocket`;

    console.log('📡 创建WebSocket连接:', wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    // 开始计时
    durationIntervalRef.current = setInterval(() => {
      setStats((prev) => ({
        ...prev,
        duration: Date.now() - startTimeRef.current,
      }));
    }, 100);

    ws.onopen = () => {
      console.log('✅ WebSocket连接已打开');
      setConnectionStatus('connected');
      setIsConnected(true);
      addMessage('info', `🚀 已连接到集成 WebSocket 服务器`);
      addMessage('success', '✅ WebSocket连接已建立');

      // 发送初始消息，启动选中的演示
      startSelectedDemo();

      // 启动心跳检测
      if (selectedExample === 'ping-pong') {
        startPingPong();
      }
    };

    ws.onmessage = (event) => {
      console.log('📩 收到WebSocket消息:', event.data);

      try {
        // 解析JSON消息
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      } catch (error) {
        console.error('❌ 消息解析错误:', error);
        addMessage('error', `消息解析失败: ${event.data}`);
      }
    };

    ws.onerror = (error) => {
      console.error('❌ WebSocket错误:', error);
      setConnectionStatus('error');
      addMessage('error', '❌ WebSocket连接发生错误');
    };

    ws.onclose = (event) => {
      console.log('🔚 WebSocket连接已关闭:', event.code, event.reason);
      setConnectionStatus('disconnected');
      setIsConnected(false);
      addMessage('info', `🔚 WebSocket连接已关闭 (${event.code})`);

      // 清理定时器
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
    };
  };

  const handleWebSocketMessage = (data: any) => {
    const { type, payload } = data;

    switch (type) {
      case 'status':
        addMessage('info', payload?.message || '状态更新');
        break;

      case 'chat-start':
        addMessage('info', payload?.message || '🤖 AI开始思考...');
        setStreamingContent('');
        break;

      case 'chat-stream':
        if (payload?.content) {
          setStreamingContent((prev) => prev + payload.content);
          addMessage('data', `AI输出: ${payload.content}`);
        }
        break;

      case 'chat-complete':
        if (payload?.message) {
          addMessage('success', payload.message);
        }
        if (payload?.stats) {
          addMessage(
            'info',
            `📊 统计: ${payload.stats.chunks || 0} 块, ${payload.stats.tokens || 0} tokens`
          );
        }
        break;

      case 'chat-error':
        addMessage('error', payload?.message || '❌ AI聊天出错');
        break;

      case 'data-stream':
        if (payload) {
          setDataValues((prev) => [...prev.slice(-49), payload.value]); // 保持最近50个值
          addMessage('data', `数据点: ${payload.value?.toFixed(2) || 'N/A'}`);
        }
        break;

      case 'notification':
        if (payload) {
          setNotifications((prev) => [payload, ...prev.slice(0, 9)]); // 保持最近10个通知
          addMessage('notification', `${payload.title}: ${payload.message}`);
        }
        break;

      case 'log-stream':
        if (payload) {
          addMessage(
            'log',
            `[${payload.level?.toUpperCase() || 'INFO'}] ${payload.message}`
          );
        }
        break;

      case 'pong':
        addMessage('success', '🏓 收到心跳回应');
        break;

      case 'error':
        addMessage('error', payload?.message || data.message || '发生错误');
        break;

      default:
        addMessage('data', JSON.stringify(data));
    }
  };

  const startSelectedDemo = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const ws = wsRef.current;

    switch (selectedExample) {
      case 'chat':
        // 发送非流式聊天消息
        const chatMessage = {
          type: 'chat',
          payload: {
            message: customMessage,
            system: aiSettings.system,
            temperature: aiSettings.temperature,
            modelName: aiSettings.modelName,
          } as ChatPayload,
        };
        ws.send(JSON.stringify(chatMessage));
        addMessage('info', '🤖 发送AI聊天消息: ' + customMessage);
        setStats((prev) => ({ ...prev, messagesSent: prev.messagesSent + 1 }));
        break;

      case 'chat-stream':
        // 发送流式聊天消息
        const streamChatMessage = {
          type: 'chat-stream',
          payload: {
            message: customMessage,
            system: aiSettings.system,
            temperature: aiSettings.temperature,
            modelName: aiSettings.modelName,
          } as ChatPayload,
        };
        ws.send(JSON.stringify(streamChatMessage));
        addMessage('info', '💬 发送流式AI聊天消息: ' + customMessage);
        setStats((prev) => ({ ...prev, messagesSent: prev.messagesSent + 1 }));
        break;

      case 'data-stream':
        // 启动数据流演示
        const dataMessage = {
          type: 'data-stream',
          payload: { duration: 15000, interval: 200 },
        };
        ws.send(JSON.stringify(dataMessage));
        addMessage('info', '📊 启动数据流演示');
        setStats((prev) => ({ ...prev, messagesSent: prev.messagesSent + 1 }));
        break;

      case 'notification':
        // 启动通知演示
        const notificationMessage = { type: 'notification', payload: {} };
        ws.send(JSON.stringify(notificationMessage));
        addMessage('info', '🔔 启动通知推送演示');
        setStats((prev) => ({ ...prev, messagesSent: prev.messagesSent + 1 }));
        break;

      case 'log-stream':
        // 启动日志流演示
        const logMessage = { type: 'log-stream', payload: {} };
        ws.send(JSON.stringify(logMessage));
        addMessage('info', '📋 启动日志流演示');
        setStats((prev) => ({ ...prev, messagesSent: prev.messagesSent + 1 }));
        break;

      case 'ping-pong':
        addMessage('info', '💓 心跳检测模式已启动');
        break;
    }
  };

  const startPingPong = () => {
    if (!wsRef.current) return;

    pingIntervalRef.current = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const pingMessage = {
          type: 'ping',
          payload: { timestamp: Date.now() },
        };
        wsRef.current.send(JSON.stringify(pingMessage));
        addMessage('info', '🏓 发送心跳检测');
        setStats((prev) => ({ ...prev, messagesSent: prev.messagesSent + 1 }));
      }
    }, 3000);
  };

  const disconnectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
  };

  const sendCustomMessage = () => {
    if (
      !wsRef.current ||
      wsRef.current.readyState !== WebSocket.OPEN ||
      !customMessage.trim()
    ) {
      return;
    }

    const message = {
      type: 'custom',
      payload: { message: customMessage },
    };

    wsRef.current.send(JSON.stringify(message));
    addMessage('info', '📤 发送自定义消息: ' + customMessage);
    setStats((prev) => ({ ...prev, messagesSent: prev.messagesSent + 1 }));
  };

  const clearMessages = () => {
    setMessages([]);
    setStreamingContent('');
    setDataValues([]);
    setNotifications([]);
    setStats((prev) => ({ ...prev, messagesReceived: 0, bytesReceived: 0 }));
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

  const getMessageIcon = (type: SocketMessage['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'info':
      case 'status':
        return <Info className="h-4 w-4 text-blue-600" />;
      case 'notification':
        return <AlertCircle className="h-4 w-4 text-orange-600" />;
      case 'log':
        return <Activity className="h-4 w-4 text-purple-600" />;
      case 'chat-stream':
      case 'chat-complete':
      case 'chat-error':
        return <Activity className="h-4 w-4 text-green-600" />;
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
      title="WebSocket 双向通信 + AI"
      description="集成LangChain的高性能双向实时通信技术演示"
    >
      <div className="p-6 space-y-6">
        {/* WebSocket 介绍 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5 text-blue-600" />
              TypeScript WebSocket + LangChain
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-700">
              这是一个完整的 TypeScript WebSocket 服务器，集成了 LangChain
              进行真实的 AI 对话。
              支持流式聊天、数据流推送、通知系统等多种实时功能。
            </p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 border rounded-lg">
                <Wifi className="h-6 w-6 text-blue-600 mb-2" />
                <h4 className="font-medium mb-1">双向通信</h4>
                <p className="text-sm text-gray-600">真实的WebSocket连接</p>
              </div>
              <div className="p-4 border rounded-lg">
                <Activity className="h-6 w-6 text-green-600 mb-2" />
                <h4 className="font-medium mb-1">AI集成</h4>
                <p className="text-sm text-gray-600">LangChain + OpenAI</p>
              </div>
              <div className="p-4 border rounded-lg">
                <Clock className="h-6 w-6 text-purple-600 mb-2" />
                <h4 className="font-medium mb-1">流式输出</h4>
                <p className="text-sm text-gray-600">实时AI对话</p>
              </div>
              <div className="p-4 border rounded-lg">
                <TrendingUp className="h-6 w-6 text-orange-600 mb-2" />
                <h4 className="font-medium mb-1">高性能</h4>
                <p className="text-sm text-gray-600">TypeScript + 类型安全</p>
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
                <CardDescription>
                  选择演示功能并控制WebSocket连接
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 连接状态 */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">连接状态</span>
                  {getStatusBadge()}
                </div>

                {/* 示例选择 */}
                <div>
                  <Label>选择演示功能</Label>
                  <div className="mt-2 grid grid-cols-1 gap-2">
                    {socketExamples.map((example) => (
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

                {/* AI设置 */}
                {(selectedExample === 'chat' ||
                  selectedExample === 'chat-stream') && (
                  <div className="space-y-3 p-3 border rounded-lg bg-gray-50">
                    <Label className="text-sm font-medium">AI 配置</Label>
                    <div>
                      <Label htmlFor="temperature" className="text-xs">
                        温度 ({aiSettings.temperature})
                      </Label>
                      <Input
                        id="temperature"
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={aiSettings.temperature}
                        onChange={(e) =>
                          setAiSettings((prev) => ({
                            ...prev,
                            temperature: parseFloat(e.target.value),
                          }))
                        }
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="model" className="text-xs">
                        模型
                      </Label>
                      <Input
                        id="model"
                        value={aiSettings.modelName}
                        onChange={(e) =>
                          setAiSettings((prev) => ({
                            ...prev,
                            modelName: e.target.value,
                          }))
                        }
                        placeholder="gpt-3.5-turbo"
                        className="mt-1 text-xs"
                      />
                    </div>
                  </div>
                )}

                {/* 自定义消息 */}
                <div>
                  <Label htmlFor="custom-message">
                    {selectedExample.includes('chat')
                      ? 'AI 对话内容'
                      : '自定义消息'}
                  </Label>
                  <Textarea
                    id="custom-message"
                    placeholder={
                      selectedExample.includes('chat')
                        ? '输入要对话的内容...'
                        : '输入要发送的消息...'
                    }
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    className="mt-1"
                    rows={3}
                  />
                  {isConnected && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={sendCustomMessage}
                      className="mt-2 w-full"
                      disabled={!customMessage.trim()}
                    >
                      <Zap className="h-4 w-4 mr-2" />
                      {selectedExample.includes('chat')
                        ? '发送AI对话'
                        : '发送消息'}
                    </Button>
                  )}
                </div>

                {/* 控制按钮 */}
                <div className="flex gap-2">
                  <Button
                    onClick={connectWebSocket}
                    disabled={isConnected || connectionStatus === 'connecting'}
                    className="flex-1"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    连接
                  </Button>
                  {isConnected && (
                    <Button variant="outline" onClick={disconnectWebSocket}>
                      <Square className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* 统计信息 */}
                <div className="pt-4 border-t">
                  <h4 className="font-medium text-sm mb-2">连接统计</h4>
                  <div className="space-y-1 text-xs text-gray-600">
                    <div className="flex justify-between">
                      <span>已接收:</span>
                      <span>{stats.messagesReceived} 条</span>
                    </div>
                    <div className="flex justify-between">
                      <span>已发送:</span>
                      <span>{stats.messagesSent} 条</span>
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
            {/* 功能特定的展示区域 */}
            {(selectedExample === 'chat' ||
              selectedExample === 'chat-stream') && (
              <Card className="h-auto">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    🤖 AI对话展示
                    <Badge variant="secondary">
                      {selectedExample === 'chat-stream' ? '流式' : '标准'}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    使用LangChain进行真实的AI对话，支持自定义模型和参数
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
                        <p>点击"连接"开始AI对话</p>
                        <p className="text-xs mt-2">AI回复将在这里实时显示</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {selectedExample === 'data-stream' && (
              <Card className="h-auto">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    📊 实时数据流
                    <Badge variant="secondary">高频更新</Badge>
                  </CardTitle>
                  <CardDescription>实时数据图表更新演示</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg p-4 bg-white min-h-[200px]">
                    {dataValues.length > 0 ? (
                      <div className="space-y-4">
                        <div className="text-sm text-gray-600">
                          当前值:{' '}
                          {dataValues[dataValues.length - 1]?.toFixed(2)}
                        </div>
                        <div className="h-32 flex items-end space-x-1">
                          {dataValues.map((value, index) => (
                            <div
                              key={index}
                              className="bg-blue-500 rounded-t"
                              style={{
                                height: `${(value / 100) * 100}%`,
                                width: `${100 / dataValues.length}%`,
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-gray-500 py-12">
                        <div className="text-4xl mb-4">📊</div>
                        <p>连接后将显示实时数据图表</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {selectedExample === 'notification' && (
              <Card className="h-auto">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    🔔 实时通知
                    <Badge variant="secondary">推送提醒</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 min-h-[200px]">
                    {notifications.length > 0 ? (
                      notifications.map((notification, index) => (
                        <div
                          key={notification.id || index}
                          className="p-3 border rounded-lg bg-gray-50"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium text-sm">
                                {notification.title}
                              </h4>
                              <p className="text-xs text-gray-600">
                                {notification.message}
                              </p>
                            </div>
                            <span className="text-xs text-gray-500">
                              {new Date(
                                notification.timestamp
                              ).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center text-gray-500 py-12">
                        <div className="text-4xl mb-4">🔔</div>
                        <p>连接后将显示推送通知</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 实时消息流 */}
            <Card className="h-auto">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">WebSocket消息流</CardTitle>
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
                      <WifiOff className="h-12 w-12 mx-auto mb-4 opacity-30" />
                      <p>点击"连接"开始接收WebSocket消息</p>
                      <p className="text-xs mt-2">
                        使用集成模式时确保服务器以 npm run dev:integrated 启动
                      </p>
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
            <CardTitle>TypeScript WebSocket + LangChain 技术细节</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="setup" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="setup">服务器设置</TabsTrigger>
                <TabsTrigger value="client">客户端代码</TabsTrigger>
                <TabsTrigger value="features">功能特性</TabsTrigger>
              </TabsList>

              <TabsContent value="setup" className="space-y-4">
                <h4 className="font-medium">启动TypeScript WebSocket服务器</h4>
                <Textarea
                  readOnly
                  value={`# 1. 进入服务器目录
cd src/app/api/streaming/socket

# 2. 安装依赖
npm install

# 3. 配置环境变量 (.env)
WEBSOCKET_PORT=3001
OPEN_API_KEY=your_openai_api_key_here
OPEN_API_BASE_URL=https://api.openai.com/v1

# 4. 编译和运行
npm run build
npm run start

# 或者一步完成
npm run dev

# 服务器将在 ws://localhost:3001 启动`}
                  className="h-64 font-mono text-sm"
                />
              </TabsContent>

              <TabsContent value="client" className="space-y-4">
                <h4 className="font-medium">前端WebSocket连接代码</h4>
                <Textarea
                  readOnly
                  value={`// 连接到TypeScript WebSocket服务器
const ws = new WebSocket('ws://localhost:3001');

// 发送AI聊天消息
ws.send(JSON.stringify({
  type: 'chat-stream',
  payload: {
    message: '你好，请介绍一下自己',
    system: 'You are a helpful AI assistant.',
    temperature: 0.7,
    modelName: 'gpt-3.5-turbo'
  }
}));

// 监听AI流式响应
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch (data.type) {
    case 'chat-stream':
      // 实时显示AI回复
      displayContent += data.payload.content;
      break;
    case 'chat-complete':
      // AI回复完成
      console.log('AI回复完成');
      break;
  }
};`}
                  className="h-64 font-mono text-sm"
                />
              </TabsContent>

              <TabsContent value="features" className="space-y-4">
                <h4 className="font-medium">主要功能特性</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <h5 className="font-medium mb-2">🤖 AI集成</h5>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• LangChain + OpenAI集成</li>
                      <li>• 支持流式和非流式对话</li>
                      <li>• 自定义模型参数</li>
                      <li>• 完整的错误处理</li>
                    </ul>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h5 className="font-medium mb-2">⚡ 高性能</h5>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• TypeScript类型安全</li>
                      <li>• 消息压缩支持</li>
                      <li>• 自动连接管理</li>
                      <li>• 心跳检测机制</li>
                    </ul>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h5 className="font-medium mb-2">📡 实时通信</h5>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• 双向数据传输</li>
                      <li>• 广播消息支持</li>
                      <li>• 多客户端管理</li>
                      <li>• 消息类型路由</li>
                    </ul>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h5 className="font-medium mb-2">🔧 开发友好</h5>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• 完整的TypeScript支持</li>
                      <li>• 详细的日志输出</li>
                      <li>• 环境变量配置</li>
                      <li>• 优雅关闭处理</li>
                    </ul>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </TestPageLayout>
  );
}
