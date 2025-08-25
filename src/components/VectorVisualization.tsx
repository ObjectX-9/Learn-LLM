import React from 'react';

interface VectorVisualizationProps {
  vectors: Array<{
    id: string;
    text: string;
    vector: number[];
    similarity?: number;
  }>;
  selectedVector?: string | null;
  onVectorClick?: (id: string) => void;
}

export default function VectorVisualization({
  vectors,
  selectedVector,
  onVectorClick,
}: VectorVisualizationProps) {
  // 将高维向量降维到2D用于可视化（简单的PCA近似）
  const projectTo2D = (vectors: number[][]) => {
    if (vectors.length === 0) return [];

    // 使用前两个维度作为简单的2D投影
    return vectors.map((vector) => ({
      x: vector[0] || 0,
      y: vector[1] || 0,
    }));
  };

  // 计算向量模长用于大小可视化
  const calculateMagnitude = (vector: number[]) => {
    return Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  };

  // 获取颜色基于相似度
  const getColorBySimilarity = (similarity?: number) => {
    if (similarity === undefined) return '#6B7280'; // 默认灰色

    const intensity = Math.max(0, Math.min(1, similarity));
    const red = Math.round(255 * (1 - intensity));
    const green = Math.round(255 * intensity);
    return `rgb(${red}, ${green}, 0)`;
  };

  const projectedVectors = projectTo2D(vectors.map((v) => v.vector));

  // 计算显示范围
  const xValues = projectedVectors.map((p) => p.x);
  const yValues = projectedVectors.map((p) => p.y);
  const minX = Math.min(...xValues, 0);
  const maxX = Math.max(...xValues, 0);
  const minY = Math.min(...yValues, 0);
  const maxY = Math.max(...yValues, 0);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  // SVG视图尺寸
  const svgWidth = 400;
  const svgHeight = 300;
  const padding = 30;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h4 className="font-medium text-gray-900 mb-3">📊 向量空间可视化</h4>

      {vectors.length === 0 ? (
        <div className="text-center text-gray-500 py-8">暂无向量数据</div>
      ) : (
        <div className="space-y-4">
          {/* 2D向量投影图 */}
          <div className="flex justify-center">
            <svg
              width={svgWidth}
              height={svgHeight}
              className="border border-gray-300 rounded"
            >
              {/* 坐标轴 */}
              <line
                x1={padding}
                y1={svgHeight - padding}
                x2={svgWidth - padding}
                y2={svgHeight - padding}
                stroke="#E5E7EB"
                strokeWidth="1"
              />
              <line
                x1={padding}
                y1={padding}
                x2={padding}
                y2={svgHeight - padding}
                stroke="#E5E7EB"
                strokeWidth="1"
              />

              {/* 原点 */}
              <circle
                cx={padding + (-minX / rangeX) * (svgWidth - 2 * padding)}
                cy={
                  svgHeight -
                  padding -
                  (-minY / rangeY) * (svgHeight - 2 * padding)
                }
                r="2"
                fill="#374151"
              />

              {/* 向量点 */}
              {projectedVectors.map((point, index) => {
                const vector = vectors[index];
                const magnitude = calculateMagnitude(vector.vector);
                const isSelected = selectedVector === vector.id;

                const x =
                  padding +
                  ((point.x - minX) / rangeX) * (svgWidth - 2 * padding);
                const y =
                  svgHeight -
                  padding -
                  ((point.y - minY) / rangeY) * (svgHeight - 2 * padding);

                return (
                  <g key={vector.id}>
                    {/* 向量线（从原点到点） */}
                    <line
                      x1={padding + (-minX / rangeX) * (svgWidth - 2 * padding)}
                      y1={
                        svgHeight -
                        padding -
                        (-minY / rangeY) * (svgHeight - 2 * padding)
                      }
                      x2={x}
                      y2={y}
                      stroke={getColorBySimilarity(vector.similarity)}
                      strokeWidth={isSelected ? '2' : '1'}
                      opacity="0.6"
                    />

                    {/* 向量点 */}
                    <circle
                      cx={x}
                      cy={y}
                      r={Math.max(3, Math.min(8, magnitude * 10))}
                      fill={getColorBySimilarity(vector.similarity)}
                      stroke={isSelected ? '#1F2937' : 'white'}
                      strokeWidth={isSelected ? '3' : '1'}
                      className="cursor-pointer hover:opacity-80"
                      onClick={() => onVectorClick?.(vector.id)}
                    />

                    {/* 文本标签（仅对选中的向量显示） */}
                    {isSelected && (
                      <text
                        x={x + 10}
                        y={y - 10}
                        fontSize="10"
                        fill="#374151"
                        className="pointer-events-none"
                      >
                        {vector.text.substring(0, 15)}...
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* 图例 */}
          <div className="text-xs text-gray-600 space-y-1">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span>低相似度</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <span>中等相似度</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span>高相似度</span>
              </div>
            </div>
            <p>• 点的大小表示向量模长，线条表示从原点到向量的方向</p>
            <p>• 颜色表示与搜索查询的相似度（搜索后显示）</p>
          </div>

          {/* 向量统计条形图 */}
          <div className="mt-4">
            <h5 className="text-sm font-medium text-gray-700 mb-2">
              向量模长分布
            </h5>
            <div className="space-y-1">
              {vectors.slice(0, 5).map((vector, index) => {
                const magnitude = calculateMagnitude(vector.vector);
                const maxMagnitude = Math.max(
                  ...vectors.map((v) => calculateMagnitude(v.vector))
                );
                const width = (magnitude / maxMagnitude) * 100;
                const isSelected = selectedVector === vector.id;

                return (
                  <div
                    key={vector.id}
                    className={`flex items-center space-x-2 p-1 rounded cursor-pointer hover:bg-gray-50 ${
                      isSelected ? 'bg-blue-50 border border-blue-200' : ''
                    }`}
                    onClick={() => onVectorClick?.(vector.id)}
                  >
                    <div className="w-20 text-xs text-gray-600 truncate">
                      {vector.text.substring(0, 15)}...
                    </div>
                    <div className="flex-1 h-4 bg-gray-200 rounded overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all duration-300"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    <div className="w-16 text-xs text-gray-500 text-right">
                      {magnitude.toFixed(3)}
                    </div>
                  </div>
                );
              })}
              {vectors.length > 5 && (
                <p className="text-xs text-gray-500 mt-1">显示前5个向量...</p>
              )}
            </div>
          </div>

          {/* 维度热图（显示前20个维度） */}
          {vectors.length > 0 && selectedVector && (
            <div className="mt-4">
              <h5 className="text-sm font-medium text-gray-700 mb-2">
                选中向量维度热图
              </h5>
              <div className="grid grid-cols-10 gap-1">
                {vectors
                  .find((v) => v.id === selectedVector)
                  ?.vector.slice(0, 20)
                  .map((value, index) => {
                    const intensity = Math.abs(value);
                    const maxIntensity = Math.max(
                      ...vectors
                        .find((v) => v.id === selectedVector)!
                        .vector.map(Math.abs)
                    );
                    const opacity = intensity / maxIntensity;

                    return (
                      <div
                        key={index}
                        className={`w-6 h-6 rounded text-xs flex items-center justify-center text-white font-mono ${
                          value >= 0 ? 'bg-blue-500' : 'bg-red-500'
                        }`}
                        style={{ opacity: Math.max(0.2, opacity) }}
                        title={`维度 ${index}: ${value.toFixed(4)}`}
                      >
                        {index}
                      </div>
                    );
                  })}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                蓝色=正值，红色=负值，透明度表示数值大小（显示前20维）
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
