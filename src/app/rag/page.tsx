'use client';

import { useState, useEffect, useRef } from 'react';
import TestPageLayout from '@/components/TestPageLayout';
import {
  parseDocument,
  isValidFileType,
  formatFileSize,
  preprocessContent,
} from '@/lib/documentParser';

interface Document {
  filename: string;
  fileType: string;
  size: string;
  chunks: number;
  uploadTime: string;
}

interface Source {
  filename: string;
  content: string;
}

interface VectorStoreStatus {
  hasDocuments: boolean;
  documentsCount: number;
}

interface StoredDocument {
  filename: string;
  chunkCount: number;
  totalLength: number;
  chunks: Array<{
    id: number;
    content: string;
    fullContent: string;
    length: number;
  }>;
}

export default function RAGPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [sources, setSources] = useState<Source[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [queryError, setQueryError] = useState('');
  const [vectorStatus, setVectorStatus] = useState<VectorStoreStatus>({
    hasDocuments: false,
    documentsCount: 0,
  });
  const [showStoredContent, setShowStoredContent] = useState(false);
  const [storedDocuments, setStoredDocuments] = useState<StoredDocument[]>([]);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 检查向量数据库状态
  const checkVectorStoreStatus = async () => {
    try {
      const response = await fetch('/api/rag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status' }),
      });
      const data = await response.json();
      setVectorStatus(data);
    } catch (error) {
      console.error('检查状态失败:', error);
    }
  };

  useEffect(() => {
    checkVectorStoreStatus();
  }, []);

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('📁 开始处理文件:', file.name, '大小:', file.size);
    setUploadError('');
    setIsUploading(true);

    try {
      // 验证文件类型
      if (!isValidFileType(file.name)) {
        throw new Error(
          '不支持的文件类型。请上传 .txt, .md, .pdf 或 .docx 文件'
        );
      }

      // 检查文件大小 (5MB限制)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('文件大小不能超过5MB');
      }

      console.log('✅ 文件验证通过，开始解析文档...');
      // 解析文档
      const parsedDoc = await parseDocument(file);
      console.log('✅ 文档解析完成，内容长度:', parsedDoc.content.length);

      const processedContent = preprocessContent(
        parsedDoc.content,
        parsedDoc.filename
      );
      console.log('✅ 文档预处理完成，处理后长度:', processedContent.length);

      console.log('🚀 发送上传请求到后端...');
      // 上传到后端
      const response = await fetch('/api/rag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upload',
          content: processedContent,
          filename: parsedDoc.filename,
        }),
      });

      console.log('📨 收到服务器响应，状态:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ 服务器返回错误:', errorData);
        throw new Error(errorData.error || '上传失败');
      }

      const result = await response.json();
      console.log('🎉 上传成功:', result);

      // 添加到文档列表
      const newDoc: Document = {
        filename: parsedDoc.filename,
        fileType: parsedDoc.fileType,
        size: formatFileSize(file.size),
        chunks: result.chunks,
        uploadTime: new Date().toLocaleString(),
      };

      setDocuments((prev) => [...prev, newDoc]);
      await checkVectorStoreStatus();

      // 清空文件输入
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('❌ 上传文件时发生错误:', error);
      setUploadError(
        error instanceof Error ? error.message : '上传文件时发生未知错误'
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleAskQuestion = async () => {
    if (!question.trim()) return;

    setIsLoading(true);
    setQueryError('');
    setSources([]);

    try {
      const response = await fetch('/api/rag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'query',
          question: question.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '查询失败');
      }

      const result = await response.json();
      setAnswer(result.answer);
      setSources(result.sources || []);
    } catch (error) {
      setQueryError(
        error instanceof Error ? error.message : '查询时发生未知错误'
      );
      setAnswer('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearDatabase = async () => {
    if (!confirm('确定要清空所有文档吗？此操作不可恢复。')) return;

    try {
      const response = await fetch('/api/rag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear' }),
      });

      if (response.ok) {
        setDocuments([]);
        setAnswer('');
        setSources([]);
        setQuestion('');
        setStoredDocuments([]);
        setShowStoredContent(false);
        await checkVectorStoreStatus();
      }
    } catch (error) {
      console.error('清空数据库失败:', error);
    }
  };

  const handleViewStoredContent = async () => {
    setIsLoadingContent(true);
    try {
      const response = await fetch('/api/rag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getStoredDocuments' }),
      });

      if (response.ok) {
        const data = await response.json();
        setStoredDocuments(data.files || []);
        setShowStoredContent(true);
        console.log('📋 存储的文档内容:', data);
      } else {
        console.error('获取存储内容失败');
      }
    } catch (error) {
      console.error('获取存储内容时发生错误:', error);
    } finally {
      setIsLoadingContent(false);
    }
  };

  return (
    <TestPageLayout
      title="RAG 问答系统"
      description="检索增强生成 - 基于文档内容回答问题"
    >
      <div className="p-6 space-y-6">
        {/* 向量数据库状态 */}
        <div className="bg-gray-50 border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">向量数据库状态</h4>
              <p className="text-sm text-gray-600">
                {vectorStatus.hasDocuments
                  ? `已索引 ${vectorStatus.documentsCount} 个文档片段`
                  : '暂无文档'}
              </p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={async () => {
                  try {
                    console.log('🧪 开始测试 API 连接...');
                    const response = await fetch('/api/rag/test', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ testText: '测试向量化' }),
                    });
                    const result = await response.json();
                    console.log('🧪 测试结果:', result);
                    alert(
                      result.success
                        ? `✅ API 连接正常！响应时间: ${result.responseTime}ms`
                        : `❌ API 连接失败: ${result.error}`
                    );
                  } catch (error) {
                    console.error('❌ 测试失败:', error);
                    alert('❌ 测试失败，请查看控制台');
                  }
                }}
                className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                测试API
              </button>
              {vectorStatus.hasDocuments && (
                <button
                  onClick={handleViewStoredContent}
                  disabled={isLoadingContent}
                  className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50"
                >
                  {isLoadingContent ? '加载中...' : '查看存储内容'}
                </button>
              )}
              {documents.length > 0 && (
                <button
                  onClick={handleClearDatabase}
                  className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                >
                  清空数据库
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 存储内容显示区域 */}
        {showStoredContent && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium text-green-900">
                📋 向量数据库存储内容
              </h4>
              <button
                onClick={() => setShowStoredContent(false)}
                className="px-2 py-1 text-sm bg-green-200 text-green-800 rounded hover:bg-green-300"
              >
                关闭
              </button>
            </div>

            {storedDocuments.length === 0 ? (
              <p className="text-green-700">暂无存储的文档片段</p>
            ) : (
              <div className="space-y-4">
                {storedDocuments.map((doc, index) => (
                  <div
                    key={index}
                    className="bg-white border border-green-300 rounded p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="font-medium text-green-800">
                        📄 {doc.filename}
                      </h5>
                      <div className="text-sm text-green-600">
                        {doc.chunkCount} 个片段 • 总长度: {doc.totalLength} 字符
                      </div>
                    </div>

                    <div className="space-y-2">
                      {doc.chunks.map((chunk, chunkIndex) => (
                        <div
                          key={chunkIndex}
                          className="bg-green-50 border border-green-200 rounded p-3"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-green-700">
                              片段 {chunk.id} ({chunk.length} 字符)
                            </span>
                            <button
                              onClick={() => {
                                const element = document.getElementById(
                                  `chunk-${index}-${chunkIndex}`
                                );
                                if (element) {
                                  if (element.style.display === 'none') {
                                    element.style.display = 'block';
                                  } else {
                                    element.style.display = 'none';
                                  }
                                }
                              }}
                              className="text-sm text-green-600 hover:text-green-800"
                            >
                              展开/收起
                            </button>
                          </div>
                          <p className="text-sm text-green-700 mb-2">
                            {chunk.content}
                          </p>
                          <div
                            id={`chunk-${index}-${chunkIndex}`}
                            style={{ display: 'none' }}
                            className="mt-2 p-2 bg-white border border-green-300 rounded"
                          >
                            <p className="text-sm text-gray-700 font-mono whitespace-pre-wrap">
                              {chunk.fullContent}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 文档管理区域 */}
        <div className="border-b pb-6">
          <h3 className="text-lg font-semibold mb-4">文档管理</h3>
          <div className="space-y-4">
            <div className="flex space-x-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.pdf,.docx,.md"
                onChange={handleFileUpload}
                disabled={isUploading}
                className="flex-1 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 disabled:opacity-50"
              />
              <div className="text-sm text-gray-500 flex items-center">
                {isUploading && (
                  <span className="flex items-center">
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    处理中...
                  </span>
                )}
              </div>
            </div>

            {uploadError && (
              <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-sm">
                {uploadError}
              </div>
            )}

            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">已加载文档：</p>
              {documents.length === 0 ? (
                <p className="text-sm text-gray-500">
                  暂无文档，请上传文档进行测试
                </p>
              ) : (
                <div className="space-y-2">
                  {documents.map((doc, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-white p-3 rounded border"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          📄 {doc.filename}
                        </p>
                        <p className="text-xs text-gray-500">
                          {doc.fileType.toUpperCase()} • {doc.size} •{' '}
                          {doc.chunks} 个片段 • {doc.uploadTime}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 问答区域 */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">基于文档问答</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                你的问题：
              </label>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="请输入你想问的问题..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                rows={3}
              />
            </div>

            <button
              onClick={handleAskQuestion}
              disabled={
                !question.trim() || isLoading || !vectorStatus.hasDocuments
              }
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '分析中...' : '提问'}
            </button>

            {queryError && (
              <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-sm">
                {queryError}
              </div>
            )}

            {answer && (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">
                    💡 AI 回答：
                  </h4>
                  <p className="text-blue-800 whitespace-pre-wrap">{answer}</p>
                </div>

                {sources.length > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="font-medium text-green-900 mb-2">
                      📚 参考来源：
                    </h4>
                    <div className="space-y-2">
                      {sources.map((source, index) => (
                        <div
                          key={index}
                          className="bg-white border border-green-300 rounded p-3"
                        >
                          <p className="text-sm font-medium text-green-800 mb-1">
                            📄 {source.filename}
                          </p>
                          <p className="text-sm text-green-700 italic">
                            "{source.content}"
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 使用指南 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">📖 使用指南</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>
              • 支持上传 .txt, .md, .pdf, .docx 格式文档（暂时仅支持.txt和.md）
            </li>
            <li>• 文档会自动分块并转换为向量存储</li>
            <li>• 问答基于相似性搜索找到相关文档片段</li>
            <li>• AI 会根据检索到的内容生成准确回答</li>
            <li>• 可以查看回答的具体来源文档</li>
            <li>• 支持查看向量数据库中存储的所有文档片段</li>
          </ul>
        </div>

        {/* 技术实现 */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2">🔧 技术实现</h4>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>
              • 文档分块：RecursiveCharacterTextSplitter
              (2000字符/块，100字符重叠，最多10片段)
            </li>
            <li>• 向量化：OpenAI Embeddings API</li>
            <li>• 向量存储：LangChain MemoryVectorStore</li>
            <li>• 相似性搜索：余弦相似度检索Top-4</li>
            <li>• 生成模型：GPT-3.5-turbo (温度0.1)</li>
            <li>• RAG框架：LangChain RunnableSequence</li>
            <li>• 存储管理：支持查看、清空向量数据库内容</li>
            <li>• 超时控制：30秒向量化超时保护</li>
          </ul>
        </div>
      </div>
    </TestPageLayout>
  );
}
