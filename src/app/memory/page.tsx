'use client';

import { useState, useEffect, useRef } from 'react';
import TestPageLayout from '@/components/TestPageLayout';
import {
  Brain,
  MessageSquare,
  BarChart3,
  Clock,
  Zap,
  Target,
  Users,
  Layers,
} from 'lucide-react';

interface ConversationMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: number;
  tokens?: number;
  importance?: number;
}

interface ContextStrategy {
  key: string;
  name: string;
  description: string;
  maxTokens: number;
}

interface SessionStats {
  messageCount: number;
  totalTokens: number;
  createdAt: number;
  lastUpdatedAt: number;
  strategy: string;
}

interface ContextStats {
  originalMessageCount: number;
  filteredMessageCount: number;
  compressionRatio: number;
  originalTokens: number;
  filteredTokens: number;
  tokenCompressionRatio: number;
  strategy: string;
  maxTokens: number;
}

export default function MemoryPage() {
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [strategies, setStrategies] = useState<ContextStrategy[]>([]);
  const [selectedStrategy, setSelectedStrategy] =
    useState<string>('sliding_window');
  const [maxTokens, setMaxTokens] = useState<number>(2000);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [filteredMessages, setFilteredMessages] = useState<
    ConversationMessage[]
  >([]);
  const [contextStats, setContextStats] = useState<ContextStats | null>(null);
  const [sessionStats, setSessionStats] = useState<SessionStats | null>(null);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [chatResponse, setChatResponse] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [showComparison, setShowComparison] = useState<boolean>(false);
  const [comparisonData, setComparisonData] = useState<
    Record<string, ContextStats>
  >({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 初始化
  useEffect(() => {
    initializeSession();
    loadStrategies();
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, filteredMessages]);

  // 当策略或Token限制改变时，重新计算上下文
  useEffect(() => {
    if (currentSessionId && messages.length > 0) {
      calculateContext();
    }
  }, [selectedStrategy, maxTokens, currentSessionId, messages.length]);

  const initializeSession = async () => {
    try {
      const response = await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_session' }),
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentSessionId(data.sessionId);
        setSessionStats(data.stats);
        setStrategies(data.strategies || []);
      }
    } catch (error) {
      setError('初始化会话失败');
      console.error('初始化失败:', error);
    }
  };

  const loadStrategies = async () => {
    try {
      const response = await fetch('/api/memory');
      if (response.ok) {
        const data = await response.json();
        setStrategies(data.strategies || []);
      }
    } catch (error) {
      console.error('加载策略失败:', error);
    }
  };

  const addTestMessages = async () => {
    const testMessages = [
      {
        role: 'system',
        content: '你是一个有用的AI助手，专门帮助用户学习编程和技术知识。',
      },
      { role: 'user', content: '什么是JavaScript？' },
      {
        role: 'assistant',
        content:
          'JavaScript是一种高级的、解释型的编程语言。它是Web开发的核心技术之一，主要用于创建动态和交互式的网页内容。JavaScript具有以下特点：1. 弱类型语言 2. 面向对象 3. 事件驱动 4. 跨平台',
      },
      { role: 'user', content: '能给我一个简单的JavaScript例子吗？' },
      {
        role: 'assistant',
        content:
          '当然！这里是一个简单的JavaScript例子：\n\n```javascript\n// 定义一个函数来计算两个数的和\nfunction addNumbers(a, b) {\n    return a + b;\n}\n\n// 调用函数并显示结果\nlet result = addNumbers(5, 3);\nconsole.log("5 + 3 = " + result);\n```\n\n这个例子展示了函数定义、变量赋值和控制台输出的基本语法。',
      },
      { role: 'user', content: '什么是变量作用域？' },
      {
        role: 'assistant',
        content:
          'JavaScript中的变量作用域是指变量可以被访问的代码区域。主要有以下几种：\n\n1. **全局作用域**：在函数外声明的变量\n2. **函数作用域**：在函数内声明的变量\n3. **块作用域**：使用let和const在{}内声明的变量\n\n例子：\n```javascript\nvar globalVar = "我是全局变量";\n\nfunction myFunction() {\n    var functionVar = "我是函数变量";\n    if (true) {\n        let blockVar = "我是块变量";\n    }\n}\n```',
      },
      { role: 'user', content: '请解释一下异步编程' },
      {
        role: 'assistant',
        content:
          'JavaScript中的异步编程是处理需要时间完成的操作（如网络请求、文件读取）的方式，不会阻塞程序执行。主要方法包括：\n\n1. **回调函数（Callbacks）**\n2. **Promise**\n3. **async/await**\n\n例子：\n```javascript\n// Promise示例\nfetch("https://api.example.com/data")\n    .then(response => response.json())\n    .then(data => console.log(data))\n    .catch(error => console.error(error));\n\n// async/await示例\nasync function fetchData() {\n    try {\n        const response = await fetch("https://api.example.com/data");\n        const data = await response.json();\n        console.log(data);\n    } catch (error) {\n        console.error(error);\n    }\n}\n```',
      },
      { role: 'user', content: '什么是闭包？这个概念很重要吗？' },
      {
        role: 'assistant',
        content:
          '闭包是JavaScript中一个非常重要且强大的概念！闭包是指函数可以访问其定义时的词法环境，即使该函数在其定义环境之外执行。\n\n**为什么重要：**\n1. 数据私有化\n2. 模块模式\n3. 回调函数中保持状态\n4. 防抖和节流函数\n\n**例子：**\n```javascript\nfunction createCounter() {\n    let count = 0;\n    return function() {\n        count++;\n        return count;\n    };\n}\n\nconst counter = createCounter();\nconsole.log(counter()); // 1\nconsole.log(counter()); // 2\n```\n\n在这个例子中，内部函数形成了闭包，可以访问外部函数的count变量。',
      },
    ];

    for (const msg of testMessages) {
      await addMessage(
        msg.role as 'system' | 'user' | 'assistant',
        msg.content
      );
      // 添加小延迟，让效果更明显
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  };

  const addMessage = async (
    role: 'system' | 'user' | 'assistant',
    content: string
  ) => {
    if (!currentSessionId) return;

    try {
      const response = await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_message',
          sessionId: currentSessionId,
          message: { role, content },
          strategy: selectedStrategy,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSessionStats(data.stats);

        // 获取会话中的所有消息
        const sessionResponse = await fetch(
          `/api/memory?sessionId=${currentSessionId}`
        );
        if (sessionResponse.ok) {
          const sessionData = await sessionResponse.json();
          setMessages(sessionData.session.messages);
        }
      }
    } catch (error) {
      console.error('添加消息失败:', error);
    }
  };

  const calculateContext = async () => {
    if (!currentSessionId) return;

    try {
      const response = await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_context',
          sessionId: currentSessionId,
          strategy: selectedStrategy,
          maxTokens: maxTokens,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setFilteredMessages(data.messages);
        setContextStats(data.stats);
      }
    } catch (error) {
      console.error('计算上下文失败:', error);
    }
  };

  const compareStrategies = async () => {
    if (!currentSessionId || messages.length === 0) return;

    setIsLoading(true);
    const comparisons: Record<string, ContextStats> = {};

    try {
      for (const strategy of strategies) {
        const response = await fetch('/api/memory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'get_context',
            sessionId: currentSessionId,
            strategy: strategy.key,
            maxTokens: maxTokens,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          comparisons[strategy.key] = data.stats;
        }
      }

      setComparisonData(comparisons);
      setShowComparison(true);
    } catch (error) {
      setError('策略比较失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChat = async () => {
    if (!inputMessage.trim() || !currentSessionId) return;

    setIsLoading(true);
    setChatResponse('');
    setError('');

    try {
      const response = await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          sessionId: currentSessionId,
          message: { content: inputMessage },
          strategy: selectedStrategy,
          maxTokens: maxTokens,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setChatResponse(data.response);
        setSessionStats(data.stats);

        // 刷新消息列表
        const sessionResponse = await fetch(
          `/api/memory?sessionId=${currentSessionId}`
        );
        if (sessionResponse.ok) {
          const sessionData = await sessionResponse.json();
          setMessages(sessionData.session.messages);
        }

        setInputMessage('');
      } else {
        const errorData = await response.json();
        setError(errorData.error || '对话失败');
      }
    } catch (error) {
      setError('对话请求失败');
    } finally {
      setIsLoading(false);
    }
  };

  const clearSession = async () => {
    if (!currentSessionId) return;

    try {
      await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'clear_session',
          sessionId: currentSessionId,
        }),
      });

      // 重新初始化
      await initializeSession();
      setMessages([]);
      setFilteredMessages([]);
      setContextStats(null);
      setChatResponse('');
      setComparisonData({});
      setShowComparison(false);
    } catch (error) {
      setError('清空会话失败');
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getStrategyIcon = (strategy: string) => {
    switch (strategy) {
      case 'sliding_window':
        return <Clock className="w-4 h-4" />;
      case 'importance_weighted':
        return <Target className="w-4 h-4" />;
      case 'summarization':
        return <Layers className="w-4 h-4" />;
      case 'semantic_clustering':
        return <Users className="w-4 h-4" />;
      case 'hybrid':
        return <Zap className="w-4 h-4" />;
      default:
        return <Brain className="w-4 h-4" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'system':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'user':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'assistant':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <TestPageLayout
      title="🧠 大模型上下文管理系统"
      description="演示不同的上下文管理策略，展示原理和运行逻辑"
    >
      <div className="p-6 space-y-6">
        {/* 控制面板 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">
            🎛️ 上下文管理控制面板
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* 策略选择 */}
            <div>
              <label className="block text-sm font-medium text-blue-700 mb-2">
                上下文管理策略：
              </label>
              <select
                value={selectedStrategy}
                onChange={(e) => setSelectedStrategy(e.target.value)}
                className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {strategies.map((strategy) => (
                  <option key={strategy.key} value={strategy.key}>
                    {strategy.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Token限制 */}
            <div>
              <label className="block text-sm font-medium text-blue-700 mb-2">
                Token限制：
              </label>
              <input
                type="number"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="500"
                max="8000"
                step="500"
              />
            </div>

            {/* 会话统计 */}
            <div>
              <label className="block text-sm font-medium text-blue-700 mb-2">
                会话统计：
              </label>
              <div className="text-sm text-blue-600">
                {sessionStats && (
                  <>
                    <div>消息数: {sessionStats.messageCount}</div>
                    <div>总Token: {sessionStats.totalTokens}</div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={addTestMessages}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              添加测试对话
            </button>
            <button
              onClick={compareStrategies}
              disabled={isLoading || messages.length === 0}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {isLoading ? '比较中...' : '策略比较'}
            </button>
            <button
              onClick={clearSession}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              清空会话
            </button>
          </div>

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* 策略说明 */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-yellow-900 mb-4">
            🧩 上下文管理策略详解
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {strategies.map((strategy) => (
              <div
                key={strategy.key}
                className={`bg-white border rounded p-3 ${
                  selectedStrategy === strategy.key
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-yellow-300'
                }`}
              >
                <div className="flex items-center mb-2">
                  {getStrategyIcon(strategy.key)}
                  <h4 className="ml-2 font-medium text-yellow-800">
                    {strategy.name}
                  </h4>
                </div>
                <p className="text-sm text-yellow-700">
                  {strategy.description}
                </p>
                <div className="text-xs text-yellow-600 mt-1">
                  默认限制: {strategy.maxTokens} tokens
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 对话测试区 */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            💬 实时对话测试
          </h3>

          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleChat()}
              placeholder="输入消息测试上下文管理..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleChat}
              disabled={isLoading || !inputMessage.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? '处理中...' : '发送'}
            </button>
          </div>

          {chatResponse && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
              <h4 className="font-medium text-green-900 mb-2">🤖 AI回复:</h4>
              <p className="text-green-800 whitespace-pre-wrap">
                {chatResponse}
              </p>
            </div>
          )}
        </div>

        {/* 上下文效果展示 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 原始消息 */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              📝 原始对话消息 ({messages.length})
            </h3>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {messages.map((msg, index) => (
                <div
                  key={msg.id}
                  className={`p-3 rounded-lg border ${getRoleColor(msg.role)}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">
                      {msg.role} #{index + 1}
                    </span>
                    <div className="text-xs opacity-75">
                      {msg.tokens} tokens | {formatTimestamp(msg.timestamp)}
                    </div>
                  </div>
                  <p className="text-sm">{msg.content}</p>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* 过滤后的消息 */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              🎯 过滤后的上下文 ({filteredMessages.length})
            </h3>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {filteredMessages.map((msg, index) => (
                <div
                  key={msg.id}
                  className={`p-3 rounded-lg border ${getRoleColor(msg.role)}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">
                      {msg.role} #{index + 1}
                    </span>
                    <div className="text-xs opacity-75">
                      {msg.tokens} tokens | {formatTimestamp(msg.timestamp)}
                    </div>
                  </div>
                  <p className="text-sm">{msg.content}</p>
                  {msg.importance && (
                    <div className="mt-1 text-xs text-orange-600">
                      重要性: {(msg.importance * 100).toFixed(1)}%
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 上下文统计 */}
        {contextStats && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-purple-900 mb-4">
              📊 上下文压缩统计
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white border border-purple-300 rounded p-3 text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {contextStats.filteredMessageCount}
                </div>
                <div className="text-sm text-purple-700">保留消息数</div>
                <div className="text-xs text-purple-600">
                  / {contextStats.originalMessageCount}
                </div>
              </div>
              <div className="bg-white border border-purple-300 rounded p-3 text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {(contextStats.compressionRatio * 100).toFixed(1)}%
                </div>
                <div className="text-sm text-purple-700">消息压缩率</div>
              </div>
              <div className="bg-white border border-purple-300 rounded p-3 text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {contextStats.filteredTokens}
                </div>
                <div className="text-sm text-purple-700">使用Token数</div>
                <div className="text-xs text-purple-600">
                  / {contextStats.originalTokens}
                </div>
              </div>
              <div className="bg-white border border-purple-300 rounded p-3 text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {(contextStats.tokenCompressionRatio * 100).toFixed(1)}%
                </div>
                <div className="text-sm text-purple-700">Token压缩率</div>
              </div>
            </div>
          </div>
        )}

        {/* 策略比较结果 */}
        {showComparison && Object.keys(comparisonData).length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-green-900">
                🔄 策略效果比较
              </h3>
              <button
                onClick={() => setShowComparison(false)}
                className="text-green-600 hover:text-green-800"
              >
                关闭
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-green-300 rounded">
                <thead>
                  <tr className="bg-green-100">
                    <th className="px-4 py-2 text-left text-green-800">策略</th>
                    <th className="px-4 py-2 text-center text-green-800">
                      保留消息
                    </th>
                    <th className="px-4 py-2 text-center text-green-800">
                      消息压缩率
                    </th>
                    <th className="px-4 py-2 text-center text-green-800">
                      使用Token
                    </th>
                    <th className="px-4 py-2 text-center text-green-800">
                      Token压缩率
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(comparisonData).map(
                    ([strategyKey, stats]) => {
                      const strategy = strategies.find(
                        (s) => s.key === strategyKey
                      );
                      return (
                        <tr
                          key={strategyKey}
                          className="border-t border-green-200"
                        >
                          <td className="px-4 py-2">
                            <div className="flex items-center">
                              {getStrategyIcon(strategyKey)}
                              <span className="ml-2 font-medium text-green-800">
                                {strategy?.name || strategyKey}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-2 text-center">
                            {stats.filteredMessageCount} /{' '}
                            {stats.originalMessageCount}
                          </td>
                          <td className="px-4 py-2 text-center">
                            {(stats.compressionRatio * 100).toFixed(1)}%
                          </td>
                          <td className="px-4 py-2 text-center">
                            {stats.filteredTokens} / {stats.originalTokens}
                          </td>
                          <td className="px-4 py-2 text-center">
                            {(stats.tokenCompressionRatio * 100).toFixed(1)}%
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 实现原理说明 */}
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-orange-900 mb-4">
            🔬 上下文管理原理
          </h3>

          <div className="space-y-4">
            <div className="bg-white border border-orange-300 rounded p-4">
              <h4 className="font-medium text-orange-800 mb-2">🎯 核心挑战</h4>
              <ul className="text-sm text-orange-700 space-y-1">
                <li>• LLM有固定的上下文长度限制（如4K、8K、128K tokens）</li>
                <li>• 长对话会超出上下文窗口，导致信息丢失</li>
                <li>• 需要在保留重要信息和控制长度之间平衡</li>
                <li>• 不同场景需要不同的管理策略</li>
              </ul>
            </div>

            <div className="bg-white border border-orange-300 rounded p-4">
              <h4 className="font-medium text-orange-800 mb-2">⚙️ 解决方案</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <h5 className="font-medium text-orange-700 mb-1">
                    1. 滑动窗口
                  </h5>
                  <p className="text-sm text-orange-600">
                    简单的FIFO策略，保留最新的消息
                  </p>
                </div>
                <div>
                  <h5 className="font-medium text-orange-700 mb-1">
                    2. 重要性加权
                  </h5>
                  <p className="text-sm text-orange-600">
                    根据内容重要性智能选择保留的消息
                  </p>
                </div>
                <div>
                  <h5 className="font-medium text-orange-700 mb-1">
                    3. 总结压缩
                  </h5>
                  <p className="text-sm text-orange-600">
                    将历史对话压缩为摘要，节省空间
                  </p>
                </div>
                <div>
                  <h5 className="font-medium text-orange-700 mb-1">
                    4. 语义聚类
                  </h5>
                  <p className="text-sm text-orange-600">
                    按话题聚类，保留代表性消息
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-orange-300 rounded p-4">
              <h4 className="font-medium text-orange-800 mb-2">📈 效果评估</h4>
              <ul className="text-sm text-orange-700 space-y-1">
                <li>
                  • <strong>压缩率</strong>：保留消息数/原始消息数
                </li>
                <li>
                  • <strong>Token利用率</strong>：使用Token数/Token限制
                </li>
                <li>
                  • <strong>信息保留度</strong>：重要信息的保留程度
                </li>
                <li>
                  • <strong>连贯性</strong>：对话的逻辑连贯性
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </TestPageLayout>
  );
}
