import { NextRequest } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';
import {
  ChatPromptTemplate,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
} from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';

// 定义消息类型接口
interface WebSocketMessage {
  type:
    | 'ping'
    | 'chat'
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

interface DataStreamPayload {
  duration?: number;
  interval?: number;
}

// 存储活跃的连接（实际项目中应该使用外部存储）
const activeConnections = new Set<WebSocket>();

export async function GET(request: NextRequest) {
  console.log('🚀 WebSocket API 状态检查:', new Date().toISOString());

  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get('type') || 'status';

  // 返回WebSocket服务状态信息
  return Response.json({
    status: 'ready',
    message: 'WebSocket API服务已准备就绪',
    timestamp: Date.now(),
    type: type,
    features: {
      aiChat: true,
      dataStream: true,
      notifications: true,
      logStream: true,
      heartbeat: true,
    },
    endpoints: {
      websocket: process.env.WEBSOCKET_URL || 'ws://localhost:3001',
      fallback: '/api/streaming/socket',
    },
  });
}

// 处理WebSocket消息的核心函数
export async function POST(request: NextRequest) {
  const body = (await request.json()) as WebSocketMessage;
  const { type, payload } = body;

  console.log('📩 处理WebSocket消息:', { type, payload });

  try {
    switch (type) {
      case 'ping':
        return handlePing(payload);

      case 'chat':
        return await handleChatMessage(payload as ChatPayload);

      case 'data-stream':
        return await handleDataStream(payload as DataStreamPayload);

      case 'notification':
        return handleNotification(payload);

      case 'log-stream':
        return handleLogStream(payload);

      case 'broadcast':
        return handleBroadcast(payload);

      case 'custom':
        return handleCustomMessage(payload);

      default:
        return Response.json(
          {
            type: 'error',
            message: `未知消息类型: ${type}`,
            timestamp: Date.now(),
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('❌ 消息处理错误:', error);
    const errorMessage = error instanceof Error ? error.message : '未知错误';

    return Response.json(
      {
        type: 'error',
        message: '消息处理失败',
        error: errorMessage,
        timestamp: Date.now(),
      },
      { status: 500 }
    );
  }
}

// 处理心跳检测
function handlePing(payload: any) {
  return Response.json({
    type: 'pong',
    payload: {
      timestamp: Date.now(),
      originalTimestamp: payload?.timestamp || null,
    },
  });
}

// 处理AI聊天消息 - 使用LangChain和TypeScript
async function handleChatMessage(payload: ChatPayload): Promise<Response> {
  const {
    message,
    system = 'You are a helpful AI assistant. Respond in a conversational and friendly manner.',
    temperature = 0.7,
    modelName = 'gpt-3.5-turbo',
  } = payload;

  console.log('🤖 开始处理AI聊天:', { message, modelName, temperature });

  // 验证环境变量
  if (!process.env.OPEN_API_KEY) {
    return Response.json(
      {
        type: 'error',
        message: '❌ 未配置OpenAI API密钥',
      },
      { status: 500 }
    );
  }

  try {
    // 初始化ChatOpenAI
    const llm = new ChatOpenAI({
      openAIApiKey: process.env.OPEN_API_KEY,
      modelName: modelName,
      temperature: temperature,
      maxTokens: 2000,
      configuration: {
        baseURL: process.env.OPEN_API_BASE_URL,
      },
      verbose: true,
    });

    // 创建聊天提示模板
    const chatPrompt = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(system),
      HumanMessagePromptTemplate.fromTemplate('{userMessage}'),
    ]);

    // 创建处理链
    const chain = chatPrompt.pipe(llm).pipe(new StringOutputParser());

    console.log('🔗 开始调用LLM...');

    // 非流式调用（适合WebSocket场景）
    const response = await chain.invoke({
      userMessage: message,
    });

    console.log('✅ LLM响应完成');

    // 返回聊天结果
    return Response.json({
      type: 'chat-complete',
      payload: {
        message: response,
        originalMessage: message,
        model: modelName,
        temperature: temperature,
        timestamp: Date.now(),
        stats: {
          responseLength: response.length,
          processingTime: Date.now(),
        },
      },
    });
  } catch (error) {
    console.error('❌ LLM调用错误:', error);
    const errorMessage = error instanceof Error ? error.message : '未知错误';

    return Response.json(
      {
        type: 'chat-error',
        message: `AI处理失败: ${errorMessage}`,
        originalMessage: message,
        timestamp: Date.now(),
      },
      { status: 500 }
    );
  }
}

// 处理流式AI聊天（返回ReadableStream）
export async function PATCH(request: NextRequest) {
  const body = (await request.json()) as ChatPayload;
  const {
    message,
    system = 'You are a helpful AI assistant. Respond in a conversational and friendly manner.',
    temperature = 0.7,
    modelName = 'gpt-3.5-turbo',
  } = body;

  console.log('🌊 开始处理流式AI聊天:', { message, modelName });

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        // 发送开始状态
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'chat-start',
              payload: { message: '🤖 正在思考您的问题...' },
            })}\n\n`
          )
        );

        // 初始化ChatOpenAI（流式模式）
        const llm = new ChatOpenAI({
          openAIApiKey: process.env.OPEN_API_KEY,
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

        // 流式调用
        const stream = await chain.stream({
          userMessage: message,
        });

        let totalTokens = 0;
        let chunkCount = 0;

        for await (const chunk of stream) {
          chunkCount++;
          totalTokens += chunk.length;

          // 发送流式内容
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'chat-stream',
                payload: {
                  content: chunk,
                  chunkCount,
                  totalTokens,
                },
              })}\n\n`
            )
          );
        }

        // 发送完成状态
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'chat-complete',
              payload: {
                message: '✅ 回答生成完成',
                stats: {
                  chunks: chunkCount,
                  tokens: totalTokens,
                  model: modelName,
                },
              },
            })}\n\n`
          )
        );

        controller.close();
      } catch (error) {
        console.error('❌ 流式聊天错误:', error);
        const errorMessage =
          error instanceof Error ? error.message : '未知错误';

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'chat-error',
              message: `❌ 生成回答时出错: ${errorMessage}`,
            })}\n\n`
          )
        );

        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

// 处理数据流
async function handleDataStream(payload: DataStreamPayload): Promise<Response> {
  const { duration = 15000, interval = 200 } = payload;

  console.log('📊 开始数据流演示:', { duration, interval });

  // 生成模拟数据
  const dataPoints = [];
  const totalPoints = Math.floor(duration / interval);

  for (let i = 0; i < Math.min(totalPoints, 50); i++) {
    const progress = i / totalPoints;
    dataPoints.push({
      timestamp: Date.now() + i * interval,
      value: Math.sin(progress * Math.PI * 4) * 50 + 50 + Math.random() * 10,
      cpu: Math.random() * 100,
      memory: Math.random() * 100,
      network: Math.random() * 1000,
      progress: Math.round(progress * 100),
    });
  }

  return Response.json({
    type: 'data-stream-batch',
    payload: {
      data: dataPoints,
      totalPoints: dataPoints.length,
      duration: duration,
      interval: interval,
    },
  });
}

// 处理通知
function handleNotification(payload: any): Response {
  const notifications = [
    { type: 'info', title: '系统通知', message: '欢迎使用 WebSocket 通知系统' },
    { type: 'success', title: '操作成功', message: '数据已成功保存到数据库' },
    {
      type: 'warning',
      title: '注意',
      message: '系统资源使用率较高，请注意监控',
    },
    { type: 'error', title: '错误', message: '网络连接出现问题，正在自动重试' },
    { type: 'info', title: '更新', message: '发现新版本 v2.1.0，建议立即更新' },
  ];

  const randomNotification =
    notifications[Math.floor(Math.random() * notifications.length)];

  return Response.json({
    type: 'notification',
    payload: {
      ...randomNotification,
      id: Date.now(),
      timestamp: Date.now(),
    },
  });
}

// 处理日志流
function handleLogStream(payload: any): Response {
  const logs = [
    { level: 'info', message: '系统启动中...' },
    { level: 'debug', message: '加载配置文件 config.json' },
    { level: 'info', message: '数据库连接已建立 (MongoDB)' },
    { level: 'warn', message: '检测到高延迟，当前延迟 250ms' },
    { level: 'info', message: '处理用户请求 GET /api/users' },
    { level: 'debug', message: '执行查询操作 db.users.find()' },
    { level: 'error', message: '连接超时，正在重试... (1/3)' },
    { level: 'info', message: '重连成功，连接已恢复' },
    { level: 'debug', message: '数据处理完成，返回 156 条记录' },
    { level: 'info', message: '响应已发送，耗时 423ms' },
  ];

  const batchLogs = logs.slice(0, 5).map((log, index) => ({
    ...log,
    timestamp: Date.now() + index * 100,
    id: Date.now() + index,
  }));

  return Response.json({
    type: 'log-stream-batch',
    payload: {
      logs: batchLogs,
      totalLogs: batchLogs.length,
    },
  });
}

// 处理广播消息
function handleBroadcast(payload: any): Response {
  console.log('📢 处理广播消息:', payload);

  return Response.json({
    type: 'broadcast',
    payload: {
      message: payload.message || '这是一条广播消息',
      from: 'server',
      timestamp: Date.now(),
      connectionCount: activeConnections.size,
    },
  });
}

// 处理自定义消息
function handleCustomMessage(payload: any): Response {
  console.log('🔧 处理自定义消息:', payload);

  return Response.json({
    type: 'custom-response',
    payload: {
      originalMessage: payload.message || payload,
      response: `服务器收到您的消息: "${payload.message || JSON.stringify(payload)}"`,
      timestamp: Date.now(),
    },
  });
}
