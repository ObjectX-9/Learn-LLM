import { NextRequest, NextResponse } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  BaseMessage,
} from '@langchain/core/messages';

// 对话消息接口
interface ConversationMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: number;
  tokens?: number;
  importance?: number; // 消息重要性评分 (0-1)
}

// 上下文管理策略接口
interface ContextStrategy {
  name: string;
  description: string;
  maxTokens: number;
  implementation: (
    messages: ConversationMessage[],
    maxTokens: number
  ) => ConversationMessage[];
}

// 对话会话管理
class ConversationSession {
  public id: string;
  public messages: ConversationMessage[] = [];
  public totalTokens: number = 0;
  public createdAt: number;
  public lastUpdatedAt: number;
  public strategy: string = 'sliding_window';

  constructor(id: string) {
    this.id = id;
    this.createdAt = Date.now();
    this.lastUpdatedAt = Date.now();
  }

  addMessage(message: Omit<ConversationMessage, 'id' | 'timestamp'>) {
    const newMessage: ConversationMessage = {
      ...message,
      id: this.generateMessageId(),
      timestamp: Date.now(),
      tokens: this.estimateTokens(message.content),
    };

    this.messages.push(newMessage);
    this.totalTokens += newMessage.tokens || 0;
    this.lastUpdatedAt = Date.now();

    return newMessage;
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private estimateTokens(text: string): number {
    // 简单的Token估算：英文约4个字符=1个token，中文约1.5个字符=1个token
    const englishChars = text.match(/[a-zA-Z\s]/g)?.length || 0;
    const chineseChars = text.match(/[\u4e00-\u9fff]/g)?.length || 0;
    const otherChars = text.length - englishChars - chineseChars;

    return Math.ceil(englishChars / 4 + chineseChars / 1.5 + otherChars / 3);
  }

  getMessagesWithStrategy(
    strategy: string,
    maxTokens: number
  ): ConversationMessage[] {
    const strategyImpl = contextStrategies[strategy];
    if (!strategyImpl) {
      throw new Error(`未知的上下文策略: ${strategy}`);
    }

    return strategyImpl.implementation(this.messages, maxTokens);
  }

  getStats() {
    return {
      messageCount: this.messages.length,
      totalTokens: this.totalTokens,
      createdAt: this.createdAt,
      lastUpdatedAt: this.lastUpdatedAt,
      strategy: this.strategy,
    };
  }
}

// 上下文管理策略实现
const contextStrategies: Record<string, ContextStrategy> = {
  // 1. 滑动窗口策略 - 保留最新的N条消息
  sliding_window: {
    name: '滑动窗口',
    description: '保留最新的消息，超出限制时移除最早的消息',
    maxTokens: 4000,
    implementation: (messages: ConversationMessage[], maxTokens: number) => {
      const result: ConversationMessage[] = [];
      let currentTokens = 0;

      // 从后往前添加消息，直到达到token限制
      for (let i = messages.length - 1; i >= 0; i--) {
        const message = messages[i];
        const messageTokens = message.tokens || 0;

        if (currentTokens + messageTokens <= maxTokens) {
          result.unshift(message);
          currentTokens += messageTokens;
        } else {
          break;
        }
      }

      return result;
    },
  },

  // 2. 重要性加权策略 - 根据消息重要性保留
  importance_weighted: {
    name: '重要性加权',
    description: '根据消息重要性评分，优先保留重要消息',
    maxTokens: 4000,
    implementation: (messages: ConversationMessage[], maxTokens: number) => {
      // 计算消息重要性（简单规则）
      const messagesWithImportance = messages.map((msg) => ({
        ...msg,
        importance: calculateImportance(msg),
      }));

      // 按重要性排序（降序）
      messagesWithImportance.sort(
        (a, b) => (b.importance || 0) - (a.importance || 0)
      );

      const result: ConversationMessage[] = [];
      let currentTokens = 0;

      for (const message of messagesWithImportance) {
        const messageTokens = message.tokens || 0;
        if (currentTokens + messageTokens <= maxTokens) {
          result.push(message);
          currentTokens += messageTokens;
        }
      }

      // 按时间顺序重新排列
      return result.sort((a, b) => a.timestamp - b.timestamp);
    },
  },

  // 3. 总结压缩策略 - 压缩旧消息为摘要
  summarization: {
    name: '总结压缩',
    description: '将早期对话压缩为摘要，保留核心信息',
    maxTokens: 4000,
    implementation: (messages: ConversationMessage[], maxTokens: number) => {
      if (messages.length <= 3) return messages;

      const recentMessages = messages.slice(-3); // 保留最近3条消息
      const oldMessages = messages.slice(0, -3);

      let recentTokens = recentMessages.reduce(
        (sum, msg) => sum + (msg.tokens || 0),
        0
      );

      if (recentTokens >= maxTokens) {
        // 如果最近的消息就超过限制，使用滑动窗口
        return contextStrategies.sliding_window.implementation(
          messages,
          maxTokens
        );
      }

      // 创建摘要消息
      const summaryContent = createSummary(oldMessages);
      const summaryMessage: ConversationMessage = {
        id: 'summary_' + Date.now(),
        role: 'system',
        content: `[对话摘要] ${summaryContent}`,
        timestamp: oldMessages[0]?.timestamp || Date.now(),
        tokens: Math.ceil(summaryContent.length / 4),
        importance: 0.8,
      };

      const remainingTokens = maxTokens - recentTokens;
      if ((summaryMessage.tokens || 0) <= remainingTokens) {
        return [summaryMessage, ...recentMessages];
      }

      return recentMessages;
    },
  },

  // 4. 语义聚类策略 - 按语义相似性组织消息
  semantic_clustering: {
    name: '语义聚类',
    description: '根据语义相似性对消息进行聚类，保留代表性消息',
    maxTokens: 4000,
    implementation: (messages: ConversationMessage[], maxTokens: number) => {
      // 简化的语义聚类实现
      const clusters = createSemanticClusters(messages);
      const result: ConversationMessage[] = [];
      let currentTokens = 0;

      // 从每个聚类中选择代表性消息
      for (const cluster of clusters) {
        const representative = selectRepresentative(cluster);
        const messageTokens = representative.tokens || 0;

        if (currentTokens + messageTokens <= maxTokens) {
          result.push(representative);
          currentTokens += messageTokens;
        }
      }

      return result.sort((a, b) => a.timestamp - b.timestamp);
    },
  },

  // 5. 混合策略 - 结合多种方法
  hybrid: {
    name: '混合策略',
    description: '结合重要性、时间和语义相似性的综合策略',
    maxTokens: 4000,
    implementation: (messages: ConversationMessage[], maxTokens: number) => {
      const recentCount = Math.min(5, messages.length);
      const recentMessages = messages.slice(-recentCount);
      const oldMessages = messages.slice(0, -recentCount);

      // 对旧消息应用重要性过滤
      const importantOldMessages =
        contextStrategies.importance_weighted.implementation(
          oldMessages,
          maxTokens * 0.4
        );

      // 合并结果
      const combined = [...importantOldMessages, ...recentMessages];

      // 如果仍然超过限制，应用滑动窗口
      const finalTokens = combined.reduce(
        (sum, msg) => sum + (msg.tokens || 0),
        0
      );
      if (finalTokens > maxTokens) {
        return contextStrategies.sliding_window.implementation(
          combined,
          maxTokens
        );
      }

      return combined;
    },
  },
};

// 辅助函数：计算消息重要性
function calculateImportance(message: ConversationMessage): number {
  let importance = 0.5; // 基础重要性

  // 系统消息更重要
  if (message.role === 'system') importance += 0.3;

  // 包含问题的消息更重要
  if (message.content.includes('?') || message.content.includes('？'))
    importance += 0.2;

  // 长消息可能包含更多信息
  if (message.content.length > 100) importance += 0.1;

  // 包含关键词的消息更重要
  const keywords = [
    '重要',
    'important',
    '关键',
    'key',
    '问题',
    'problem',
    '解决',
    'solution',
  ];
  if (
    keywords.some((keyword) => message.content.toLowerCase().includes(keyword))
  ) {
    importance += 0.2;
  }

  // 时间衰减：越新的消息越重要
  const age = Date.now() - message.timestamp;
  const ageHours = age / (1000 * 60 * 60);
  const timeFactor = Math.exp(-ageHours / 24); // 24小时半衰期
  importance *= 0.5 + 0.5 * timeFactor;

  return Math.min(1, importance);
}

// 辅助函数：创建摘要
function createSummary(messages: ConversationMessage[]): string {
  if (messages.length === 0) return '';

  const topics = new Set<string>();
  const keyPoints: string[] = [];

  messages.forEach((msg) => {
    // 提取可能的主题词
    const words = msg.content.split(/\s+/);
    words.forEach((word) => {
      if (word.length > 3 && !/[0-9]/.test(word)) {
        topics.add(word);
      }
    });

    // 如果是问答，添加到关键点
    if (msg.content.includes('?') || msg.content.includes('？')) {
      keyPoints.push(`问题: ${msg.content.substring(0, 50)}...`);
    }
  });

  const topicsList = Array.from(topics).slice(0, 5).join(', ');
  const summary = `讨论了 ${topicsList} 等话题。${keyPoints.length > 0 ? '主要问题: ' + keyPoints.slice(0, 2).join('; ') : ''}`;

  return summary;
}

// 辅助函数：语义聚类
function createSemanticClusters(
  messages: ConversationMessage[]
): ConversationMessage[][] {
  // 简化的聚类：按关键词相似性分组
  const clusters: ConversationMessage[][] = [];

  messages.forEach((message) => {
    let assigned = false;

    for (const cluster of clusters) {
      if (isSimilar(message, cluster[0])) {
        cluster.push(message);
        assigned = true;
        break;
      }
    }

    if (!assigned) {
      clusters.push([message]);
    }
  });

  return clusters;
}

// 辅助函数：判断消息相似性
function isSimilar(
  msg1: ConversationMessage,
  msg2: ConversationMessage
): boolean {
  const words1 = new Set(msg1.content.toLowerCase().split(/\s+/));
  const words2 = new Set(msg2.content.toLowerCase().split(/\s+/));

  const words1Array = Array.from(words1);
  const words2Array = Array.from(words2);
  const intersection = new Set(words1Array.filter((x) => words2.has(x)));
  const union = new Set([...words1Array, ...words2Array]);

  const similarity = intersection.size / union.size;
  return similarity > 0.3;
}

// 辅助函数：选择聚类代表
function selectRepresentative(
  cluster: ConversationMessage[]
): ConversationMessage {
  if (cluster.length === 1) return cluster[0];

  // 选择重要性最高的消息作为代表
  return cluster.reduce((best, current) => {
    const currentImportance = calculateImportance(current);
    const bestImportance = calculateImportance(best);
    return currentImportance > bestImportance ? current : best;
  });
}

// 内存中的会话存储
const sessions = new Map<string, ConversationSession>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, sessionId, message, strategy, maxTokens } = body;

    console.log('🧠 上下文管理请求:', {
      action,
      sessionId,
      strategy,
      maxTokens,
    });

    switch (action) {
      case 'create_session':
        const newSession = new ConversationSession(
          sessionId || `session_${Date.now()}`
        );
        sessions.set(newSession.id, newSession);

        return NextResponse.json({
          sessionId: newSession.id,
          stats: newSession.getStats(),
          strategies: Object.keys(contextStrategies).map((key) => ({
            key,
            name: contextStrategies[key].name,
            description: contextStrategies[key].description,
            maxTokens: contextStrategies[key].maxTokens,
          })),
        });

      case 'add_message':
        const session = sessions.get(sessionId);
        if (!session) {
          return NextResponse.json({ error: '会话不存在' }, { status: 404 });
        }

        const addedMessage = session.addMessage(message);
        session.strategy = strategy || 'sliding_window';

        return NextResponse.json({
          message: addedMessage,
          stats: session.getStats(),
        });

      case 'get_context':
        const targetSession = sessions.get(sessionId);
        if (!targetSession) {
          return NextResponse.json({ error: '会话不存在' }, { status: 404 });
        }

        const contextStrategy = strategy || 'sliding_window';
        const tokenLimit = maxTokens || 4000;

        const contextMessages = targetSession.getMessagesWithStrategy(
          contextStrategy,
          tokenLimit
        );
        const totalTokensUsed = contextMessages.reduce(
          (sum, msg) => sum + (msg.tokens || 0),
          0
        );

        // 计算策略效果统计
        const originalCount = targetSession.messages.length;
        const filteredCount = contextMessages.length;
        const originalTokens = targetSession.totalTokens;

        return NextResponse.json({
          messages: contextMessages,
          stats: {
            originalMessageCount: originalCount,
            filteredMessageCount: filteredCount,
            compressionRatio:
              originalCount > 0 ? filteredCount / originalCount : 1,
            originalTokens: originalTokens,
            filteredTokens: totalTokensUsed,
            tokenCompressionRatio:
              originalTokens > 0 ? totalTokensUsed / originalTokens : 1,
            strategy: contextStrategy,
            maxTokens: tokenLimit,
          },
        });

      case 'chat':
        const chatSession = sessions.get(sessionId);
        if (!chatSession) {
          return NextResponse.json({ error: '会话不存在' }, { status: 404 });
        }

        // 添加用户消息
        chatSession.addMessage({
          role: 'user',
          content: message.content,
        });

        // 获取上下文
        const chatStrategy = strategy || 'sliding_window';
        const chatTokenLimit = maxTokens || 4000;
        const chatContext = chatSession.getMessagesWithStrategy(
          chatStrategy,
          chatTokenLimit
        );

        // 构建LangChain消息
        const langchainMessages: BaseMessage[] = chatContext.map((msg) => {
          switch (msg.role) {
            case 'system':
              return new SystemMessage(msg.content);
            case 'user':
              return new HumanMessage(msg.content);
            case 'assistant':
              return new AIMessage(msg.content);
            default:
              return new HumanMessage(msg.content);
          }
        });

        // 调用LLM
        const chat = new ChatOpenAI({
          openAIApiKey: process.env.OPEN_API_KEY,
          modelName: 'gpt-3.5-turbo',
          temperature: 0.7,
          configuration: {
            baseURL: process.env.OPEN_API_BASE_URL,
          },
        });

        const response = await chat.invoke(langchainMessages);

        // 添加AI回复
        const aiMessage = chatSession.addMessage({
          role: 'assistant',
          content: response.content as string,
        });

        return NextResponse.json({
          response: response.content,
          aiMessage: aiMessage,
          contextUsed: chatContext.length,
          tokensUsed: chatContext.reduce(
            (sum, msg) => sum + (msg.tokens || 0),
            0
          ),
          stats: chatSession.getStats(),
        });

      case 'get_sessions':
        const sessionsList = Array.from(sessions.values()).map((s) => ({
          id: s.id,
          stats: s.getStats(),
        }));

        return NextResponse.json({ sessions: sessionsList });

      case 'clear_session':
        if (sessions.has(sessionId)) {
          sessions.delete(sessionId);
          return NextResponse.json({ success: true });
        }
        return NextResponse.json({ error: '会话不存在' }, { status: 404 });

      default:
        return NextResponse.json({ error: '未知操作' }, { status: 400 });
    }
  } catch (error) {
    console.error('❌ 上下文管理错误:', error);
    return NextResponse.json(
      {
        error: '上下文管理失败',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (sessionId) {
    const session = sessions.get(sessionId);
    if (session) {
      return NextResponse.json({
        session: {
          id: session.id,
          messages: session.messages,
          stats: session.getStats(),
        },
      });
    }
    return NextResponse.json({ error: '会话不存在' }, { status: 404 });
  }

  // 返回所有策略信息
  return NextResponse.json({
    strategies: Object.keys(contextStrategies).map((key) => ({
      key,
      name: contextStrategies[key].name,
      description: contextStrategies[key].description,
      maxTokens: contextStrategies[key].maxTokens,
    })),
  });
}
