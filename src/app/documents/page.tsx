'use client';

import { useState, useRef } from 'react';
import TestPageLayout from '@/components/TestPageLayout';

interface ProcessedDocument {
  id: string;
  name: string;
  type: string;
  size: string;
  chunks: number;
  content: string;
  metadata: Record<string, any>;
  loaderClass: string;
  splitterClass: string;
  documentCount: number;
  processTime: number;
  uploadTime: string;
  totalContentLength: number;
  hasFallback?: boolean;
  warnings?: string[];
}

interface DocumentChunk {
  id: string;
  content: string;
  metadata: Record<string, any>;
  chunkIndex: number;
}

interface OriginalDocument {
  content: string;
  metadata: Record<string, any>;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<ProcessedDocument[]>([]);
  const [selectedDocument, setSelectedDocument] =
    useState<ProcessedDocument | null>(null);
  const [documentChunks, setDocumentChunks] = useState<DocumentChunk[]>([]);
  const [originalDocuments, setOriginalDocuments] = useState<
    OriginalDocument[]
  >([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [processingOptions, setProcessingOptions] = useState({
    chunkSize: 1000,
    chunkOverlap: 200,
    splitterType: 'recursive',
  });
  const [selectedLoader, setSelectedLoader] = useState('auto');
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 真正的 LangChain 文档加载器
  const documentLoaders = [
    {
      id: 'auto',
      name: '自动检测',
      description: '根据文件类型自动选择 LangChain 加载器',
    },
    {
      id: 'text',
      name: 'TextLoader',
      description: 'LangChain 官方文本文件加载器 (.txt)',
    },
    {
      id: 'markdown',
      name: 'TextLoader + MarkdownTextSplitter',
      description: 'Markdown文档专用处理 (.md)',
    },
    {
      id: 'pdf',
      name: 'PDFLoader',
      description: 'LangChain 官方PDF加载器 (.pdf)',
    },
    {
      id: 'docx',
      name: 'DocxLoader',
      description: 'LangChain 官方Word文档加载器 (.docx)',
    },
    {
      id: 'csv',
      name: 'CSVLoader',
      description: 'LangChain 官方CSV文件加载器 (.csv)',
    },
    {
      id: 'json',
      name: 'JSONLoader',
      description: 'LangChain 官方JSON文件加载器 (.json)',
    },
    {
      id: 'html',
      name: 'CheerioWebBaseLoader',
      description: 'LangChain 官方HTML文档加载器 (.html)',
    },
  ];

  // LangChain 文档分割器
  const splitterOptions = [
    {
      id: 'recursive',
      name: 'RecursiveCharacterTextSplitter',
      description: 'LangChain 递归字符分割器 - 智能分割',
    },
    {
      id: 'token',
      name: 'TokenTextSplitter',
      description: 'LangChain Token分割器 - 按Token分割',
    },
    {
      id: 'character',
      name: 'CharacterTextSplitter',
      description: 'LangChain 字符分割器 - 按指定字符分割',
    },
    {
      id: 'markdown',
      name: 'MarkdownTextSplitter',
      description: 'LangChain Markdown分割器 - 保持结构',
    },
  ];

  // 处理文档上传
  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError('');

    try {
      console.log('📄 开始使用 LangChain 处理文档:', file.name);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('loader', selectedLoader);
      formData.append('options', JSON.stringify(processingOptions));

      const startTime = Date.now();
      const response = await fetch('/api/documents/process', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.details || errorData.error || 'LangChain 文档处理失败'
        );
      }

      const result = await response.json();
      const processTime = Date.now() - startTime;

      console.log('✅ LangChain 处理结果:', result);

      // 检查是否有警告信息
      if (result.warnings && result.warnings.length > 0) {
        console.warn('⚠️ 处理警告:', result.warnings);
      }

      const newDocument: ProcessedDocument = {
        id: result.id,
        name: file.name,
        type: result.documentType,
        size: formatFileSize(file.size),
        chunks: result.chunks.length,
        content: result.content,
        metadata: result.metadata,
        loaderClass: result.loaderClass,
        splitterClass: result.splitterClass,
        documentCount: result.documentCount,
        processTime: result.processTime,
        uploadTime: new Date().toLocaleString(),
        totalContentLength: result.totalContentLength,
        hasFallback: result.hasFallback,
        warnings: result.warnings,
      };

      setDocuments((prev) => [...prev, newDocument]);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('❌ LangChain 文档处理失败:', error);
      setError(
        error instanceof Error ? error.message : 'LangChain 文档处理失败'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // 查看文档详情
  const handleViewDocument = async (document: ProcessedDocument) => {
    setSelectedDocument(document);
    setShowPreview(true);

    try {
      const response = await fetch(`/api/documents/process?id=${document.id}`, {
        method: 'GET',
      });

      if (response.ok) {
        const data = await response.json();
        setDocumentChunks(data.chunks || []);
        setOriginalDocuments(data.originalDocuments || []);
        console.log('📋 LangChain 文档详情:', data);
      }
    } catch (error) {
      console.error('获取 LangChain 文档块失败:', error);
    }
  };

  // 重新处理文档
  const handleReprocess = async (document: ProcessedDocument) => {
    if (!confirm('确定要使用当前设置重新处理这个文档吗？')) return;

    try {
      const response = await fetch('/api/documents/reprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: document.id,
          options: processingOptions,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setDocuments((prev) =>
          prev.map((doc) =>
            doc.id === document.id
              ? {
                  ...doc,
                  chunks: result.chunks.length,
                  processTime: result.processTime,
                }
              : doc
          )
        );
        alert('✅ 重新处理完成！');
      }
    } catch (error) {
      setError('重新处理失败');
    }
  };

  // 删除文档
  const handleDeleteDocument = (documentId: string) => {
    if (!confirm('确定要删除这个文档吗？')) return;
    setDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
    if (selectedDocument?.id === documentId) {
      setSelectedDocument(null);
      setShowPreview(false);
    }
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <TestPageLayout
      title="LangChain 文档处理系统"
      description="使用 LangChain 官方文档加载器和分割器处理各种格式文档"
    >
      <div className="p-6 space-y-6">
        {/* LangChain 处理配置 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">
            🦜🔗 LangChain 文档处理
          </h3>

          {/* LangChain 加载器选择 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-blue-700 mb-2">
              LangChain 文档加载器：
            </label>
            <select
              value={selectedLoader}
              onChange={(e) => setSelectedLoader(e.target.value)}
              className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {documentLoaders.map((loader) => (
                <option key={loader.id} value={loader.id}>
                  {loader.name} - {loader.description}
                </option>
              ))}
            </select>
          </div>

          {/* LangChain 分割器选择 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-blue-700 mb-2">
              LangChain 文档分割器：
            </label>
            <select
              value={processingOptions.splitterType}
              onChange={(e) =>
                setProcessingOptions((prev) => ({
                  ...prev,
                  splitterType: e.target.value,
                }))
              }
              className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {splitterOptions.map((splitter) => (
                <option key={splitter.id} value={splitter.id}>
                  {splitter.name} - {splitter.description}
                </option>
              ))}
            </select>
          </div>

          {/* 分割参数 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-blue-700 mb-2">
                分块大小 (chunkSize)：
              </label>
              <input
                type="number"
                value={processingOptions.chunkSize}
                onChange={(e) =>
                  setProcessingOptions((prev) => ({
                    ...prev,
                    chunkSize: parseInt(e.target.value),
                  }))
                }
                className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="100"
                max="5000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-blue-700 mb-2">
                重叠字符数 (chunkOverlap)：
              </label>
              <input
                type="number"
                value={processingOptions.chunkOverlap}
                onChange={(e) =>
                  setProcessingOptions((prev) => ({
                    ...prev,
                    chunkOverlap: parseInt(e.target.value),
                  }))
                }
                className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
                max="1000"
              />
            </div>
          </div>

          {/* 文件上传 */}
          <div className="flex space-x-4">
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileUpload}
              disabled={isProcessing}
              accept=".txt,.md,.pdf,.docx,.csv,.json,.html"
              className="flex-1 text-sm text-blue-600 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 disabled:opacity-50"
            />
            {isProcessing && (
              <div className="flex items-center text-blue-600">
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
                LangChain 处理中...
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-sm">
              ❌ {error}
            </div>
          )}
        </div>

        {/* 已处理文档列表 */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            📚 LangChain 处理的文档
          </h3>

          {documents.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-2">
                暂无使用 LangChain 处理的文档
              </p>
              <p className="text-sm text-gray-400">
                上传文档开始体验 LangChain 的强大功能
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="bg-white border border-gray-300 rounded-lg p-4 hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">
                        📄 {doc.name}
                      </h4>

                      {/* 基本信息 */}
                      <div className="text-sm text-gray-600 mt-1">
                        <span className="inline-block mr-4">
                          📊 {doc.type} • {doc.size} • {doc.totalContentLength}{' '}
                          字符
                        </span>
                        <span className="inline-block mr-4">
                          🧩 {doc.chunks} 个片段
                        </span>
                        <span className="inline-block mr-4">
                          ⏱️ {doc.processTime}ms
                        </span>
                      </div>

                      {/* LangChain 信息 */}
                      <div className="text-xs text-blue-600 mt-1">
                        <span className="inline-block mr-4">
                          🦜 加载器: {doc.loaderClass}
                        </span>
                        <span className="inline-block mr-4">
                          ✂️ 分割器: {doc.splitterClass}
                        </span>
                        {doc.documentCount > 1 && (
                          <span className="inline-block mr-4">
                            📄 文档数: {doc.documentCount}
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-gray-500 mt-1">
                        📅 {doc.uploadTime}
                      </div>

                      {/* 警告信息 */}
                      {doc.hasFallback && doc.warnings && (
                        <div className="text-xs text-orange-600 mt-1 bg-orange-50 border border-orange-200 rounded px-2 py-1">
                          ⚠️ {doc.warnings.join(', ')}
                        </div>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleViewDocument(doc)}
                        className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                      >
                        预览
                      </button>
                      <button
                        onClick={() => handleReprocess(doc)}
                        className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
                      >
                        重处理
                      </button>
                      <button
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* LangChain 文档预览模态框 */}
        {showPreview && selectedDocument && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="text-lg font-semibold">
                  🦜🔗 {selectedDocument.name}
                </h3>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <div className="p-4 max-h-[calc(90vh-8rem)] overflow-y-auto">
                {/* LangChain 元数据 */}
                <div className="mb-4 p-3 bg-blue-50 rounded">
                  <h4 className="font-medium mb-2">🦜 LangChain 处理信息</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>文件类型: {selectedDocument.type}</div>
                    <div>文件大小: {selectedDocument.size}</div>
                    <div>LangChain 加载器: {selectedDocument.loaderClass}</div>
                    <div>
                      LangChain 分割器: {selectedDocument.splitterClass}
                    </div>
                    <div>原始文档数: {selectedDocument.documentCount}</div>
                    <div>片段数: {selectedDocument.chunks}</div>
                    <div>
                      总内容长度: {selectedDocument.totalContentLength} 字符
                    </div>
                    <div>处理时间: {selectedDocument.processTime}ms</div>
                    <div>上传时间: {selectedDocument.uploadTime}</div>
                  </div>

                  {/* 警告信息显示 */}
                  {selectedDocument.hasFallback &&
                    selectedDocument.warnings && (
                      <div className="mt-3 p-2 bg-orange-50 border border-orange-200 rounded">
                        <h5 className="font-medium mb-1 text-orange-800">
                          ⚠️ 处理警告:
                        </h5>
                        <ul className="text-sm text-orange-700">
                          {selectedDocument.warnings.map((warning, index) => (
                            <li key={index}>• {warning}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                  {Object.keys(selectedDocument.metadata).length > 0 && (
                    <div className="mt-3">
                      <h5 className="font-medium mb-1">
                        LangChain 文档元数据:
                      </h5>
                      <pre className="text-xs bg-blue-100 p-2 rounded overflow-x-auto">
                        {JSON.stringify(selectedDocument.metadata, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>

                {/* 原始 LangChain 文档 */}
                {originalDocuments.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium mb-3">
                      📄 LangChain 原始文档 ({originalDocuments.length})
                    </h4>
                    <div className="space-y-3">
                      {originalDocuments.map((doc, index) => (
                        <div
                          key={index}
                          className="border border-green-200 rounded p-3 bg-green-50"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-green-700">
                              文档 #{index + 1}
                            </span>
                          </div>
                          <div className="text-sm text-green-900 bg-white p-2 rounded mb-2">
                            {doc.content}
                          </div>
                          <div className="text-xs text-green-600">
                            <strong>元数据:</strong>{' '}
                            {JSON.stringify(doc.metadata, null, 2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* LangChain 分割的片段 */}
                <div>
                  <h4 className="font-medium mb-3">
                    🧩 LangChain 分割片段 ({documentChunks.length})
                  </h4>
                  <div className="space-y-3">
                    {documentChunks.map((chunk, index) => (
                      <div
                        key={chunk.id}
                        className="border border-gray-200 rounded p-3"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">
                            片段 #{index + 1} (索引: {chunk.chunkIndex})
                          </span>
                          <span className="text-xs text-gray-500">
                            {chunk.content.length} 字符
                          </span>
                        </div>
                        <div className="text-sm text-gray-900 bg-gray-50 p-2 rounded mb-2">
                          {chunk.content.length > 500
                            ? chunk.content.substring(0, 500) + '...'
                            : chunk.content}
                        </div>
                        <div className="text-xs text-gray-600">
                          <strong>LangChain 元数据:</strong>
                          <pre className="mt-1 bg-gray-100 p-1 rounded text-xs overflow-x-auto">
                            {JSON.stringify(chunk.metadata, null, 2)}
                          </pre>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* LangChain 加载器说明 */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="font-medium text-green-900 mb-3">
            🦜🔗 LangChain 官方文档加载器
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {documentLoaders.slice(1).map((loader) => (
              <div
                key={loader.id}
                className="bg-white border border-green-300 rounded p-3"
              >
                <h5 className="font-medium text-green-800">{loader.name}</h5>
                <p className="text-sm text-green-700">{loader.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* LangChain 分割器说明 */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="font-medium text-yellow-900 mb-3">
            ✂️ LangChain 官方文档分割器
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {splitterOptions.map((splitter) => (
              <div
                key={splitter.id}
                className="bg-white border border-yellow-300 rounded p-3"
              >
                <h5 className="font-medium text-yellow-800">{splitter.name}</h5>
                <p className="text-sm text-yellow-700">
                  {splitter.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* 依赖安装指南 */}
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <h4 className="font-medium text-orange-900 mb-2">📦 依赖安装指南</h4>
          <p className="text-sm text-orange-800 mb-3">
            某些 LangChain 加载器需要额外的依赖包才能正常工作：
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-white border border-orange-300 rounded p-3">
              <h5 className="font-medium text-orange-800">PDF 文档支持</h5>
              <p className="text-sm text-orange-700 mb-2">
                PDFLoader 需要 pdf-parse 包
              </p>
              <code className="text-xs bg-orange-100 p-1 rounded">
                pnpm add pdf-parse
              </code>
            </div>
            <div className="bg-white border border-orange-300 rounded p-3">
              <h5 className="font-medium text-orange-800">Word 文档支持</h5>
              <p className="text-sm text-orange-700 mb-2">
                DocxLoader 需要 mammoth 包
              </p>
              <code className="text-xs bg-orange-100 p-1 rounded">
                pnpm add mammoth
              </code>
            </div>
          </div>
          <p className="text-xs text-orange-600 mt-3">
            💡 如果缺少依赖，系统会自动降级使用基础文本处理
          </p>
        </div>

        {/* 使用指南 */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h4 className="font-medium text-purple-900 mb-2">
            💡 LangChain 使用指南
          </h4>
          <ul className="text-sm text-purple-800 space-y-1">
            <li>• 🦜 使用 LangChain 官方文档加载器，确保最佳兼容性</li>
            <li>• 📄 TextLoader: 处理纯文本文件</li>
            <li>• 📊 PDFLoader: 专业的PDF内容提取</li>
            <li>• 📝 DocxLoader: Word文档格式支持</li>
            <li>• 📈 CSVLoader: 结构化数据处理</li>
            <li>• 🌐 CheerioWebBaseLoader: HTML内容解析</li>
            <li>• ✂️ 多种分割器适应不同文档结构</li>
            <li>• 🎯 根据文档类型选择最佳的加载器和分割器组合</li>
            <li>• ⚠️ 系统支持智能降级，确保在缺少依赖时仍能工作</li>
          </ul>
        </div>
      </div>
    </TestPageLayout>
  );
}
