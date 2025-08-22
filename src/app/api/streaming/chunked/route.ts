import { NextRequest } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';
import {
  ChatPromptTemplate,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
} from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';

interface ChunkedRequestPayload {
  message?: string;
  type?: 'text' | 'ai-chat' | 'data-stream' | 'log-stream';
  system?: string;
  temperature?: number;
  modelName?: string;
  duration?: number;
  interval?: number;
}

// GET方法 - 简单文本流式输出
export async function GET(request: NextRequest) {
  console.log('🚀 Chunked Transfer请求开始:', new Date().toISOString());

  const searchParams = request.nextUrl.searchParams;
  const message = searchParams.get('message') || 'Chunked Transfer演示文本';
  const type = (searchParams.get('type') as 'text' | 'data-stream') || 'text';

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      console.log('📡 Chunked ReadableStream开始');

      try {
        if (type === 'text') {
          await handleTextStream(controller, encoder, message);
        } else if (type === 'data-stream') {
          await handleDataStream(controller, encoder);
        }
      } catch (error) {
        console.error('❌ Chunked处理错误:', error);
        const errorData = JSON.stringify({
          type: 'error',
          message: error instanceof Error ? error.message : '未知错误',
          timestamp: Date.now(),
        });
        controller.enqueue(
          encoder.encode(`${errorData.length.toString(16)}\r\n${errorData}\r\n`)
        );
        controller.enqueue(encoder.encode('0\r\n\r\n')); // 结束标记
        controller.close();
      }
    },

    cancel(reason) {
      console.log('✅ Chunked客户端关闭连接:', reason?.name || reason);
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'application/json',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

// POST方法 - AI聊天流式输出
export async function POST(request: NextRequest) {
  console.log('🤖 Chunked AI聊天请求开始:', new Date().toISOString());

  const body = (await request.json()) as ChunkedRequestPayload;
  const {
    message = '你好，请介绍一下Chunked Transfer编码',
    type = 'ai-chat',
    system = 'You are a helpful AI assistant. Please respond in Chinese.',
    temperature = 0.7,
    modelName = 'gpt-3.5-turbo',
  } = body;

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        if (type === 'ai-chat') {
          await handleAIChatStream(controller, encoder, {
            message,
            system,
            temperature,
            modelName,
          });
        } else if (type === 'log-stream') {
          await handleLogStream(controller, encoder);
        }
      } catch (error) {
        console.error('❌ Chunked AI处理错误:', error);
        const errorData = JSON.stringify({
          type: 'error',
          message: error instanceof Error ? error.message : '未知错误',
          timestamp: Date.now(),
        });
        controller.enqueue(
          encoder.encode(`${errorData.length.toString(16)}\r\n${errorData}\r\n`)
        );
        controller.enqueue(encoder.encode('0\r\n\r\n'));
        controller.close();
      }
    },

    cancel(reason) {
      console.log('✅ Chunked AI客户端关闭连接:', reason?.name || reason);
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'application/json',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

// 发送Chunked数据的辅助函数
function sendChunk(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  data: any
) {
  const jsonData = JSON.stringify(data);
  const chunkSize = jsonData.length.toString(16); // 十六进制长度
  controller.enqueue(encoder.encode(`${chunkSize}\r\n${jsonData}\r\n`));
}

// 文本流处理
async function handleTextStream(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  message: string
) {
  console.log('📤 开始Chunked文本流');

  // 发送开始消息
  sendChunk(controller, encoder, {
    type: 'start',
    message: '🎉 Chunked Transfer连接建立成功！',
    timestamp: Date.now(),
  });

  // 分段发送消息
  const segments = [
    '欢迎使用 Chunked Transfer 流式输出！',
    `您的消息: ${message}`,
    '这是第一段数据...',
    '这是第二段数据...',
    '这是第三段数据...',
    'Chunked Transfer编码允许服务器在不知道总内容长度的情况下发送数据',
    '每个数据块都有自己的长度标识',
    '这样可以实现真正的流式传输',
    '非常适合实时数据推送场景',
    '演示即将结束...',
  ];

  for (let i = 0; i < segments.length; i++) {
    console.log(`📤 发送Chunked片段 ${i + 1}/${segments.length}`);

    sendChunk(controller, encoder, {
      type: 'data',
      content: segments[i],
      index: i + 1,
      total: segments.length,
      progress: Math.round(((i + 1) / segments.length) * 100),
      timestamp: Date.now(),
    });

    // 延迟模拟流式效果
    await new Promise((resolve) => setTimeout(resolve, 800));
  }

  // 发送完成消息
  sendChunk(controller, encoder, {
    type: 'complete',
    message: '✅ Chunked Transfer演示完成',
    totalSegments: segments.length,
    timestamp: Date.now(),
  });

  // 发送结束标记
  controller.enqueue(encoder.encode('0\r\n\r\n'));
  controller.close();
}

// AI聊天流处理
async function handleAIChatStream(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  options: {
    message: string;
    system: string;
    temperature: number;
    modelName: string;
  }
) {
  const { message, system, temperature, modelName } = options;

  console.log('🤖 开始Chunked AI聊天流');

  // 验证API密钥
  if (!process.env.OPEN_API_KEY) {
    sendChunk(controller, encoder, {
      type: 'error',
      message: '❌ 未配置OpenAI API密钥',
      timestamp: Date.now(),
    });
    controller.enqueue(encoder.encode('0\r\n\r\n'));
    controller.close();
    return;
  }

  // 发送开始消息
  sendChunk(controller, encoder, {
    type: 'chat-start',
    message: '🤖 AI正在思考您的问题...',
    model: modelName,
    timestamp: Date.now(),
  });

  try {
    // 初始化AI模型
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

    // 创建提示模板
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

    let chunkCount = 0;
    let totalContent = '';

    for await (const chunk of stream) {
      chunkCount++;
      totalContent += chunk;

      // 发送流式内容
      sendChunk(controller, encoder, {
        type: 'chat-stream',
        content: chunk,
        chunkCount,
        totalLength: totalContent.length,
        timestamp: Date.now(),
      });
    }

    // 发送完成消息
    sendChunk(controller, encoder, {
      type: 'chat-complete',
      message: '✅ AI回答生成完成',
      totalChunks: chunkCount,
      totalContent: totalContent,
      model: modelName,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('❌ AI处理错误:', error);
    sendChunk(controller, encoder, {
      type: 'chat-error',
      message: `❌ AI处理失败: ${error instanceof Error ? error.message : '未知错误'}`,
      timestamp: Date.now(),
    });
  }

  // 发送结束标记
  controller.enqueue(encoder.encode('0\r\n\r\n'));
  controller.close();
}

// 数据流处理
async function handleDataStream(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder
) {
  console.log('📊 开始Chunked数据流');

  sendChunk(controller, encoder, {
    type: 'data-start',
    message: '📊 开始实时数据流传输',
    timestamp: Date.now(),
  });

  // 生成20个数据点
  for (let i = 0; i < 20; i++) {
    const dataPoint = {
      type: 'data-point',
      timestamp: Date.now(),
      index: i + 1,
      value: Math.sin(i * 0.3) * 50 + 50 + Math.random() * 10,
      cpu: Math.random() * 100,
      memory: Math.random() * 100,
      network: Math.random() * 1000,
      temperature: Math.random() * 40 + 20,
    };

    sendChunk(controller, encoder, dataPoint);
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  sendChunk(controller, encoder, {
    type: 'data-complete',
    message: '✅ 数据流传输完成',
    totalPoints: 20,
    timestamp: Date.now(),
  });

  controller.enqueue(encoder.encode('0\r\n\r\n'));
  controller.close();
}

// 日志流处理
async function handleLogStream(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder
) {
  console.log('📝 开始Chunked日志流');

  const logs = [
    { level: 'info', message: 'Chunked Transfer 系统启动' },
    { level: 'debug', message: '加载配置文件...' },
    { level: 'info', message: '数据库连接已建立' },
    { level: 'warn', message: '检测到高CPU使用率: 85%' },
    { level: 'info', message: '处理用户请求...' },
    { level: 'debug', message: '执行数据查询操作' },
    { level: 'error', message: '网络连接超时，正在重试...' },
    { level: 'info', message: '重连成功' },
    { level: 'debug', message: '数据处理完成' },
    { level: 'info', message: '响应已发送' },
  ];

  sendChunk(controller, encoder, {
    type: 'log-start',
    message: '📝 开始日志流传输',
    timestamp: Date.now(),
  });

  for (let i = 0; i < logs.length; i++) {
    const logEntry = {
      type: 'log-entry',
      ...logs[i],
      timestamp: Date.now(),
      id: `log_${Date.now()}_${i}`,
      index: i + 1,
    };

    sendChunk(controller, encoder, logEntry);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  sendChunk(controller, encoder, {
    type: 'log-complete',
    message: '✅ 日志流传输完成',
    totalLogs: logs.length,
    timestamp: Date.now(),
  });

  controller.enqueue(encoder.encode('0\r\n\r\n'));
  controller.close();
}
