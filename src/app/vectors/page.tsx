'use client';

import { useState, useEffect } from 'react';
import TestPageLayout from '@/components/TestPageLayout';
import VectorVisualization from '@/components/VectorVisualization';

interface VectorItem {
  id: string;
  text: string;
  vector: number[];
  metadata?: Record<string, any>;
  similarity?: number;
}

interface VectorStats {
  totalVectors: number;
  dimensions: number;
  avgMagnitude: number;
}

export default function VectorsPage() {
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [vectors, setVectors] = useState<VectorItem[]>([]);
  const [searchResults, setSearchResults] = useState<VectorItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<VectorStats>({
    totalVectors: 0,
    dimensions: 0,
    avgMagnitude: 0,
  });
  const [selectedVector, setSelectedVector] = useState<VectorItem | null>(null);
  const [showVectorDetails, setShowVectorDetails] = useState(false);

  // 预设示例文本
  const exampleTexts = [
    '人工智能是计算机科学的一个分支',
    '机器学习使用算法来分析数据',
    '深度学习是机器学习的子集',
    '神经网络模拟人脑的工作方式',
    '自然语言处理帮助计算机理解人类语言',
    '计算机视觉让机器能够看到和理解图像',
    '今天天气很好，适合出门散步',
    '我喜欢吃水果，特别是苹果和香蕉',
    '音乐能够让人放松心情',
    '编程是一门有趣的技能',
  ];

  // 获取向量数据库状态
  const fetchVectorStats = async () => {
    try {
      const response = await fetch('/api/vectors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getStats' }),
      });
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
        setVectors(data.vectors || []);
      }
    } catch (error) {
      console.error('获取向量统计失败:', error);
    }
  };

  useEffect(() => {
    fetchVectorStats();
  }, []);

  // 向量化文本
  const handleVectorizeText = async () => {
    if (!inputText.trim()) return;

    setIsProcessing(true);
    setError('');

    try {
      const response = await fetch('/api/vectors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'vectorize',
          text: inputText.trim(),
        }),
      });

      const data = await response.json();
      if (data.success) {
        const newVector: VectorItem = {
          id: data.id,
          text: inputText.trim(),
          vector: data.vector,
          metadata: data.metadata,
        };
        setVectors((prev) => [...prev, newVector]);
        setInputText('');
        await fetchVectorStats();
      } else {
        setError(data.error || '向量化失败');
      }
    } catch (error) {
      setError('向量化处理时发生错误');
      console.error('向量化失败:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // 向量相似性搜索
  const handleVectorSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setError('');

    try {
      const response = await fetch('/api/vectors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'search',
          query: searchQuery.trim(),
          topK: 5,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setSearchResults(data.results || []);
      } else {
        setError(data.error || '搜索失败');
      }
    } catch (error) {
      setError('搜索时发生错误');
      console.error('搜索失败:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // 清空向量数据库
  const handleClearVectors = async () => {
    if (!confirm('确定要清空所有向量数据吗？此操作不可恢复。')) return;

    try {
      const response = await fetch('/api/vectors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear' }),
      });

      if (response.ok) {
        setVectors([]);
        setSearchResults([]);
        setStats({ totalVectors: 0, dimensions: 0, avgMagnitude: 0 });
      }
    } catch (error) {
      console.error('清空向量数据失败:', error);
    }
  };

  // 批量添加示例数据
  const handleAddExamples = async () => {
    setIsProcessing(true);
    for (const text of exampleTexts) {
      try {
        const response = await fetch('/api/vectors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'vectorize',
            text: text,
          }),
        });
        const data = await response.json();
        if (data.success) {
          const newVector: VectorItem = {
            id: data.id,
            text: text,
            vector: data.vector,
            metadata: data.metadata,
          };
          setVectors((prev) => [...prev, newVector]);
        }
      } catch (error) {
        console.error('添加示例失败:', error);
      }
    }
    await fetchVectorStats();
    setIsProcessing(false);
  };

  // 计算向量相似度
  const calculateSimilarity = (vec1: number[], vec2: number[]): number => {
    if (vec1.length !== vec2.length) return 0;

    const dotProduct = vec1.reduce((sum, a, i) => sum + a * vec2[i], 0);
    const mag1 = Math.sqrt(vec1.reduce((sum, a) => sum + a * a, 0));
    const mag2 = Math.sqrt(vec2.reduce((sum, a) => sum + a * a, 0));

    return dotProduct / (mag1 * mag2);
  };

  return (
    <TestPageLayout
      title="向量数据库演示"
      description="文本向量化、相似性搜索和向量数据管理"
    >
      <div className="p-6 space-y-6">
        {/* 向量数据库统计 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">
            📊 向量数据库状态
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {stats.totalVectors}
              </div>
              <div className="text-sm text-blue-700">总向量数</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {stats.dimensions}
              </div>
              <div className="text-sm text-blue-700">向量维度</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {stats.avgMagnitude.toFixed(3)}
              </div>
              <div className="text-sm text-blue-700">平均模长</div>
            </div>
          </div>

          <div className="flex space-x-2 mt-4">
            <button
              onClick={handleAddExamples}
              disabled={isProcessing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isProcessing ? '添加中...' : '添加示例数据'}
            </button>
            {vectors.length > 0 && (
              <button
                onClick={handleClearVectors}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                清空数据库
              </button>
            )}
            <button
              onClick={() => setShowVectorDetails(!showVectorDetails)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              {showVectorDetails ? '隐藏' : '显示'}向量详情
            </button>
          </div>
        </div>

        {/* 文本向量化 */}
        <div className="border-b pb-6">
          <h3 className="text-lg font-semibold mb-4">🔮 文本向量化</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                输入文本：
              </label>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="输入要向量化的文本..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
            </div>

            <button
              onClick={handleVectorizeText}
              disabled={!inputText.trim() || isProcessing}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? '处理中...' : '生成向量'}
            </button>
          </div>
        </div>

        {/* 向量相似性搜索 */}
        <div className="border-b pb-6">
          <h3 className="text-lg font-semibold mb-4">🔍 向量相似性搜索</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                搜索查询：
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="输入搜索查询..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={handleVectorSearch}
              disabled={
                !searchQuery.trim() || isSearching || vectors.length === 0
              }
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSearching ? '搜索中...' : '向量搜索'}
            </button>

            {searchResults.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-medium text-green-900 mb-3">
                  搜索结果 (按相似度排序)
                </h4>
                <div className="space-y-2">
                  {searchResults.map((result, index) => (
                    <div
                      key={result.id}
                      className="bg-white border border-green-300 rounded p-3 cursor-pointer hover:bg-green-50"
                      onClick={() => setSelectedVector(result)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-green-700">
                          #{index + 1}
                        </span>
                        <span className="text-sm font-bold text-green-600">
                          相似度: {(result.similarity || 0).toFixed(4)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{result.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 向量可视化 */}
        {vectors.length > 0 && (
          <VectorVisualization
            vectors={searchResults.length > 0 ? searchResults : vectors}
            selectedVector={selectedVector?.id || null}
            onVectorClick={(id) => {
              const vector =
                vectors.find((v) => v.id === id) ||
                searchResults.find((v) => v.id === id);
              setSelectedVector(vector || null);
            }}
          />
        )}

        {/* 向量详情显示 */}
        {showVectorDetails && vectors.length > 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3">
              📋 存储的向量列表
            </h4>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {vectors.map((vector, index) => (
                <div
                  key={vector.id}
                  className="bg-white border border-gray-300 rounded p-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => setSelectedVector(vector)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">
                      向量 #{index + 1}
                    </span>
                    <span className="text-xs text-gray-500">
                      ID: {vector.id.substring(0, 8)}...
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 truncate">
                    {vector.text}
                  </p>
                  <div className="text-xs text-gray-400 mt-1">
                    维度: {vector.vector.length} | 模长:{' '}
                    {Math.sqrt(
                      vector.vector.reduce((sum, v) => sum + v * v, 0)
                    ).toFixed(3)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 选中向量详情弹窗 */}
        {selectedVector && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">向量详情</h3>
                <button
                  onClick={() => setSelectedVector(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    文本内容
                  </label>
                  <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded">
                    {selectedVector.text}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    向量ID
                  </label>
                  <p className="text-sm text-gray-600 font-mono">
                    {selectedVector.id}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    向量维度
                  </label>
                  <p className="text-sm text-gray-600">
                    {selectedVector.vector.length}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    向量模长
                  </label>
                  <p className="text-sm text-gray-600">
                    {Math.sqrt(
                      selectedVector.vector.reduce((sum, v) => sum + v * v, 0)
                    ).toFixed(6)}
                  </p>
                </div>

                {selectedVector.similarity !== undefined && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      相似度分数
                    </label>
                    <p className="text-sm text-green-600 font-bold">
                      {selectedVector.similarity.toFixed(6)}
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    向量数据 (前10维)
                  </label>
                  <div className="text-xs text-gray-600 font-mono bg-gray-50 p-3 rounded max-h-32 overflow-y-auto">
                    [
                    {selectedVector.vector
                      .slice(0, 10)
                      .map((v) => v.toFixed(6))
                      .join(', ')}
                    {selectedVector.vector.length > 10 ? ', ...' : ''}]
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-sm">
            {error}
          </div>
        )}

        {/* 使用说明 */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="font-medium text-yellow-900 mb-2">💡 使用说明</h4>
          <ul className="text-sm text-yellow-800 space-y-1">
            <li>• 点击"添加示例数据"快速体验向量数据库功能</li>
            <li>• 输入文本生成向量，观察文本如何转换为数值向量</li>
            <li>• 使用相似性搜索找到语义相近的文本</li>
            <li>• 点击向量项目查看详细的向量数据</li>
            <li>• 观察不同文本之间的相似度分数变化</li>
          </ul>
        </div>
      </div>
    </TestPageLayout>
  );
}
