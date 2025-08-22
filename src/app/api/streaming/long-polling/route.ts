import { NextRequest } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';
import {
  ChatPromptTemplate,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
} from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';

interface LongPollingRequestPayload {
  message?: string;
  type?: 'text' | 'ai-chat' | 'data-stream' | 'log-stream' | 'notification';
  system?: string;
  temperature?: number;
  modelName?: string;
  timeout?: number;
  sequence?: number;
  clientId?: string;
}

// 模拟数据存储 - 实际项目中应该使用外部存储
const messageQueues = new Map<string, any[]>();
const clientSequences = new Map<string, number>();

// 清理过期的队列和序列
setInterval(() => {
  const now = Date.now();
  const entries = Array.from(messageQueues.entries());
  for (const [clientId, queue] of entries) {
    // 清理超过5分钟的旧数据
    const filtered = queue.filter((msg: any) => now - msg.timestamp < 300000);
    if (filtered.length === 0) {
      messageQueues.delete(clientId);
      clientSequences.delete(clientId);
    } else {
      messageQueues.set(clientId, filtered);
    }
  }
}, 60000); // 每分钟清理一次

// GET方法 - Long Polling请求
export async function GET(request: NextRequest) {
  console.log('🚀 Long Polling请求开始:', new Date().toISOString());

  const searchParams = request.nextUrl.searchParams;
  const clientId =
    searchParams.get('clientId') ||
    `client_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  const type =
    (searchParams.get('type') as 'text' | 'data-stream' | 'notification') ||
    'text';
  const timeout = parseInt(searchParams.get('timeout') || '30000'); // 默认30秒超时
  const sequence = parseInt(searchParams.get('sequence') || '0');
  const message = searchParams.get('message') || 'Long Polling演示';

  console.log('📡 Long Polling参数:', {
    clientId,
    type,
    timeout,
    sequence,
    message,
  });

  try {
    if (type === 'text') {
      return await handleTextPolling(clientId, message, timeout, sequence);
    } else if (type === 'data-stream') {
      return await handleDataPolling(clientId, timeout, sequence);
    } else if (type === 'notification') {
      return await handleNotificationPolling(clientId, timeout, sequence);
    }
  } catch (error) {
    console.error('❌ Long Polling处理错误:', error);
    return Response.json(
      {
        type: 'error',
        message: error instanceof Error ? error.message : '未知错误',
        timestamp: Date.now(),
      },
      { status: 500 }
    );
  }
}

// POST方法 - AI聊天Long Polling
export async function POST(request: NextRequest) {
  console.log('🤖 Long Polling AI聊天请求开始:', new Date().toISOString());

  const body = (await request.json()) as LongPollingRequestPayload;
  const {
    message = '请介绍一下Long Polling技术',
    type = 'ai-chat',
    system = 'You are a helpful AI assistant. Please respond in Chinese.',
    temperature = 0.7,
    modelName = 'gpt-3.5-turbo',
    timeout = 30000,
    sequence = 0,
    clientId: providedClientId = null,
  } = body;

  const clientId =
    providedClientId ||
    `ai_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  console.log('🤖 AI Long Polling参数:', {
    clientId,
    type,
    timeout,
    sequence,
    message,
  });

  try {
    if (type === 'ai-chat') {
      return await handleAIChatPolling(
        clientId,
        {
          message,
          system,
          temperature,
          modelName,
        },
        timeout,
        sequence
      );
    } else if (type === 'log-stream') {
      return await handleLogPolling(clientId, timeout, sequence);
    }
  } catch (error) {
    console.error('❌ Long Polling AI处理错误:', error);
    return Response.json(
      {
        type: 'error',
        message: error instanceof Error ? error.message : '未知错误',
        timestamp: Date.now(),
      },
      { status: 500 }
    );
  }
}

// 文本Long Polling处理
async function handleTextPolling(
  clientId: string,
  message: string,
  timeout: number,
  sequence: number
) {
  console.log('📤 开始文本Long Polling');

  // 初始化客户端队列
  if (!messageQueues.has(clientId)) {
    messageQueues.set(clientId, []);
    clientSequences.set(clientId, 0);

    // 异步生成数据
    generateTextData(clientId, message);
  }

  // 等待新数据或超时
  const result = await waitForNewData(clientId, sequence, timeout);

  return Response.json(result, {
    headers: {
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

// AI聊天Long Polling处理
async function handleAIChatPolling(
  clientId: string,
  options: {
    message: string;
    system: string;
    temperature: number;
    modelName: string;
  },
  timeout: number,
  sequence: number
) {
  console.log('🤖 开始AI Long Polling');

  // 验证API密钥
  if (!process.env.OPEN_API_KEY) {
    return Response.json({
      type: 'error',
      message: '❌ 未配置OpenAI API密钥',
      timestamp: Date.now(),
      sequence: sequence + 1,
    });
  }

  // 初始化客户端队列
  if (!messageQueues.has(clientId)) {
    messageQueues.set(clientId, []);
    clientSequences.set(clientId, 0);

    // 异步生成AI回答
    generateAIResponse(clientId, options);
  }

  // 等待新数据或超时
  const result = await waitForNewData(clientId, sequence, timeout);

  return Response.json(result, {
    headers: {
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

// 数据流Long Polling处理
async function handleDataPolling(
  clientId: string,
  timeout: number,
  sequence: number
) {
  console.log('📊 开始数据Long Polling');

  // 初始化客户端队列
  if (!messageQueues.has(clientId)) {
    messageQueues.set(clientId, []);
    clientSequences.set(clientId, 0);

    // 异步生成数据流
    generateDataStream(clientId);
  }

  // 等待新数据或超时
  const result = await waitForNewData(clientId, sequence, timeout);

  return Response.json(result, {
    headers: {
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

// 通知Long Polling处理
async function handleNotificationPolling(
  clientId: string,
  timeout: number,
  sequence: number
) {
  console.log('🔔 开始通知Long Polling');

  // 初始化客户端队列
  if (!messageQueues.has(clientId)) {
    messageQueues.set(clientId, []);
    clientSequences.set(clientId, 0);

    // 异步生成通知
    generateNotifications(clientId);
  }

  // 等待新数据或超时
  const result = await waitForNewData(clientId, sequence, timeout);

  return Response.json(result, {
    headers: {
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

// 日志流Long Polling处理
async function handleLogPolling(
  clientId: string,
  timeout: number,
  sequence: number
) {
  console.log('📝 开始日志Long Polling');

  // 初始化客户端队列
  if (!messageQueues.has(clientId)) {
    messageQueues.set(clientId, []);
    clientSequences.set(clientId, 0);

    // 异步生成日志
    generateLogStream(clientId);
  }

  // 等待新数据或超时
  const result = await waitForNewData(clientId, sequence, timeout);

  return Response.json(result, {
    headers: {
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

// 等待新数据或超时
async function waitForNewData(
  clientId: string,
  requestSequence: number,
  timeout: number
) {
  const startTime = Date.now();
  const maxWaitTime = Math.min(timeout, 60000); // 最大等待60秒

  while (Date.now() - startTime < maxWaitTime) {
    const queue = messageQueues.get(clientId) || [];
    const currentSequence = clientSequences.get(clientId) || 0;

    // 检查是否有新数据
    if (currentSequence > requestSequence) {
      const newMessages = queue.filter((msg) => msg.sequence > requestSequence);

      // 检查是否有完成标记
      const hasCompleteMessage = newMessages.some(
        (msg) =>
          msg.type &&
          (msg.type === 'complete' ||
            msg.type === 'chat-complete' ||
            msg.type === 'data-complete' ||
            msg.type === 'log-complete' ||
            msg.type === 'notification-complete' ||
            msg.type === 'error' ||
            msg.type === 'chat-error')
      );

      return {
        type: 'data',
        messages: newMessages,
        sequence: currentSequence,
        hasMore: !hasCompleteMessage, // 如果有完成消息，则不再有更多数据
        clientId,
        timestamp: Date.now(),
      };
    }

    // 等待50ms再检查
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  // 超时返回
  return {
    type: 'timeout',
    message: 'Long Polling超时，请重新请求',
    sequence: requestSequence,
    hasMore: true,
    clientId,
    timestamp: Date.now(),
  };
}

// 添加消息到队列
function addMessageToQueue(clientId: string, message: any) {
  const queue = messageQueues.get(clientId) || [];
  const currentSequence = (clientSequences.get(clientId) || 0) + 1;

  const messageWithSequence = {
    ...message,
    sequence: currentSequence,
    timestamp: Date.now(),
  };

  queue.push(messageWithSequence);
  messageQueues.set(clientId, queue);
  clientSequences.set(clientId, currentSequence);

  console.log(`📤 添加消息到队列 ${clientId}:`, messageWithSequence.type);
}

// 生成文本数据
async function generateTextData(clientId: string, message: string) {
  console.log('📝 开始生成文本数据');

  addMessageToQueue(clientId, {
    type: 'start',
    message: '🎉 Long Polling连接建立成功！',
  });

  const segments = [
    `欢迎使用 Long Polling 技术！`,
    `您的消息: ${message}`,
    'Long Polling是一种实时通信技术',
    '客户端发起请求后，服务器会保持连接',
    '直到有新数据返回或者超时',
    '这种方式模拟了服务器推送的效果',
    '相比传统轮询，减少了不必要的请求',
    '但仍然基于HTTP请求-响应模式',
    '适合消息频率不太高的场景',
    '演示即将结束...',
  ];

  for (let i = 0; i < segments.length; i++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));

    addMessageToQueue(clientId, {
      type: 'data',
      content: segments[i],
      index: i + 1,
      total: segments.length,
      progress: Math.round(((i + 1) / segments.length) * 100),
    });
  }

  addMessageToQueue(clientId, {
    type: 'complete',
    message: '✅ Long Polling演示完成',
    totalSegments: segments.length,
  });
}

// 生成AI回答
async function generateAIResponse(
  clientId: string,
  options: {
    message: string;
    system: string;
    temperature: number;
    modelName: string;
  }
) {
  console.log('🤖 开始生成AI回答');

  addMessageToQueue(clientId, {
    type: 'chat-start',
    message: '🤖 AI正在思考您的问题...',
    model: options.modelName,
  });

  try {
    // 初始化AI模型（非流式）
    const llm = new ChatOpenAI({
      openAIApiKey: process.env.OPEN_API_KEY,
      modelName: options.modelName,
      temperature: options.temperature,
      maxTokens: 2000,
      configuration: {
        baseURL: process.env.OPEN_API_BASE_URL,
      },
    });

    // 创建提示模板
    const chatPrompt = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(options.system),
      HumanMessagePromptTemplate.fromTemplate('{userMessage}'),
    ]);

    // 创建处理链
    const chain = chatPrompt.pipe(llm).pipe(new StringOutputParser());

    // 非流式调用（Long Polling通常返回完整响应）
    const response = await chain.invoke({
      userMessage: options.message,
    });

    // 将回答分段推送（模拟逐句返回）
    const sentences = response.split(/[。！？.!?]\s*/);
    let accumulatedContent = '';

    for (let i = 0; i < sentences.length; i++) {
      if (sentences[i].trim()) {
        accumulatedContent += sentences[i] + '。';

        await new Promise((resolve) => setTimeout(resolve, 800));

        addMessageToQueue(clientId, {
          type: 'chat-stream',
          content: sentences[i] + '。',
          totalContent: accumulatedContent,
          sentenceIndex: i + 1,
          totalSentences: sentences.length,
        });
      }
    }

    addMessageToQueue(clientId, {
      type: 'chat-complete',
      message: '✅ AI回答生成完成',
      totalContent: accumulatedContent,
      model: options.modelName,
    });
  } catch (error) {
    console.error('❌ AI处理错误:', error);
    addMessageToQueue(clientId, {
      type: 'chat-error',
      message: `❌ AI处理失败: ${error instanceof Error ? error.message : '未知错误'}`,
    });
  }
}

// 生成数据流
async function generateDataStream(clientId: string) {
  console.log('📊 开始生成数据流');

  addMessageToQueue(clientId, {
    type: 'data-start',
    message: '📊 开始实时数据流传输',
  });

  // 生成20个数据点
  for (let i = 0; i < 20; i++) {
    await new Promise((resolve) => setTimeout(resolve, 500));

    const dataPoint = {
      type: 'data-point',
      index: i + 1,
      value: Math.sin(i * 0.3) * 50 + 50 + Math.random() * 10,
      cpu: Math.random() * 100,
      memory: Math.random() * 100,
      network: Math.random() * 1000,
      temperature: Math.random() * 40 + 20,
    };

    addMessageToQueue(clientId, dataPoint);
  }

  addMessageToQueue(clientId, {
    type: 'data-complete',
    message: '✅ 数据流传输完成',
    totalPoints: 20,
  });
}

// 生成通知
async function generateNotifications(clientId: string) {
  console.log('🔔 开始生成通知');

  const notifications = [
    {
      type: 'info',
      title: '系统通知',
      message: '欢迎使用 Long Polling 通知系统',
    },
    { type: 'success', title: '操作成功', message: '数据已成功保存到数据库' },
    {
      type: 'warning',
      title: '注意',
      message: '系统资源使用率较高，请注意监控',
    },
    { type: 'error', title: '错误', message: '网络连接出现问题，正在自动重试' },
    { type: 'info', title: '更新', message: '发现新版本 v2.1.0，建议立即更新' },
  ];

  addMessageToQueue(clientId, {
    type: 'notification-start',
    message: '🔔 开始通知推送',
  });

  for (let i = 0; i < notifications.length; i++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    addMessageToQueue(clientId, {
      type: 'notification',
      title: notifications[i].title,
      message: notifications[i].message,
      level: notifications[i].type, // 保存通知级别
      id: Date.now() + i,
      index: i + 1,
    });
  }

  addMessageToQueue(clientId, {
    type: 'notification-complete',
    message: '✅ 通知推送完成',
    totalNotifications: notifications.length,
  });
}

// 生成日志流
async function generateLogStream(clientId: string) {
  console.log('📝 开始生成日志流');

  const logs = [
    { level: 'info', message: 'Long Polling 系统启动' },
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

  addMessageToQueue(clientId, {
    type: 'log-start',
    message: '📝 开始日志流传输',
  });

  for (let i = 0; i < logs.length; i++) {
    await new Promise((resolve) => setTimeout(resolve, 700));

    addMessageToQueue(clientId, {
      type: 'log-entry',
      ...logs[i],
      id: `log_${Date.now()}_${i}`,
      index: i + 1,
    });
  }

  addMessageToQueue(clientId, {
    type: 'log-complete',
    message: '✅ 日志流传输完成',
    totalLogs: logs.length,
  });
}
