'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle, AlertCircle, XCircle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface TreeNode {
  id: string;
  thought: string;
  step: number;
  parentId?: string;
  children: TreeNode[];
  evaluation: 'sure' | 'maybe' | 'impossible' | 'pending';
  confidence: number;
  reasoning: string;
  isLeaf: boolean;
  isSelected: boolean;
  depth: number;
  path: string[];
}

interface TreePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TreeVisualizationProps {
  tree: TreeNode;
  className?: string;
}

export default function TreeVisualization({
  tree,
  className = '',
}: TreeVisualizationProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [positions, setPositions] = useState<Map<string, TreePosition>>(
    new Map()
  );
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [svgDimensions, setSvgDimensions] = useState({
    width: 800,
    height: 600,
  });

  const nodeWidth = 200;
  const nodeHeight = 80;
  const levelHeight = 120;
  const nodeSpacing = 20;

  // 计算节点位置
  const calculatePositions = (
    node: TreeNode,
    depth = 0,
    parentX = 0
  ): Map<string, TreePosition> => {
    const positions = new Map<string, TreePosition>();

    // 计算当前层级所有节点的总宽度
    const calculateSubtreeWidth = (n: TreeNode): number => {
      if (n.children.length === 0) return nodeWidth;
      const childrenWidth = n.children.reduce(
        (sum, child) => sum + calculateSubtreeWidth(child),
        0
      );
      const spacingWidth = (n.children.length - 1) * nodeSpacing;
      return Math.max(nodeWidth, childrenWidth + spacingWidth);
    };

    const subtreeWidth = calculateSubtreeWidth(node);
    const y = depth * levelHeight + 40;

    if (depth === 0) {
      // 根节点居中
      const x = (svgDimensions.width - nodeWidth) / 2;
      positions.set(node.id, { x, y, width: nodeWidth, height: nodeHeight });

      // 递归计算子节点
      if (node.children.length > 0) {
        const totalChildrenWidth = node.children.reduce(
          (sum, child) => sum + calculateSubtreeWidth(child),
          0
        );
        const totalSpacing = (node.children.length - 1) * nodeSpacing;
        const startX =
          x + nodeWidth / 2 - (totalChildrenWidth + totalSpacing) / 2;

        let currentX = startX;
        node.children.forEach((child) => {
          const childSubtreeWidth = calculateSubtreeWidth(child);
          const childX = currentX + (childSubtreeWidth - nodeWidth) / 2;
          child.path = [...node.path, node.id];

          const childPositions = calculatePositions(child, depth + 1, childX);
          childPositions.forEach((pos, id) => positions.set(id, pos));

          currentX += childSubtreeWidth + nodeSpacing;
        });
      }
    } else {
      // 子节点根据父节点位置计算
      const x = parentX;
      positions.set(node.id, { x, y, width: nodeWidth, height: nodeHeight });

      if (node.children.length > 0) {
        const totalChildrenWidth = node.children.reduce(
          (sum, child) => sum + calculateSubtreeWidth(child),
          0
        );
        const totalSpacing = (node.children.length - 1) * nodeSpacing;
        const startX =
          x + nodeWidth / 2 - (totalChildrenWidth + totalSpacing) / 2;

        let currentX = startX;
        node.children.forEach((child) => {
          const childSubtreeWidth = calculateSubtreeWidth(child);
          const childX = currentX + (childSubtreeWidth - nodeWidth) / 2;
          child.path = [...node.path, node.id];

          const childPositions = calculatePositions(child, depth + 1, childX);
          childPositions.forEach((pos, id) => positions.set(id, pos));

          currentX += childSubtreeWidth + nodeSpacing;
        });
      }
    }

    return positions;
  };

  // 计算SVG尺寸
  const calculateSVGDimensions = (
    node: TreeNode
  ): { width: number; height: number } => {
    const getMaxDepth = (n: TreeNode, depth = 0): number => {
      if (n.children.length === 0) return depth;
      return Math.max(
        ...n.children.map((child) => getMaxDepth(child, depth + 1))
      );
    };

    const getMaxWidth = (n: TreeNode): number => {
      const calculateSubtreeWidth = (node: TreeNode): number => {
        if (node.children.length === 0) return nodeWidth;
        const childrenWidth = node.children.reduce(
          (sum, child) => sum + calculateSubtreeWidth(child),
          0
        );
        const spacingWidth = (node.children.length - 1) * nodeSpacing;
        return Math.max(nodeWidth, childrenWidth + spacingWidth);
      };
      return calculateSubtreeWidth(n);
    };

    const maxDepth = getMaxDepth(node);
    const maxWidth = getMaxWidth(node);

    return {
      width: Math.max(800, maxWidth + 100),
      height: Math.max(400, (maxDepth + 1) * levelHeight + 100),
    };
  };

  useEffect(() => {
    const dims = calculateSVGDimensions(tree);
    setSvgDimensions(dims);

    setTimeout(() => {
      const newPositions = calculatePositions(tree);
      setPositions(newPositions);
    }, 0);
  }, [tree]);

  const evaluationColors = {
    sure: { bg: '#dcfce7', border: '#16a34a', text: '#15803d' },
    maybe: { bg: '#fef3c7', border: '#d97706', text: '#b45309' },
    impossible: { bg: '#fecaca', border: '#dc2626', text: '#b91c1c' },
    pending: { bg: '#f3f4f6', border: '#6b7280', text: '#374151' },
  };

  const evaluationIcons = {
    sure: CheckCircle,
    maybe: AlertCircle,
    impossible: XCircle,
    pending: Clock,
  };

  // 渲染连接线
  const renderConnections = (node: TreeNode) => {
    const connections: JSX.Element[] = [];
    const nodePos = positions.get(node.id);

    if (nodePos && node.children.length > 0) {
      node.children.forEach((child) => {
        const childPos = positions.get(child.id);
        if (childPos) {
          const startX = nodePos.x + nodePos.width / 2;
          const startY = nodePos.y + nodePos.height;
          const endX = childPos.x + childPos.width / 2;
          const endY = childPos.y;

          // 绘制连接线
          connections.push(
            <path
              key={`connection-${node.id}-${child.id}`}
              d={`M ${startX} ${startY} Q ${startX} ${startY + 30} ${endX} ${endY}`}
              stroke="#94a3b8"
              strokeWidth="2"
              fill="none"
              className="transition-all duration-300"
            />
          );
        }

        // 递归渲染子节点的连接线
        connections.push(...renderConnections(child));
      });
    }

    return connections;
  };

  // 渲染节点
  const renderNodes = (node: TreeNode): JSX.Element[] => {
    const nodes: JSX.Element[] = [];
    const nodePos = positions.get(node.id);

    if (nodePos) {
      const colors = evaluationColors[node.evaluation];
      const Icon = evaluationIcons[node.evaluation];
      const isSelected = selectedNode === node.id;

      nodes.push(
        <g
          key={node.id}
          className="cursor-pointer"
          onClick={() => setSelectedNode(node.id)}
        >
          {/* 节点背景 */}
          <rect
            x={nodePos.x}
            y={nodePos.y}
            width={nodePos.width}
            height={nodePos.height}
            rx="8"
            fill={colors.bg}
            stroke={colors.border}
            strokeWidth={isSelected ? '3' : '2'}
            className="transition-all duration-300 hover:stroke-[3]"
          />

          {/* 评估图标 */}
          <circle
            cx={nodePos.x + 16}
            cy={nodePos.y + 16}
            r="8"
            fill={colors.border}
          />

          {/* 节点文本 */}
          <foreignObject
            x={nodePos.x + 32}
            y={nodePos.y + 8}
            width={nodePos.width - 40}
            height={nodePos.height - 16}
          >
            <div className="text-xs font-medium text-gray-800 leading-tight">
              <div className="truncate">{node.thought}</div>
              <div className="mt-1 flex gap-1">
                <span className="bg-white px-1 py-0.5 rounded text-[10px]">
                  深度 {node.depth}
                </span>
                <span className="bg-white px-1 py-0.5 rounded text-[10px]">
                  {(node.confidence * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </foreignObject>
        </g>
      );
    }

    // 递归渲染子节点
    node.children.forEach((child) => {
      nodes.push(...renderNodes(child));
    });

    return nodes;
  };

  return (
    <div className={`w-full ${className}`}>
      <div
        className="bg-white rounded-lg border overflow-auto"
        style={{ maxHeight: '500px' }}
      >
        <svg
          ref={svgRef}
          width={svgDimensions.width}
          height={svgDimensions.height}
          className="min-w-full"
        >
          {/* 渲染连接线 */}
          <g>{renderConnections(tree)}</g>

          {/* 渲染节点 */}
          <g>{renderNodes(tree)}</g>
        </svg>
      </div>

      {/* 选中节点的详细信息 */}
      {selectedNode && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <NodeDetails
            node={findNodeById(tree, selectedNode)}
            onClose={() => setSelectedNode(null)}
          />
        </div>
      )}
    </div>
  );
}

// 辅助函数：根据ID查找节点
function findNodeById(tree: TreeNode, id: string): TreeNode | null {
  if (tree.id === id) return tree;

  for (const child of tree.children) {
    const found = findNodeById(child, id);
    if (found) return found;
  }

  return null;
}

// 节点详细信息组件
function NodeDetails({
  node,
  onClose,
}: {
  node: TreeNode | null;
  onClose: () => void;
}) {
  if (!node) return null;

  const evaluationIcons = {
    sure: <CheckCircle className="h-4 w-4 text-green-500" />,
    maybe: <AlertCircle className="h-4 w-4 text-yellow-500" />,
    impossible: <XCircle className="h-4 w-4 text-red-500" />,
    pending: <Clock className="h-4 w-4 text-gray-400" />,
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-gray-900">节点详情</h4>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          ✕
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {evaluationIcons[node.evaluation]}
          <span className="font-medium">{node.thought}</span>
        </div>

        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-500">深度:</span>
            <span className="ml-1 font-medium">{node.depth}</span>
          </div>
          <div>
            <span className="text-gray-500">置信度:</span>
            <span className="ml-1 font-medium">
              {(node.confidence * 100).toFixed(0)}%
            </span>
          </div>
          <div>
            <span className="text-gray-500">评估:</span>
            <Badge
              variant={node.evaluation === 'sure' ? 'default' : 'secondary'}
              className="ml-1"
            >
              {node.evaluation === 'sure'
                ? '✓ 可行'
                : node.evaluation === 'maybe'
                  ? '? 可能'
                  : node.evaluation === 'impossible'
                    ? '✗ 不可行'
                    : '待定'}
            </Badge>
          </div>
        </div>

        {node.reasoning && (
          <div>
            <span className="text-gray-500 text-sm">推理过程:</span>
            <p className="text-sm italic text-gray-700 mt-1">
              {node.reasoning}
            </p>
          </div>
        )}

        {node.children.length > 0 && (
          <div>
            <span className="text-gray-500 text-sm">子节点数:</span>
            <span className="ml-1 font-medium">{node.children.length}</span>
          </div>
        )}
      </div>
    </div>
  );
}
