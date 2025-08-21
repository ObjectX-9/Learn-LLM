'use client';

import { useState, useRef, useEffect } from 'react';
import { Streamdown } from 'streamdown';
import TestPageLayout from '@/components/TestPageLayout';

interface PromptTestRequest {
  prompt: string;
  systemMessage?: string;
  temperature?: number;
  maxTokens?: number;
  modelName?: string;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stream?: boolean;
  responseFormat?:
    | 'text'
    | 'json'
    | 'markdown'
    | 'html'
    | 'table'
    | 'code'
    | 'score';
  testType?:
    | 'text-generation'
    | 'role-play'
    | 'data-format'
    | 'translation'
    | 'code-generation'
    | 'qa'
    | 'text-analysis'
    | 'prompt-evaluation';
}

interface TestResult {
  id: string;
  timestamp: number;
  request: PromptTestRequest;
  response: string;
  score?: number;
  notes?: string;
  duration?: number;
}

interface PromptTemplate {
  id: string;
  name: string;
  category: string;
  prompt: string;
  systemMessage?: string;
  testType: string;
  responseFormat: string;
  description: string;
}

const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'story-gen',
    name: '故事生成',
    category: 'text-generation',
    prompt: '请写一个关于{主题}的短故事，大约300字。',
    testType: 'text-generation',
    responseFormat: 'markdown',
    description: '生成创意故事的模板',
  },
  {
    id: 'customer-service',
    name: '客服角色',
    category: 'role-play',
    prompt: '客户问题：{问题内容}',
    systemMessage:
      '你是一位专业、友善的客服代表。请耐心解答客户问题，提供有帮助的解决方案。',
    testType: 'role-play',
    responseFormat: 'text',
    description: '客服角色扮演模板',
  },
  {
    id: 'json-format',
    name: 'JSON格式化',
    category: 'data-format',
    prompt: '请将以下信息转换为JSON格式：{数据内容}',
    testType: 'data-format',
    responseFormat: 'json',
    description: '将非结构化数据转换为JSON',
  },
  {
    id: 'translation',
    name: '中英翻译',
    category: 'translation',
    prompt: '请将以下文本翻译为{目标语言}：{原文}',
    testType: 'translation',
    responseFormat: 'text',
    description: '中英文互译模板',
  },
  {
    id: 'code-gen',
    name: '代码生成',
    category: 'code-generation',
    prompt: '请用{编程语言}实现以下功能：{功能描述}',
    testType: 'code-generation',
    responseFormat: 'code',
    description: '代码生成模板',
  },
  {
    id: 'qa-expert',
    name: '专业问答',
    category: 'qa',
    prompt: '请详细回答以下问题：{问题}',
    systemMessage: '你是一个知识渊博的专家，能够提供准确、详细的答案。',
    testType: 'qa',
    responseFormat: 'markdown',
    description: '专业问答模板',
  },
  {
    id: 'sentiment-analysis',
    name: '情感分析',
    category: 'text-analysis',
    prompt: '请分析以下文本的情感倾向：{文本内容}',
    testType: 'text-analysis',
    responseFormat: 'json',
    description: '文本情感分析模板',
  },
  {
    id: 'prompt-eval',
    name: 'Prompt评估',
    category: 'prompt-evaluation',
    prompt: '请评估以下Prompt的质量：{Prompt内容}',
    testType: 'prompt-evaluation',
    responseFormat: 'score',
    description: 'Prompt质量评估模板',
  },
];

export default function PromptTestPage() {
  const [request, setRequest] = useState<PromptTestRequest>({
    prompt: '',
    systemMessage: '',
    temperature: 0.7,
    maxTokens: 2000,
    modelName: 'gpt-3.5-turbo',
    topP: 1,
    frequencyPenalty: 0,
    presencePenalty: 0,
    stream: true,
    responseFormat: 'text',
    testType: 'text-generation',
  });

  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<TestResult[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [compareMode, setCompareMode] = useState(false);
  const [compareResults, setCompareResults] = useState<TestResult[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [currentScore, setCurrentScore] = useState<number>(0);
  const [currentNotes, setCurrentNotes] = useState('');

  const abortControllerRef = useRef<AbortController | null>(null);

  // 加载历史记录
  useEffect(() => {
    const savedHistory = localStorage.getItem('prompt-test-history');
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }
  }, []);

  // 保存历史记录
  const saveToHistory = (result: TestResult) => {
    const newHistory = [result, ...history].slice(0, 100); // 保留最近100条
    setHistory(newHistory);
    localStorage.setItem('prompt-test-history', JSON.stringify(newHistory));
  };

  // 应用模板
  const applyTemplate = (templateId: string) => {
    const template = PROMPT_TEMPLATES.find((t) => t.id === templateId);
    if (template) {
      setRequest((prev) => ({
        ...prev,
        prompt: template.prompt,
        systemMessage: template.systemMessage || '',
        testType: template.testType as any,
        responseFormat: template.responseFormat as any,
      }));
      setSelectedTemplate(templateId);
    }
  };

  // 发送请求
  const handleSubmit = async () => {
    if (!request.prompt.trim()) return;

    setIsLoading(true);
    setResponse('');
    const startTime = Date.now();

    try {
      abortControllerRef.current = new AbortController();

      const response = await fetch('/api/prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (request.stream) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';

        while (reader) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.content) {
                  fullResponse += data.content;
                  setResponse(fullResponse);
                }
                if (data.done) {
                  const duration = Date.now() - startTime;
                  const result: TestResult = {
                    id: Date.now().toString(),
                    timestamp: Date.now(),
                    request: { ...request },
                    response: fullResponse,
                    duration,
                  };

                  if (compareMode) {
                    setCompareResults((prev) => [...prev, result]);
                  } else {
                    saveToHistory(result);
                  }
                }
              } catch (e) {
                // 忽略解析错误
              }
            }
          }
        }
      } else {
        const data = await response.json();
        const duration = Date.now() - startTime;
        setResponse(data.content);

        const result: TestResult = {
          id: Date.now().toString(),
          timestamp: Date.now(),
          request: { ...request },
          response: data.content,
          duration,
        };

        if (compareMode) {
          setCompareResults((prev) => [...prev, result]);
        } else {
          saveToHistory(result);
        }
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        setResponse(`错误: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 停止生成
  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  };

  // 评分和备注
  const saveScoreAndNotes = (resultId: string) => {
    const updatedHistory = history.map((item) =>
      item.id === resultId
        ? { ...item, score: currentScore, notes: currentNotes }
        : item
    );
    setHistory(updatedHistory);
    localStorage.setItem('prompt-test-history', JSON.stringify(updatedHistory));
    setCurrentScore(0);
    setCurrentNotes('');
  };

  // 导出功能
  const exportResults = (format: 'json' | 'csv' | 'markdown') => {
    const dataToExport = compareMode ? compareResults : history;
    let content = '';
    let filename = '';

    switch (format) {
      case 'json':
        content = JSON.stringify(dataToExport, null, 2);
        filename = 'prompt-test-results.json';
        break;
      case 'csv':
        const csvHeaders =
          'ID,时间戳,测试类型,Prompt,响应格式,响应内容,评分,备注,耗时\n';
        const csvRows = dataToExport
          .map(
            (item) =>
              `"${item.id}","${new Date(item.timestamp).toLocaleString()}","${item.request.testType}","${item.request.prompt.replace(/"/g, '""')}","${item.request.responseFormat}","${item.response.replace(/"/g, '""')}","${item.score || ''}","${item.notes || ''}","${item.duration || ''}"`
          )
          .join('\n');
        content = csvHeaders + csvRows;
        filename = 'prompt-test-results.csv';
        break;
      case 'markdown':
        content = dataToExport
          .map(
            (item) => `
## 测试结果 ${item.id}

**时间**: ${new Date(item.timestamp).toLocaleString()}
**类型**: ${item.request.testType}
**响应格式**: ${item.request.responseFormat}
**评分**: ${item.score || '未评分'}
**耗时**: ${item.duration || '未知'}ms

### Prompt
\`\`\`
${item.request.prompt}
\`\`\`

### 系统消息
\`\`\`
${item.request.systemMessage || '无'}
\`\`\`

### 响应结果
${item.response}

### 备注
${item.notes || '无'}

---
`
          )
          .join('\n');
        filename = 'prompt-test-results.md';
        break;
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 分享模板
  const shareTemplate = () => {
    const template = {
      name: '自定义模板',
      prompt: request.prompt,
      systemMessage: request.systemMessage,
      testType: request.testType,
      responseFormat: request.responseFormat,
      parameters: {
        temperature: request.temperature,
        maxTokens: request.maxTokens,
        topP: request.topP,
        frequencyPenalty: request.frequencyPenalty,
        presencePenalty: request.presencePenalty,
      },
    };

    navigator.clipboard.writeText(JSON.stringify(template, null, 2));
    alert('模板已复制到剪贴板！');
  };

  return (
    <TestPageLayout
      title="Prompt 测试平台"
      description="测试各种类型的 Prompt，支持流式输出、参数调节、结果对比和评分"
    >
      <div className="p-6 space-y-6">
        {/* 头部控制按钮 */}
        <div className="flex justify-end gap-2 mb-6">
          <button
            onClick={() => setCompareMode(!compareMode)}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              compareMode
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {compareMode ? '退出对比模式' : '开启对比模式'}
          </button>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200"
          >
            {showAdvanced ? '隐藏高级设置' : '显示高级设置'}
          </button>
        </div>

        {/* 模板选择 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            预设模板
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {PROMPT_TEMPLATES.map((template) => (
              <button
                key={template.id}
                onClick={() => applyTemplate(template.id)}
                className={`p-3 text-left rounded-lg border text-sm ${
                  selectedTemplate === template.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium text-gray-900">{template.name}</div>
                <div className="text-gray-500 text-xs mt-1">
                  {template.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 基础设置 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              测试类型
            </label>
            <select
              value={request.testType}
              onChange={(e) =>
                setRequest((prev) => ({
                  ...prev,
                  testType: e.target.value as any,
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="text-generation">文本生成</option>
              <option value="role-play">角色扮演</option>
              <option value="data-format">数据格式化</option>
              <option value="translation">翻译</option>
              <option value="code-generation">代码生成</option>
              <option value="qa">问答对话</option>
              <option value="text-analysis">文本分析</option>
              <option value="prompt-evaluation">Prompt评测</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              返回格式
            </label>
            <select
              value={request.responseFormat}
              onChange={(e) =>
                setRequest((prev) => ({
                  ...prev,
                  responseFormat: e.target.value as any,
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="text">纯文本</option>
              <option value="json">JSON格式</option>
              <option value="markdown">Markdown</option>
              <option value="html">HTML</option>
              <option value="table">表格格式</option>
              <option value="code">代码块</option>
              <option value="score">评分格式</option>
            </select>
          </div>
        </div>

        {/* 高级设置 */}
        {showAdvanced && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              高级参数设置
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  温度值 ({request.temperature})
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={request.temperature}
                  onChange={(e) =>
                    setRequest((prev) => ({
                      ...prev,
                      temperature: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  最大Token ({request.maxTokens})
                </label>
                <input
                  type="range"
                  min="100"
                  max="4000"
                  step="100"
                  value={request.maxTokens}
                  onChange={(e) =>
                    setRequest((prev) => ({
                      ...prev,
                      maxTokens: parseInt(e.target.value),
                    }))
                  }
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Top-p ({request.topP})
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={request.topP}
                  onChange={(e) =>
                    setRequest((prev) => ({
                      ...prev,
                      topP: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  频率惩罚 ({request.frequencyPenalty})
                </label>
                <input
                  type="range"
                  min="-2"
                  max="2"
                  step="0.1"
                  value={request.frequencyPenalty}
                  onChange={(e) =>
                    setRequest((prev) => ({
                      ...prev,
                      frequencyPenalty: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  存在惩罚 ({request.presencePenalty})
                </label>
                <input
                  type="range"
                  min="-2"
                  max="2"
                  step="0.1"
                  value={request.presencePenalty}
                  onChange={(e) =>
                    setRequest((prev) => ({
                      ...prev,
                      presencePenalty: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  模型选择
                </label>
                <select
                  value={request.modelName}
                  onChange={(e) =>
                    setRequest((prev) => ({
                      ...prev,
                      modelName: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-1 border border-gray-300 rounded-md text-sm"
                >
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                  <option value="gpt-4">GPT-4</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                </select>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="stream"
                  checked={request.stream}
                  onChange={(e) =>
                    setRequest((prev) => ({
                      ...prev,
                      stream: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="stream" className="ml-2 text-sm text-gray-700">
                  启用流式输出
                </label>
              </div>
            </div>
          </div>
        )}

        {/* 输入区域 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              系统消息 (可选)
            </label>
            <textarea
              value={request.systemMessage}
              onChange={(e) =>
                setRequest((prev) => ({
                  ...prev,
                  systemMessage: e.target.value,
                }))
              }
              placeholder="设定AI的角色和行为方式..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Prompt 内容 *
            </label>
            <textarea
              value={request.prompt}
              onChange={(e) =>
                setRequest((prev) => ({ ...prev, prompt: e.target.value }))
              }
              placeholder="输入你的prompt..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-none"
            />
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={isLoading || !request.prompt.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isLoading ? '生成中...' : '开始测试'}
            </button>

            {isLoading && (
              <button
                onClick={handleStop}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                停止
              </button>
            )}

            <button
              onClick={shareTemplate}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              分享模板
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => exportResults('json')}
              className="px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm"
            >
              导出JSON
            </button>
            <button
              onClick={() => exportResults('csv')}
              className="px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm"
            >
              导出CSV
            </button>
            <button
              onClick={() => exportResults('markdown')}
              className="px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm"
            >
              导出MD
            </button>
          </div>
        </div>

        {/* 结果显示区域 */}
        {(response || compareResults.length > 0) && (
          <div className="border-t pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {compareMode ? '对比结果' : '测试结果'}
            </h3>

            {compareMode ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {compareResults.map((result, index) => (
                  <div key={result.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-medium">测试 {index + 1}</h4>
                      <span className="text-sm text-gray-500">
                        {result.duration}ms
                      </span>
                    </div>
                    <div className="bg-gray-50 rounded p-3 max-h-96 overflow-y-auto">
                      {result.request.responseFormat === 'markdown' ? (
                        <Streamdown>{result.response}</Streamdown>
                      ) : (
                        <pre className="whitespace-pre-wrap text-sm">
                          {result.response}
                        </pre>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="max-h-96 overflow-y-auto">
                  {request.responseFormat === 'markdown' ? (
                    <Streamdown>{response}</Streamdown>
                  ) : (
                    <pre className="whitespace-pre-wrap text-sm">
                      {response}
                    </pre>
                  )}
                </div>
              </div>
            )}

            {compareMode && compareResults.length > 0 && (
              <button
                onClick={() => setCompareResults([])}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                清空对比结果
              </button>
            )}
          </div>
        )}

        {/* 历史记录 */}
        {history.length > 0 && (
          <div className="border-t pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">测试历史</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {history.slice(0, 10).map((item) => (
                <div key={item.id} className="border rounded-lg p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <div className="text-sm text-gray-600">
                        {new Date(item.timestamp).toLocaleString()} |
                        {item.request.testType} |{item.request.responseFormat} |
                        {item.duration}ms
                      </div>
                      <div className="text-sm font-medium text-gray-900 mt-1">
                        {item.request.prompt.slice(0, 100)}
                        {item.request.prompt.length > 100 && '...'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {item.score && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                          {item.score}/10
                        </span>
                      )}
                      <button
                        onClick={() => {
                          setRequest(item.request);
                          setResponse(item.response);
                        }}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        重新加载
                      </button>
                    </div>
                  </div>

                  {/* 评分和备注 */}
                  <div className="flex gap-2 mt-2">
                    <input
                      type="number"
                      min="1"
                      max="10"
                      placeholder="评分"
                      value={currentScore || ''}
                      onChange={(e) =>
                        setCurrentScore(parseInt(e.target.value))
                      }
                      className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                    <input
                      type="text"
                      placeholder="备注..."
                      value={currentNotes}
                      onChange={(e) => setCurrentNotes(e.target.value)}
                      className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                    <button
                      onClick={() => saveScoreAndNotes(item.id)}
                      className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                    >
                      保存
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </TestPageLayout>
  );
}
