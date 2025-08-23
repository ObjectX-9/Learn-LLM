'use client';

import { useState, useRef } from 'react';
import TestPageLayout from '@/components/TestPageLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Brain,
  GitBranch,
  Clock,
  BookOpen,
  Target,
  Lightbulb,
  CheckCircle,
  Loader2,
  TreePine,
  Search,
  BarChart3,
  Play,
  Eye,
  Settings,
  ArrowDown,
  ArrowRight,
  Star,
  AlertCircle,
  XCircle,
  Activity,
  Network,
  Layers,
  Zap,
  Maximize2,
} from 'lucide-react';
import TreeVisualization from '@/components/TreeVisualization';

interface ThoughtNode {
  id: string;
  thought: string;
  step: number;
  parentId?: string;
  children: ThoughtNode[];
  evaluation: 'sure' | 'maybe' | 'impossible' | 'pending';
  confidence: number;
  reasoning: string;
  isLeaf: boolean;
  isSelected: boolean;
  depth: number;
  path: string[];
}

interface ToTRequest {
  problem: string;
  taskType:
    | 'game-24'
    | 'creative-writing'
    | 'mathematical-reasoning'
    | 'logical-puzzle'
    | 'custom';
  searchMethod: 'bfs' | 'dfs' | 'beam';
  maxDepth: number;
  candidatesPerStep: number;
  maxNodes: number;
  temperature?: number;
  modelName?: string;
  stream?: boolean;
}

interface SearchStep {
  stepIndex: number;
  action: 'generate' | 'evaluate' | 'select' | 'backtrack' | 'complete';
  nodeId: string;
  thought?: string;
  evaluation?: string;
  reasoning?: string;
  candidatesGenerated?: number;
  selectedNodes?: string[];
  message: string;
  timestamp: number;
}

interface StreamMessage {
  type: string;
  message?: string;
  taskType?: string;
  searchMethod?: string;
  maxDepth?: number;
  candidatesPerStep?: number;
  nodeId?: string;
  thought?: string;
  step?: number;
  evaluation?: string;
  confidence?: number;
  result?: any;
  error?: string;
}

export default function TreeOfThoughtsPage() {
  // State hooks
  const [request, setRequest] = useState<ToTRequest>({
    problem: '',
    taskType: 'game-24',
    searchMethod: 'bfs',
    maxDepth: 3,
    candidatesPerStep: 3,
    maxNodes: 20,
    temperature: 0.8,
    modelName: 'gpt-3.5-turbo',
    stream: true,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [searchTree, setSearchTree] = useState<ThoughtNode | null>(null);
  const [currentMessage, setCurrentMessage] = useState('');
  const [searchSteps, setSearchSteps] = useState<SearchStep[]>([]);
  const [finalResult, setFinalResult] = useState<any>(null);
  const [startTime, setStartTime] = useState<number>(0);
  const [currentExploringNode, setCurrentExploringNode] = useState<string>('');

  // Ref hooks
  const abortControllerRef = useRef<AbortController | null>(null);

  // 任务类型定义
  const taskTypes = {
    'game-24': {
      name: '算24游戏',
      description: '使用四个数字和基本运算符得到24',
      icon: Target,
      example: '使用数字 4, 1, 8, 7 通过加减乘除运算得到 24',
    },
    'creative-writing': {
      name: '创意写作',
      description: '逐步构建引人入胜的故事',
      icon: BookOpen,
      example: '写一个关于时间旅行者的短故事',
    },
    'mathematical-reasoning': {
      name: '数学推理',
      description: '步骤化解决数学问题',
      icon: BarChart3,
      example: '证明：如果 n 是偶数，那么 n² 也是偶数',
    },
    'logical-puzzle': {
      name: '逻辑谜题',
      description: '运用逻辑推理解决谜题',
      icon: Brain,
      example:
        '有三个开关控制三盏灯，你只能上楼一次，如何确定哪个开关控制哪盏灯？',
    },
    custom: {
      name: '自定义任务',
      description: '用户自定义的问题类型',
      icon: Lightbulb,
      example: '请输入您要解决的问题...',
    },
  };

  // 搜索方法定义
  const searchMethods = {
    bfs: {
      name: '广度优先搜索',
      description: '逐层探索，保证找到最短路径',
      icon: Network,
    },
    dfs: {
      name: '深度优先搜索',
      description: '深入探索，快速到达解决方案',
      icon: ArrowDown,
    },
    beam: {
      name: '束搜索',
      description: '保留最优候选，平衡效率和质量',
      icon: Zap,
    },
  };

  // 更新请求参数
  const updateRequest = (updates: Partial<ToTRequest>) => {
    setRequest((prev) => ({ ...prev, ...updates }));
  };

  // 处理提交
  const handleSubmit = async () => {
    if (!request.problem.trim()) {
      alert('请输入问题');
      return;
    }

    setIsLoading(true);
    setCurrentMessage('准备构建思维树...');
    setSearchTree(null);
    setSearchSteps([]);
    setFinalResult(null);
    setStartTime(Date.now());
    setCurrentExploringNode('');

    // 创建取消控制器
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch('/api/tree-of-thoughts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // 处理流式响应
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data: StreamMessage = JSON.parse(line.slice(6));

                switch (data.type) {
                  case 'start':
                    setCurrentMessage(data.message || '');
                    break;

                  case 'explore_node':
                    setCurrentExploringNode(data.nodeId || '');
                    setCurrentMessage(data.message || '');
                    break;

                  case 'generate_candidate':
                    setCurrentMessage(`生成候选思维: ${data.evaluation}`);
                    break;

                  case 'final_result':
                    setFinalResult(data.result);
                    setSearchTree(data.result?.searchTree);
                    setSearchSteps(data.result?.searchSteps || []);
                    setCurrentMessage('思维树构建完成！');
                    setIsLoading(false);
                    break;

                  case 'done':
                    setIsLoading(false);
                    break;

                  case 'error':
                    throw new Error(data.error || '未知错误');
                }
              } catch (e) {
                console.warn('Failed to parse SSE data:', line);
              }
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('ToT Error:', error);
        setCurrentMessage(`错误: ${error.message}`);
      }
      setIsLoading(false);
    }
  };

  // 停止处理
  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  };

  // 清空内容
  const handleClear = () => {
    setRequest((prev) => ({ ...prev, problem: '' }));
    setSearchTree(null);
    setSearchSteps([]);
    setFinalResult(null);
    setCurrentMessage('');
    setCurrentExploringNode('');
  };

  // 填充示例
  const handleSelectExample = (taskType: string) => {
    const example = taskTypes[taskType as keyof typeof taskTypes].example;
    updateRequest({ taskType: taskType as any, problem: example });
  };

  const isValid = request.problem.trim().length > 0;
  const selectedTaskType = taskTypes[request.taskType];
  const selectedSearchMethod = searchMethods[request.searchMethod];

  return (
    <TestPageLayout
      title="思维树 (Tree of Thoughts)"
      description="通过树状搜索探索多种推理路径，系统性地解决复杂问题"
    >
      <div className="p-6">
        <Tabs defaultValue="test" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="theory">原理介绍</TabsTrigger>
            <TabsTrigger value="test">标准ToT</TabsTrigger>
            <TabsTrigger value="simple">简化ToT</TabsTrigger>
          </TabsList>

          {/* 原理介绍 */}
          <TabsContent value="theory" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TreePine className="h-5 w-5 text-green-600" />
                    什么是思维树？
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-gray-600">
                    思维树（Tree of
                    Thoughts）是一种高级提示技术，基于链式思考进行扩展。
                    它维护一棵思维树，其中每个节点代表一个中间推理步骤，
                    通过搜索算法系统性地探索解决方案空间。
                  </p>
                  <div className="space-y-2">
                    <h4 className="font-medium">核心特点：</h4>
                    <ul className="text-sm space-y-1 text-gray-600">
                      <li>• 生成多个候选思维路径</li>
                      <li>• 评估每个思维的可行性</li>
                      <li>• 使用搜索算法探索最优解</li>
                      <li>• 支持前向验证和回溯</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="h-5 w-5 text-blue-600" />
                    搜索算法
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className="mt-1">
                        BFS
                      </Badge>
                      <div>
                        <p className="font-medium text-sm">广度优先搜索</p>
                        <p className="text-xs text-gray-600">
                          逐层探索，保证最短路径
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className="mt-1">
                        DFS
                      </Badge>
                      <div>
                        <p className="font-medium text-sm">深度优先搜索</p>
                        <p className="text-xs text-gray-600">
                          深入探索，快速找到解决方案
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className="mt-1">
                        Beam
                      </Badge>
                      <div>
                        <p className="font-medium text-sm">束搜索</p>
                        <p className="text-xs text-gray-600">
                          保留最优候选，平衡效率质量
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-purple-600" />
                    评估机制
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <div>
                        <span className="font-medium text-green-700">Sure</span>
                        <span className="text-sm text-gray-600 ml-2">
                          一定能解决问题
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-yellow-500" />
                      <div>
                        <span className="font-medium text-yellow-700">
                          Maybe
                        </span>
                        <span className="text-sm text-gray-600 ml-2">
                          可能有用，值得探索
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-500" />
                      <div>
                        <span className="font-medium text-red-700">
                          Impossible
                        </span>
                        <span className="text-sm text-gray-600 ml-2">
                          不可行的方向
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-orange-600" />
                    应用场景
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-2 text-sm">
                    <div className="p-2 bg-blue-50 rounded text-blue-800">
                      数学推理问题
                    </div>
                    <div className="p-2 bg-green-50 rounded text-green-800">
                      算24游戏
                    </div>
                    <div className="p-2 bg-purple-50 rounded text-purple-800">
                      创意写作
                    </div>
                    <div className="p-2 bg-orange-50 rounded text-orange-800">
                      逻辑谜题
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 标准ToT */}
          <TabsContent value="test" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* 左侧：配置输入 */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      问题配置
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* 任务类型选择 */}
                    <div className="space-y-2">
                      <Label>任务类型</Label>
                      <Select
                        value={request.taskType}
                        onValueChange={(value) =>
                          updateRequest({
                            taskType: value as ToTRequest['taskType'],
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(taskTypes).map(([key, type]) => {
                            const Icon = type.icon;
                            return (
                              <SelectItem key={key} value={key}>
                                <div className="flex items-center gap-2">
                                  <Icon className="h-4 w-4" />
                                  {type.name}
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <div className="text-sm text-gray-600">
                        {selectedTaskType.description}
                      </div>
                    </div>

                    {/* 问题输入 */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label htmlFor="problem">问题描述</Label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSelectExample(request.taskType)}
                        >
                          使用示例
                        </Button>
                      </div>
                      <Textarea
                        id="problem"
                        placeholder="输入要解决的问题..."
                        value={request.problem}
                        onChange={(e) =>
                          updateRequest({ problem: e.target.value })
                        }
                        rows={4}
                        className="resize-none"
                      />
                    </div>

                    {/* 搜索方法 */}
                    <div className="space-y-2">
                      <Label>搜索算法</Label>
                      <Select
                        value={request.searchMethod}
                        onValueChange={(value) =>
                          updateRequest({
                            searchMethod: value as ToTRequest['searchMethod'],
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(searchMethods).map(
                            ([key, method]) => {
                              const Icon = method.icon;
                              return (
                                <SelectItem key={key} value={key}>
                                  <div className="flex items-center gap-2">
                                    <Icon className="h-4 w-4" />
                                    {method.name}
                                  </div>
                                </SelectItem>
                              );
                            }
                          )}
                        </SelectContent>
                      </Select>
                      <div className="text-sm text-gray-600">
                        {selectedSearchMethod.description}
                      </div>
                    </div>

                    {/* 参数配置 */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>最大深度</Label>
                        <Input
                          type="number"
                          min={1}
                          max={5}
                          value={request.maxDepth}
                          onChange={(e) =>
                            updateRequest({
                              maxDepth: parseInt(e.target.value) || 3,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>每步候选数</Label>
                        <Input
                          type="number"
                          min={1}
                          max={5}
                          value={request.candidatesPerStep}
                          onChange={(e) =>
                            updateRequest({
                              candidatesPerStep: parseInt(e.target.value) || 3,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>最大节点数</Label>
                        <Input
                          type="number"
                          min={5}
                          max={50}
                          value={request.maxNodes}
                          onChange={(e) =>
                            updateRequest({
                              maxNodes: parseInt(e.target.value) || 20,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>温度</Label>
                        <Input
                          type="number"
                          min={0}
                          max={1}
                          step={0.1}
                          value={request.temperature}
                          onChange={(e) =>
                            updateRequest({
                              temperature: parseFloat(e.target.value) || 0.8,
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button
                        onClick={handleSubmit}
                        disabled={!isValid || isLoading}
                        className="flex-1"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            构建中...
                          </>
                        ) : (
                          <>
                            <Play className="mr-2 h-4 w-4" />
                            开始构建
                          </>
                        )}
                      </Button>

                      {isLoading && (
                        <Button variant="outline" onClick={handleStop}>
                          停止
                        </Button>
                      )}

                      <Button variant="outline" onClick={handleClear}>
                        清空
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 右侧：结果展示 */}
              <div className="space-y-6">
                {/* 构建状态 */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="flex items-center gap-2">
                      <TreePine className="h-5 w-5" />
                      构建状态
                    </CardTitle>
                    {isLoading && (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Clock className="h-4 w-4" />
                        <span>
                          {Math.floor((Date.now() - startTime) / 1000)}s
                        </span>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {currentMessage && (
                        <div className="text-sm text-blue-600 p-2 bg-blue-50 rounded">
                          {currentMessage}
                        </div>
                      )}

                      {currentExploringNode && (
                        <div className="text-xs text-gray-500">
                          当前探索节点: {currentExploringNode}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* 思维树可视化 */}
                {searchTree && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <GitBranch className="h-5 w-5" />
                        思维树结构
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Tabs defaultValue="tree" className="space-y-4">
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="tree" className="text-xs">
                            文本树
                          </TabsTrigger>
                          <TabsTrigger value="graph" className="text-xs">
                            图形树
                          </TabsTrigger>
                        </TabsList>

                        <TabsContent value="tree">
                          <ThoughtTreeVisualization tree={searchTree} />
                        </TabsContent>

                        <TabsContent value="graph">
                          <TreeVisualization tree={searchTree} />
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                  </Card>
                )}

                {/* 最终结果 */}
                {finalResult && (
                  <Card className="border-green-200">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-green-700">
                        <CheckCircle className="h-5 w-5" />
                        搜索结果
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="p-3 bg-green-50 rounded-lg">
                        <h4 className="font-medium text-green-900 mb-2">
                          最终答案:
                        </h4>
                        <div className="text-green-800 text-sm whitespace-pre-wrap">
                          {finalResult.finalAnswer}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">搜索方法: </span>
                          <span>{selectedSearchMethod.name}</span>
                        </div>
                        <div>
                          <span className="font-medium">总节点数: </span>
                          <span>{finalResult.totalNodes}</span>
                        </div>
                        <div>
                          <span className="font-medium">探索节点: </span>
                          <span>{finalResult.exploredNodes}</span>
                        </div>
                        <div>
                          <span className="font-medium">总耗时: </span>
                          <span>{finalResult.totalTime}ms</span>
                        </div>
                      </div>

                      {finalResult.bestPath &&
                        finalResult.bestPath.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="font-medium">最佳路径:</h4>
                            <div className="space-y-1">
                              {finalResult.bestPath.map(
                                (node: ThoughtNode, index: number) => (
                                  <div
                                    key={node.id}
                                    className="flex items-center gap-2 text-sm"
                                  >
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      {index + 1}
                                    </Badge>
                                    <span className="truncate">
                                      {node.thought}
                                    </span>
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        )}
                    </CardContent>
                  </Card>
                )}

                {/* 空状态 */}
                {!isLoading && !searchTree && !finalResult && (
                  <Card>
                    <CardContent className="flex items-center justify-center h-40 text-gray-400">
                      <div className="text-center">
                        <TreePine className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>等待开始构建思维树...</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* 简化ToT */}
          <TabsContent value="simple" className="space-y-6">
            <SimpleToTInterface />
          </TabsContent>
        </Tabs>
      </div>
    </TestPageLayout>
  );
}

// 简化版ToT接口组件
function SimpleToTInterface() {
  const [request, setRequest] = useState({
    problem: '',
    numExperts: 3,
    maxSteps: 5,
    temperature: 0.8,
    modelName: 'gpt-3.5-turbo',
    stream: true,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState('');
  const [finalResult, setFinalResult] = useState<any>(null);
  const [startTime, setStartTime] = useState<number>(0);

  const abortControllerRef = useRef<AbortController | null>(null);

  const examples = {
    math: '使用数字 4, 1, 8, 7 通过加减乘除运算得到 24',
    logic: '有三个开关控制三盏灯，你只能上楼一次，如何确定哪个开关控制哪盏灯？',
    creative: '设计一个能够同时解决交通拥堵和环境污染问题的城市交通方案',
    reasoning:
      '如果明天下雨，小明就不去公园。如果小明不去公园，他就在家看书。现在小明在踢球，请问明天的天气如何？',
  };

  const updateRequest = (updates: any) => {
    setRequest((prev) => ({ ...prev, ...updates }));
  };

  const handleSubmit = async () => {
    if (!request.problem.trim()) {
      alert('请输入问题');
      return;
    }

    setIsLoading(true);
    setResponse('');
    setFinalResult(null);
    setStartTime(Date.now());

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch('/api/tree-of-thoughts-simple', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                switch (data.type) {
                  case 'start':
                    setResponse('开始思考...\n\n');
                    break;

                  case 'chunk':
                    setResponse((prev) => prev + data.content);
                    break;

                  case 'final_result':
                    setFinalResult(data.result);
                    setIsLoading(false);
                    break;

                  case 'done':
                    setIsLoading(false);
                    break;

                  case 'error':
                    throw new Error(data.error || '未知错误');
                }
              } catch (e) {
                console.warn('Failed to parse SSE data:', line);
              }
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Simple ToT Error:', error);
        setResponse(`错误: ${error.message}`);
      }
      setIsLoading(false);
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setRequest((prev) => ({ ...prev, problem: '' }));
    setResponse('');
    setFinalResult(null);
  };

  const isValid = request.problem.trim().length > 0;

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* 左侧：配置 */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              简化版思维树
            </CardTitle>
            <CardDescription>
              使用单个提示实现多专家协作推理，模拟思维树的核心概念
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="simple-problem">问题描述</Label>
              <Textarea
                id="simple-problem"
                placeholder="输入要解决的问题..."
                value={request.problem}
                onChange={(e) => updateRequest({ problem: e.target.value })}
                rows={4}
                className="resize-none"
              />
            </div>

            {/* 示例选择 */}
            <div className="space-y-2">
              <Label>选择示例问题</Label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(examples).map(([key, example]) => (
                  <Button
                    key={key}
                    variant="outline"
                    size="sm"
                    onClick={() => updateRequest({ problem: example })}
                    className="text-left justify-start h-auto p-2"
                  >
                    <div className="text-xs">{example.slice(0, 40)}...</div>
                  </Button>
                ))}
              </div>
            </div>

            {/* 参数配置 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>专家数量</Label>
                <Input
                  type="number"
                  min={2}
                  max={5}
                  value={request.numExperts}
                  onChange={(e) =>
                    updateRequest({ numExperts: parseInt(e.target.value) || 3 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>最大步数</Label>
                <Input
                  type="number"
                  min={3}
                  max={8}
                  value={request.maxSteps}
                  onChange={(e) =>
                    updateRequest({ maxSteps: parseInt(e.target.value) || 5 })
                  }
                />
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleSubmit}
                disabled={!isValid || isLoading}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    推理中...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    开始推理
                  </>
                )}
              </Button>

              {isLoading && (
                <Button variant="outline" onClick={handleStop}>
                  停止
                </Button>
              )}

              <Button variant="outline" onClick={handleClear}>
                清空
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 右侧：结果 */}
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              专家协作过程
            </CardTitle>
            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Clock className="h-4 w-4" />
                <span>{Math.floor((Date.now() - startTime) / 1000)}s</span>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {response ? (
              <div className="space-y-3">
                <div className="max-h-96 overflow-y-auto p-4 bg-gray-50 rounded-lg">
                  <pre className="text-sm whitespace-pre-wrap font-sans">
                    {response}
                  </pre>
                </div>

                {finalResult && (
                  <div className="text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>总耗时: {finalResult.totalTime}ms</span>
                      <span>专家数: {finalResult.numExperts}</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-40 text-gray-400">
                <div className="text-center">
                  <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>等待开始多专家协作推理...</p>
                  <p className="text-xs mt-1">模拟多位专家协作解决问题的过程</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// 思维树可视化组件
function ThoughtTreeVisualization({ tree }: { tree: ThoughtNode }) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(
    new Set([tree.id])
  );

  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const evaluationIcons = {
    sure: <CheckCircle className="h-4 w-4 text-green-500" />,
    maybe: <AlertCircle className="h-4 w-4 text-yellow-500" />,
    impossible: <XCircle className="h-4 w-4 text-red-500" />,
    pending: <Clock className="h-4 w-4 text-gray-400" />,
  };

  const evaluationColors = {
    sure: 'border-green-200 bg-green-50 text-green-900',
    maybe: 'border-yellow-200 bg-yellow-50 text-yellow-900',
    impossible: 'border-red-200 bg-red-50 text-red-900',
    pending: 'border-gray-200 bg-gray-50 text-gray-900',
  };

  const renderNode = (
    node: ThoughtNode,
    depth = 0,
    isLast = false,
    parentPrefix = ''
  ) => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);
    const isRoot = depth === 0;

    // 计算当前节点的前缀
    const currentPrefix = isRoot
      ? ''
      : parentPrefix + (isLast ? '└── ' : '├── ');
    const childPrefix = isRoot ? '' : parentPrefix + (isLast ? '    ' : '│   ');

    return (
      <div key={node.id} className="font-mono text-sm">
        {/* 节点本身 */}
        <div className="flex items-start gap-2 group hover:bg-blue-50 rounded p-1 transition-colors">
          {/* 树形连接线和展开/折叠按钮 */}
          <div className="flex items-center text-gray-400 select-none">
            <span className="whitespace-pre">{currentPrefix}</span>
            {hasChildren && (
              <button
                onClick={() => toggleNode(node.id)}
                className="w-4 h-4 flex items-center justify-center rounded hover:bg-gray-200 ml-1"
                title={isExpanded ? '折叠' : '展开'}
              >
                {isExpanded ? '−' : '+'}
              </button>
            )}
          </div>

          {/* 节点内容 */}
          <div
            className={`flex-1 p-2 rounded border ${evaluationColors[node.evaluation]} min-w-0`}
          >
            <div className="flex items-start gap-2">
              {evaluationIcons[node.evaluation]}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm break-words">
                  {node.thought}
                </div>

                {/* 节点详细信息 */}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge variant="outline" className="text-xs">
                    深度 {node.depth}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    置信度 {(node.confidence * 100).toFixed(0)}%
                  </Badge>
                  {node.evaluation !== 'pending' && (
                    <Badge
                      variant={
                        node.evaluation === 'sure' ? 'default' : 'secondary'
                      }
                      className="text-xs"
                    >
                      {node.evaluation === 'sure'
                        ? '✓ 可行'
                        : node.evaluation === 'maybe'
                          ? '? 可能'
                          : '✗ 不可行'}
                    </Badge>
                  )}
                </div>

                {/* 推理过程 */}
                {node.reasoning && (
                  <div className="text-xs opacity-75 mt-2 italic">
                    {node.reasoning}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 子节点 */}
        {hasChildren && isExpanded && (
          <div className="ml-0">
            {node.children.map((child, index) =>
              renderNode(
                child,
                depth + 1,
                index === node.children.length - 1,
                childPrefix
              )
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-h-96 overflow-auto bg-white rounded border">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-4 text-sm text-gray-600">
          <TreePine className="h-4 w-4" />
          <span>思维树结构 (点击 + 展开节点)</span>
        </div>
        {renderNode(tree)}
      </div>
    </div>
  );
}
