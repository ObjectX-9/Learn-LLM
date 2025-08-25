'use client';

import { useState, useEffect, useRef } from 'react';
import TestPageLayout from '@/components/TestPageLayout';
import {
  Code,
  Calculator,
  FileText,
  Clock,
  Shuffle,
  Hash,
  Play,
  CheckCircle,
  XCircle,
  Eye,
  MessageSquare,
  Trash2,
} from 'lucide-react';

interface Tool {
  name: string;
  description: string;
  category: string;
  examples: Array<{
    input: any;
    description: string;
  }>;
}

interface ToolCallLog {
  id: string;
  toolName: string;
  input: any;
  output: any;
  success: boolean;
  timestamp: number;
  duration: number;
  error?: string;
}

interface DecisionProcess {
  userMessage: string;
  aiThinking: string;
  hasToolCall: boolean;
  selectedTool: string | null;
  toolInput: any;
  reasoning: string;
}

export default function ToolsPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [toolInput, setToolInput] = useState<string>('{}');
  const [toolOutput, setToolOutput] = useState<any>(null);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [logs, setLogs] = useState<ToolCallLog[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showLogs, setShowLogs] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // AI对话相关状态
  const [chatMessage, setChatMessage] = useState<string>('');
  const [chatResponse, setChatResponse] = useState<string>('');
  const [isChatting, setIsChatting] = useState<boolean>(false);
  const [chatToolCalls, setChatToolCalls] = useState<ToolCallLog[]>([]);
  const [decisionProcess, setDecisionProcess] =
    useState<DecisionProcess | null>(null);

  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadTools();
    loadLogs();
  }, []);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [toolOutput, chatResponse]);

  const loadTools = async () => {
    try {
      const response = await fetch('/api/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list_tools' }),
      });

      if (response.ok) {
        const data = await response.json();
        setTools(data.tools || []);
        setCategories(data.categories || []);
        if (data.tools?.length > 0) {
          setSelectedTool(data.tools[0]);
          setToolInput(
            JSON.stringify(data.tools[0].examples[0]?.input || {}, null, 2)
          );
        }
      }
    } catch (error) {
      setError('加载工具失败');
      console.error('加载工具失败:', error);
    }
  };

  const loadLogs = async () => {
    try {
      const response = await fetch('/api/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_logs' }),
      });

      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
      }
    } catch (error) {
      console.error('加载日志失败:', error);
    }
  };

  const executeTool = async () => {
    if (!selectedTool) return;

    setIsExecuting(true);
    setError('');
    setToolOutput(null);

    try {
      const input = JSON.parse(toolInput);

      const response = await fetch('/api/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'execute_tool',
          toolName: selectedTool.name,
          input: input,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setToolOutput(result);
        await loadLogs();
      } else {
        setError(result.error || '工具执行失败');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : '工具执行失败');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleToolSelect = (tool: Tool) => {
    setSelectedTool(tool);
    setToolInput(JSON.stringify(tool.examples[0]?.input || {}, null, 2));
    setToolOutput(null);
    setError('');
  };

  const handleExampleSelect = (example: any) => {
    setToolInput(JSON.stringify(example.input, null, 2));
  };

  const handleChatWithTools = async () => {
    if (!chatMessage.trim()) return;

    setIsChatting(true);
    setChatResponse('');
    setChatToolCalls([]);
    setError('');

    try {
      const response = await fetch('/api/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat_with_tools',
          message: chatMessage,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setChatResponse(result.response);
        setChatToolCalls(result.toolCalls || []);
        setDecisionProcess(result.decisionProcess || null);
        if (result.hasToolCalls) {
          await loadLogs();
        }
      } else {
        setError(result.error || '对话失败');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : '对话请求失败');
    } finally {
      setIsChatting(false);
    }
  };

  const clearLogs = async () => {
    try {
      await fetch('/api/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_logs' }),
      });
      setLogs([]);
    } catch (error) {
      console.error('清除日志失败:', error);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getToolIcon = (category: string) => {
    switch (category) {
      case '数学计算':
        return <Calculator className="w-5 h-5" />;
      case '文本处理':
        return <FileText className="w-5 h-5" />;
      case '时间日期':
        return <Clock className="w-5 h-5" />;
      case '编码转换':
        return <Hash className="w-5 h-5" />;
      case '随机生成':
        return <Shuffle className="w-5 h-5" />;
      default:
        return <Code className="w-5 h-5" />;
    }
  };

  const filteredTools =
    selectedCategory === 'all'
      ? tools
      : tools.filter((tool) => tool.category === selectedCategory);

  return (
    <TestPageLayout
      title="🔧 工具调用系统"
      description="演示函数调用和工具使用，展示AI如何调用外部工具"
    >
      <div className="p-6 space-y-6">
        {/* AI对话测试区 */}
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-purple-900 mb-4">
            🤖 AI工具调用对话
          </h3>
          <p className="text-sm text-purple-700 mb-4">
            🤖
            AI会自动判断您的需求类型，智能选择并调用最合适的工具，无需手动指定工具名称
          </p>

          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleChatWithTools()}
                placeholder="直接描述需求，AI会自动选择工具：计算√16+2³、生成强密码、Hello转Base64、今天加7天是几号、统计文本字数"
                className="flex-1 px-3 py-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                onClick={handleChatWithTools}
                disabled={isChatting || !chatMessage.trim()}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isChatting ? (
                  '处理中...'
                ) : (
                  <>
                    <MessageSquare className="w-4 h-4" />
                    对话
                  </>
                )}
              </button>
            </div>

            {chatResponse && (
              <div className="bg-white border border-purple-300 rounded-lg p-4">
                <h4 className="font-medium text-purple-900 mb-2">
                  🎯 AI回复：
                </h4>
                <p className="text-purple-800 whitespace-pre-wrap">
                  {chatResponse}
                </p>

                {/* AI决策过程 */}
                {decisionProcess && (
                  <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
                    <h5 className="font-medium text-blue-800 mb-3 flex items-center gap-2">
                      🧠 AI决策过程
                      <button
                        onClick={() => {
                          const content =
                            document.getElementById('decision-details');
                          if (content) {
                            content.style.display =
                              content.style.display === 'none'
                                ? 'block'
                                : 'none';
                          }
                        }}
                        className="text-xs px-2 py-1 bg-blue-200 text-blue-700 rounded hover:bg-blue-300"
                      >
                        展开/收起
                      </button>
                    </h5>

                    <div className="text-sm space-y-2">
                      <div>
                        <span className="font-medium text-blue-700">
                          用户请求：
                        </span>
                        <span className="text-blue-600 ml-2">
                          {decisionProcess.userMessage}
                        </span>
                      </div>

                      <div>
                        <span className="font-medium text-blue-700">
                          AI判断：
                        </span>
                        <span className="text-blue-600 ml-2">
                          {decisionProcess.hasToolCall
                            ? '需要调用工具'
                            : '无需调用工具'}
                        </span>
                      </div>

                      {decisionProcess.selectedTool && (
                        <div>
                          <span className="font-medium text-blue-700">
                            选择工具：
                          </span>
                          <span className="text-blue-600 ml-2 font-mono bg-blue-100 px-1 rounded">
                            {decisionProcess.selectedTool}
                          </span>
                        </div>
                      )}

                      <div>
                        <span className="font-medium text-blue-700">
                          决策理由：
                        </span>
                        <span className="text-blue-600 ml-2">
                          {decisionProcess.reasoning}
                        </span>
                      </div>
                    </div>

                    <div
                      id="decision-details"
                      style={{ display: 'none' }}
                      className="mt-3 pt-3 border-t border-blue-200"
                    >
                      <div className="text-sm space-y-2">
                        <div>
                          <span className="font-medium text-blue-700">
                            AI初始思考：
                          </span>
                          <div className="mt-1 p-2 bg-blue-100 rounded text-blue-800 font-mono text-xs">
                            {decisionProcess.aiThinking || '无思考内容'}
                          </div>
                        </div>

                        {decisionProcess.toolInput && (
                          <div>
                            <span className="font-medium text-blue-700">
                              工具参数：
                            </span>
                            <pre className="mt-1 p-2 bg-blue-100 rounded text-blue-800 font-mono text-xs overflow-x-auto">
                              {JSON.stringify(
                                decisionProcess.toolInput,
                                null,
                                2
                              )}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {chatToolCalls.length > 0 && (
                  <div className="mt-4 p-3 bg-purple-50 rounded border">
                    <h5 className="font-medium text-purple-800 mb-2">
                      🔧 调用的工具：
                    </h5>
                    <div className="space-y-2">
                      {chatToolCalls.map((call, index) => (
                        <div key={index} className="text-sm">
                          <span className="font-medium text-purple-700">
                            {call.toolName}
                          </span>
                          <span className="text-purple-600 ml-2">
                            ({call.duration}ms)
                          </span>
                          {call.success ? (
                            <CheckCircle className="w-4 h-4 text-green-500 inline ml-2" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500 inline ml-2" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 工具选择和配置 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">
            🛠️ 手动工具调用
          </h3>

          {/* 分类过滤 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-blue-700 mb-2">
              工具分类：
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">全部分类</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          {/* 工具列表 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            {filteredTools.map((tool) => (
              <div
                key={tool.name}
                onClick={() => handleToolSelect(tool)}
                className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedTool?.name === tool.name
                    ? 'border-blue-500 bg-blue-100'
                    : 'border-blue-300 hover:bg-blue-50'
                }`}
              >
                <div className="flex items-center mb-2">
                  {getToolIcon(tool.category)}
                  <h4 className="ml-2 font-medium text-blue-800">
                    {tool.name}
                  </h4>
                </div>
                <p className="text-sm text-blue-600">{tool.description}</p>
                <div className="text-xs text-blue-500 mt-1">
                  分类: {tool.category}
                </div>
              </div>
            ))}
          </div>

          {/* 工具配置和执行 */}
          {selectedTool && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-blue-700 mb-2">
                  工具参数 (JSON格式)：
                </label>
                <textarea
                  value={toolInput}
                  onChange={(e) => setToolInput(e.target.value)}
                  className="w-full h-32 px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  placeholder="输入JSON格式的参数..."
                />
              </div>

              {/* 示例选择 */}
              <div>
                <label className="block text-sm font-medium text-blue-700 mb-2">
                  快速示例：
                </label>
                <div className="flex flex-wrap gap-2">
                  {selectedTool.examples.map((example, index) => (
                    <button
                      key={index}
                      onClick={() => handleExampleSelect(example)}
                      className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                    >
                      {example.description}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={executeTool}
                disabled={isExecuting}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isExecuting ? (
                  '执行中...'
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    执行工具
                  </>
                )}
              </button>
            </div>
          )}

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* 执行结果 */}
        {toolOutput && (
          <div
            ref={outputRef}
            className="bg-green-50 border border-green-200 rounded-lg p-4"
          >
            <h3 className="text-lg font-semibold text-green-900 mb-4">
              ✅ 执行结果
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="bg-white border border-green-300 rounded p-3">
                <h4 className="font-medium text-green-800 mb-2">📥 输入参数</h4>
                <pre className="text-sm text-green-700 bg-green-50 p-2 rounded overflow-x-auto">
                  {JSON.stringify(toolOutput.input, null, 2)}
                </pre>
              </div>

              <div className="bg-white border border-green-300 rounded p-3">
                <h4 className="font-medium text-green-800 mb-2">📤 输出结果</h4>
                <pre className="text-sm text-green-700 bg-green-50 p-2 rounded overflow-x-auto">
                  {JSON.stringify(toolOutput.output, null, 2)}
                </pre>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm text-green-600">
              <span>工具: {toolOutput.toolName}</span>
              <span>耗时: {toolOutput.duration}ms</span>
              <span>状态: {toolOutput.success ? '成功' : '失败'}</span>
              <span>时间: {formatTimestamp(toolOutput.timestamp)}</span>
            </div>
          </div>
        )}

        {/* 调用日志 */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">📋 调用日志</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setShowLogs(!showLogs)}
                className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 flex items-center gap-1"
              >
                <Eye className="w-4 h-4" />
                {showLogs ? '隐藏' : '显示'}
              </button>
              <button
                onClick={clearLogs}
                className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 flex items-center gap-1"
              >
                <Trash2 className="w-4 h-4" />
                清空
              </button>
            </div>
          </div>

          <div className="text-sm text-gray-600 mb-4">
            总共 {logs.length} 条调用记录
          </div>

          {showLogs && (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {logs.length === 0 ? (
                <p className="text-gray-500 text-center py-4">暂无调用记录</p>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className={`p-3 rounded border ${
                      log.success
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800">
                          {log.toolName}
                        </span>
                        {log.success ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatTimestamp(log.timestamp)} | {log.duration}ms
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="font-medium">输入: </span>
                        <span className="text-gray-600">
                          {JSON.stringify(log.input).substring(0, 100)}...
                        </span>
                      </div>
                      <div>
                        <span className="font-medium">
                          {log.success ? '输出: ' : '错误: '}
                        </span>
                        <span
                          className={
                            log.success ? 'text-gray-600' : 'text-red-600'
                          }
                        >
                          {log.success
                            ? JSON.stringify(log.output).substring(0, 100) +
                              '...'
                            : log.error}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* 工具说明 */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-yellow-900 mb-4">
            💡 工具调用原理
          </h3>

          <div className="space-y-4">
            <div className="bg-white border border-yellow-300 rounded p-4">
              <h4 className="font-medium text-yellow-800 mb-2">🎯 核心概念</h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>
                  • <strong>函数调用 (Function Calling)</strong>:
                  AI模型调用外部函数的能力
                </li>
                <li>
                  • <strong>工具定义</strong>: 描述函数的名称、参数、功能
                </li>
                <li>
                  • <strong>参数验证</strong>: 使用Zod进行类型安全的参数校验
                </li>
                <li>
                  • <strong>执行环境</strong>: 安全的沙盒环境执行工具代码
                </li>
              </ul>
            </div>

            <div className="bg-white border border-yellow-300 rounded p-4">
              <h4 className="font-medium text-yellow-800 mb-2">🔄 执行流程</h4>
              <ol className="text-sm text-yellow-700 space-y-1">
                <li>1. AI分析用户需求，判断是否需要调用工具</li>
                <li>2. 选择合适的工具并准备参数</li>
                <li>3. 验证参数格式和类型</li>
                <li>4. 执行工具函数并获取结果</li>
                <li>5. 将结果返回给AI进行解释</li>
                <li>6. 生成最终的用户回复</li>
              </ol>
            </div>

            <div className="bg-white border border-yellow-300 rounded p-4">
              <h4 className="font-medium text-yellow-800 mb-2">
                🛠️ 可用工具类型
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {categories.map((category) => (
                  <div
                    key={category}
                    className="flex items-center gap-2 text-sm text-yellow-700"
                  >
                    {getToolIcon(category)}
                    <span>{category}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-yellow-300 rounded p-4">
              <h4 className="font-medium text-yellow-800 mb-2">
                🚀 AI自动判断示例
              </h4>
              <div className="text-sm text-yellow-700 space-y-2">
                <div>
                  <strong>数学计算</strong>: "2的8次方是多少" → 自动调用
                  calculate
                </div>
                <div>
                  <strong>文本处理</strong>: "统计这段话的字数" → 自动调用
                  process_text
                </div>
                <div>
                  <strong>时间计算</strong>: "今天加30天是几号" → 自动调用
                  date_time
                </div>
                <div>
                  <strong>编码转换</strong>: "把Hello转成Base64" → 自动调用
                  encoding
                </div>
                <div>
                  <strong>随机生成</strong>: "生成一个强密码" → 自动调用
                  random_generator
                </div>
                <div>
                  <strong>智能组合</strong>: "生成密码然后转Base64" →
                  自动调用多个工具
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </TestPageLayout>
  );
}
