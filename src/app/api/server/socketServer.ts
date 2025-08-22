/**
 * 自定义 Next.js 服务器，集成 WebSocket 功能
 * 这样可以在同一个端口同时提供 HTTP 和 WebSocket 服务
 */

import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import WebSocket from 'ws';
import { IncomingMessage } from 'http';
import { ChatOpenAI } from '@langchain/openai';
import {
  ChatPromptTemplate,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
} from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

// 准备 Next.js 应用
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// WebSocket 消息类型接口
interface WebSocketMessage {
  type:
    | 'ping'
    | 'chat'
    | 'chat-stream'
    | 'data-stream'
    | 'notification'
    | 'log-stream'
    | 'broadcast'
    | 'custom';
  payload: any;
}

interface ChatPayload {
  message: string;
  system?: string;
  temperature?: number;
  modelName?: string;
}

interface ClientConnection {
  ws: WebSocket;
  id: string;
  connectedAt: number;
  lastPing: number;
}

// 存储活跃连接
const clients = new Map<string, ClientConnection>();

app.prepare().then(() => {
  // 创建 HTTP 服务器
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // 创建 WebSocket 服务器，附加到同一个 HTTP 服务器
  const wss = new (WebSocket as any).Server({
    server,
    path: '/api/websocket', // WebSocket 路径
    perMessageDeflate: {
      threshold: 1024,
      concurrencyLimit: 10,
    },
  });

  console.log('🚀 集成 WebSocket 服务器启动中...');

  // 处理 WebSocket 连接
  wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
    const clientId = generateClientId();
    const client: ClientConnection = {
      ws,
      id: clientId,
      connectedAt: Date.now(),
      lastPing: Date.now(),
    };

    clients.set(clientId, client);

    console.log(`✅ 新客户端连接: ${clientId}, 总连接数: ${clients.size}`);

    // 发送欢迎消息
    sendMessage(ws, {
      type: 'status',
      payload: {
        message: `🎉 欢迎连接到集成 WebSocket 服务器!`,
        clientId,
        serverTime: new Date().toISOString(),
        integrated: true,
      },
    });

    // 监听客户端消息
    ws.on('message', async (data: WebSocket.Data) => {
      try {
        const message: WebSocketMessage = JSON.parse(data.toString());
        console.log(`📩 收到客户端 ${clientId} 消息:`, message.type);

        await handleMessage(client, message);
      } catch (error) {
        console.error(`❌ 消息处理错误 (${clientId}):`, error);
        sendMessage(ws, {
          type: 'error',
          payload: {
            message: '消息格式错误',
            error: error instanceof Error ? error.message : '未知错误',
          },
        });
      }
    });

    // 处理连接关闭
    ws.on('close', (code: number, reason: Buffer) => {
      console.log(
        `🔚 客户端 ${clientId} 断开连接: ${code} - ${reason.toString()}`
      );
      clients.delete(clientId);
      console.log(`📊 当前连接数: ${clients.size}`);
    });

    // 处理连接错误
    ws.on('error', (error: Error) => {
      console.error(`❌ 客户端 ${clientId} 连接错误:`, error);
      clients.delete(clientId);
    });

    // 处理心跳响应
    ws.on('pong', () => {
      client.lastPing = Date.now();
      console.log(`💓 收到客户端 ${clientId} 心跳响应`);
    });
  });

  // 处理不同类型的消息
  async function handleMessage(
    client: ClientConnection,
    message: WebSocketMessage
  ): Promise<void> {
    const { ws } = client;
    const { type, payload } = message;

    try {
      switch (type) {
        case 'ping':
          await handlePing(client, payload);
          break;

        case 'chat':
          await handleChatMessage(client, payload as ChatPayload);
          break;

        case 'chat-stream':
          await handleStreamingChat(client, payload as ChatPayload);
          break;

        case 'data-stream':
          await handleDataStream(client, payload);
          break;

        case 'notification':
          await handleNotification(client, payload);
          break;

        case 'log-stream':
          await handleLogStream(client, payload);
          break;

        case 'broadcast':
          await handleBroadcast(client, payload);
          break;

        case 'custom':
          await handleCustomMessage(client, payload);
          break;

        default:
          sendMessage(ws, {
            type: 'error',
            payload: { message: `未知消息类型: ${type}` },
          });
      }
    } catch (error) {
      console.error(`❌ 处理消息 ${type} 时出错:`, error);
      sendMessage(ws, {
        type: 'error',
        payload: {
          message: `处理 ${type} 消息失败`,
          error: error instanceof Error ? error.message : '未知错误',
        },
      });
    }
  }

  // 处理心跳检测
  async function handlePing(
    client: ClientConnection,
    payload: any
  ): Promise<void> {
    client.lastPing = Date.now();
    sendMessage(client.ws, {
      type: 'pong',
      payload: {
        timestamp: Date.now(),
        originalTimestamp: payload?.timestamp || null,
        clientId: client.id,
        integrated: true,
      },
    });
  }

  // 处理AI聊天消息 - 非流式
  async function handleChatMessage(
    client: ClientConnection,
    payload: ChatPayload
  ): Promise<void> {
    const {
      message,
      system = 'You are a helpful AI assistant. Please respond in Chinese.',
      temperature = 0.7,
      modelName = 'gpt-3.5-turbo',
    } = payload;

    console.log(`🤖 开始处理客户端 ${client.id} 的AI聊天:`, {
      message,
      modelName,
    });

    // 验证环境变量
    if (!process.env.OPEN_API_KEY) {
      sendMessage(client.ws, {
        type: 'chat-error',
        payload: { message: '❌ 服务器未配置 OpenAI API 密钥' },
      });
      return;
    }

    // 发送开始状态
    sendMessage(client.ws, {
      type: 'chat-start',
      payload: { message: '🤖 正在思考您的问题...', integrated: true },
    });

    try {
      // 初始化 ChatOpenAI
      const llm = new ChatOpenAI({
        openAIApiKey: process.env.OPEN_API_KEY!,
        modelName: modelName,
        temperature: temperature,
        maxTokens: 2000,
        configuration: {
          baseURL: process.env.OPEN_API_BASE_URL,
        },
      });

      // 创建聊天提示模板
      const chatPrompt = ChatPromptTemplate.fromMessages([
        SystemMessagePromptTemplate.fromTemplate(system),
        HumanMessagePromptTemplate.fromTemplate('{userMessage}'),
      ]);

      // 创建处理链
      const chain = chatPrompt.pipe(llm).pipe(new StringOutputParser());

      console.log(`🔗 客户端 ${client.id} 开始调用 LLM...`);

      // 调用LLM
      const response = await chain.invoke({
        userMessage: message,
      });

      console.log(`✅ 客户端 ${client.id} LLM 响应完成`);

      // 发送完整回复
      sendMessage(client.ws, {
        type: 'chat-complete',
        payload: {
          message: response,
          originalMessage: message,
          model: modelName,
          temperature: temperature,
          timestamp: Date.now(),
          integrated: true,
          stats: {
            responseLength: response.length,
            clientId: client.id,
          },
        },
      });
    } catch (error) {
      console.error(`❌ 客户端 ${client.id} LLM 调用错误:`, error);
      sendMessage(client.ws, {
        type: 'chat-error',
        payload: {
          message: `AI处理失败: ${error instanceof Error ? error.message : '未知错误'}`,
          originalMessage: message,
          integrated: true,
        },
      });
    }
  }

  // 处理流式AI聊天
  async function handleStreamingChat(
    client: ClientConnection,
    payload: ChatPayload
  ): Promise<void> {
    const {
      message,
      system = 'You are a helpful AI assistant. Please respond in Chinese.',
      temperature = 0.7,
      modelName = 'gpt-3.5-turbo',
    } = payload;

    console.log(`🌊 开始处理客户端 ${client.id} 的流式AI聊天:`, {
      message,
      modelName,
    });

    // 验证环境变量
    if (!process.env.OPEN_API_KEY) {
      sendMessage(client.ws, {
        type: 'chat-error',
        payload: { message: '❌ 服务器未配置 OpenAI API 密钥' },
      });
      return;
    }

    // 发送开始状态
    sendMessage(client.ws, {
      type: 'chat-start',
      payload: { message: '🤖 正在思考您的问题...', integrated: true },
    });

    try {
      // 初始化 ChatOpenAI（流式模式）
      const llm = new ChatOpenAI({
        openAIApiKey: process.env.OPEN_API_KEY!,
        modelName: modelName,
        temperature: temperature,
        maxTokens: 2000,
        streaming: true,
        configuration: {
          baseURL: process.env.OPEN_API_BASE_URL,
        },
      });

      // 创建聊天提示模板
      const chatPrompt = ChatPromptTemplate.fromMessages([
        SystemMessagePromptTemplate.fromTemplate(system),
        HumanMessagePromptTemplate.fromTemplate('{userMessage}'),
      ]);

      // 创建处理链
      const chain = chatPrompt.pipe(llm).pipe(new StringOutputParser());

      console.log(`🔗 客户端 ${client.id} 开始流式调用 LLM...`);

      // 流式调用
      const stream = await chain.stream({
        userMessage: message,
      });

      let totalTokens = 0;
      let chunkCount = 0;
      let fullResponse = '';

      for await (const chunk of stream) {
        // 检查连接是否还活跃
        if (client.ws.readyState !== WebSocket.OPEN) {
          console.log(`⚠️ 客户端 ${client.id} 连接已断开，停止流式传输`);
          break;
        }

        chunkCount++;
        totalTokens += chunk.length;
        fullResponse += chunk;

        // 发送流式内容
        sendMessage(client.ws, {
          type: 'chat-stream',
          payload: {
            content: chunk,
            chunkCount,
            totalTokens,
            integrated: true,
          },
        });

        // 添加小延迟以模拟真实的流式效果
        await new Promise((resolve) => setTimeout(resolve, 30));
      }

      console.log(
        `✅ 客户端 ${client.id} 流式响应完成: ${chunkCount} chunks, ${totalTokens} tokens`
      );

      // 发送完成状态
      sendMessage(client.ws, {
        type: 'chat-complete',
        payload: {
          message: '✅ 回答生成完成',
          fullResponse,
          integrated: true,
          stats: {
            chunks: chunkCount,
            tokens: totalTokens,
            model: modelName,
            clientId: client.id,
          },
        },
      });
    } catch (error) {
      console.error(`❌ 客户端 ${client.id} 流式聊天错误:`, error);
      sendMessage(client.ws, {
        type: 'chat-error',
        payload: {
          message: `流式AI处理失败: ${error instanceof Error ? error.message : '未知错误'}`,
          originalMessage: message,
          integrated: true,
        },
      });
    }
  }

  // 其他处理函数...
  async function handleDataStream(
    client: ClientConnection,
    payload: any
  ): Promise<void> {
    // 实现数据流逻辑
    sendMessage(client.ws, {
      type: 'data-stream',
      payload: { value: Math.random() * 100, integrated: true },
    });
  }

  async function handleNotification(
    client: ClientConnection,
    payload: any
  ): Promise<void> {
    // 实现通知逻辑
    sendMessage(client.ws, {
      type: 'notification',
      payload: {
        title: '集成通知',
        message: '来自集成WebSocket服务器的通知',
        integrated: true,
      },
    });
  }

  async function handleLogStream(
    client: ClientConnection,
    payload: any
  ): Promise<void> {
    // 实现日志流逻辑
    sendMessage(client.ws, {
      type: 'log-stream',
      payload: {
        level: 'info',
        message: '来自集成服务器的日志',
        integrated: true,
      },
    });
  }

  async function handleBroadcast(
    client: ClientConnection,
    payload: any
  ): Promise<void> {
    // 广播给所有客户端
    broadcastToAll(
      {
        type: 'broadcast',
        payload: {
          message: payload.message || '广播消息',
          from: client.id,
          integrated: true,
        },
      },
      client.id
    );
  }

  async function handleCustomMessage(
    client: ClientConnection,
    payload: any
  ): Promise<void> {
    sendMessage(client.ws, {
      type: 'custom-response',
      payload: {
        response: `集成服务器收到: ${payload.message}`,
        integrated: true,
      },
    });
  }

  // 辅助函数
  function sendMessage(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  function broadcastToAll(message: any, excludeClientId?: string): void {
    const data = JSON.stringify(message);
    let sentCount = 0;

    clients.forEach((client, clientId) => {
      if (
        clientId !== excludeClientId &&
        client.ws.readyState === WebSocket.OPEN
      ) {
        client.ws.send(data);
        sentCount++;
      }
    });

    console.log(`📢 广播消息给 ${sentCount} 个客户端`);
  }

  function generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 心跳检测
  function startHeartbeat(): void {
    setInterval(() => {
      const now = Date.now();
      const timeout = 60000; // 60秒超时

      clients.forEach((client, clientId) => {
        if (now - client.lastPing > timeout) {
          console.log(`💀 客户端 ${clientId} 心跳超时，断开连接`);
          client.ws.terminate();
          clients.delete(clientId);
        } else if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.ping();
        }
      });
    }, 30000); // 每30秒检查一次
  }

  // 启动服务器
  server.listen(port, (err?: any) => {
    if (err) throw err;

    console.log(`🎯 Next.js + WebSocket 集成服务器运行在:`);
    console.log(`   🌐 HTTP: http://${hostname}:${port}`);
    console.log(`   📡 WebSocket: ws://${hostname}:${port}/api/websocket`);
    console.log(`📊 功能特性:`);
    console.log(`   ✅ Next.js 前端`);
    console.log(`   ✅ WebSocket 实时通信`);
    console.log(`   ✅ LangChain AI 集成`);
    console.log(`   ✅ TypeScript 类型安全`);
    console.log(`🚀 服务器启动完成！`);

    // 启动心跳检测
    startHeartbeat();
  });

  // 优雅关闭
  process.on('SIGINT', () => {
    console.log('\n🔚 正在关闭集成服务器...');

    // 通知所有客户端服务器即将关闭
    broadcastToAll({
      type: 'status',
      payload: { message: '🔚 服务器即将关闭，连接将在 3 秒后断开' },
    });

    setTimeout(() => {
      server.close(() => {
        console.log('✅ 集成服务器已关闭');
        process.exit(0);
      });
    }, 3000);
  });
});
