'use client';

import { useState, useRef } from 'react';
import TestPageLayout from '@/components/TestPageLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Play,
  Brain,
  Target,
  TrendingUp,
  Eye,
  CheckCircle,
  AlertCircle,
  Lightbulb,
  RotateCcw,
} from 'lucide-react';

interface ReflexionRequest {
  task: string;
  taskType: 'decision' | 'reasoning' | 'programming' | 'general';
  maxTrials: number;
  evaluationCriteria: string[];
  memoryWindow: number;
  temperature?: number;
  modelName?: string;
  stream?: boolean;
}

interface Action {
  type: string;
  content: string;
  reasoning: string;
  timestamp: number;
}

interface Trajectory {
  trialNumber: number;
  actions: Action[];
  observations: string[];
  finalOutput: string;
  startTime: number;
  endTime: number;
}

interface Evaluation {
  trialNumber: number;
  rewardScore: number;
  maxScore: number;
  criteria: {
    criterion: string;
    score: number;
    feedback: string;
  }[];
  overallFeedback: string;
  success: boolean;
}

interface Reflection {
  trialNumber: number;
  previousTrajectory: Trajectory;
  evaluation: Evaluation;
  insights: string[];
  improvements: string[];
  actionPlan: string;
  learningPoints: string[];
}

interface Memory {
  shortTerm: Trajectory[];
  longTerm: Reflection[];
  bestTrajectory?: Trajectory;
  bestScore: number;
}

interface ReflexionResponse {
  task: string;
  taskType: string;
  trials: {
    trajectory: Trajectory;
    evaluation: Evaluation;
    reflection?: Reflection;
  }[];
  memory: Memory;
  finalResult: string;
  improvedOverTime: boolean;
  totalTime: number;
  learningCurve: number[];
}

export default function ReflexionPage() {
  const [request, setRequest] = useState<ReflexionRequest>({
    task: '在厨房环境中找到苹果并放到餐桌上',
    taskType: 'decision',
    maxTrials: 3,
    evaluationCriteria: ['目标完成度', '效率', '路径优化'],
    memoryWindow: 5,
    temperature: 0.7,
    modelName: 'gpt-3.5-turbo',
    stream: true,
  });

  const [response, setResponse] = useState<ReflexionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState('');
  const [currentTrial, setCurrentTrial] = useState(0);
  const [trials, setTrials] = useState<any[]>([]);
  const [learningCurve, setLearningCurve] = useState<number[]>([]);

  const abortControllerRef = useRef<AbortController | null>(null);

  const taskTypes = {
    decision: {
      name: '序列决策',
      description: '多步骤环境导航和目标完成',
      color: 'bg-blue-100 text-blue-800',
      icon: Target,
      examples: [
        '在厨房环境中找到苹果并放到餐桌上',
        '在办公室环境中找到文件并打印出来',
        '在图书馆中找到特定书籍并借阅',
      ],
      criteria: ['目标完成度', '效率', '路径优化', '安全性'],
    },
    reasoning: {
      name: '推理任务',
      description: '多文档推理和问答',
      color: 'bg-green-100 text-green-800',
      icon: Brain,
      examples: [
        '基于多个文档回答复杂问题',
        '进行多步骤逻辑推理',
        '分析因果关系并得出结论',
      ],
      criteria: ['答案准确性', '推理逻辑', '证据支持', '完整性'],
    },
    programming: {
      name: '编程任务',
      description: '代码生成和问题解决',
      color: 'bg-purple-100 text-purple-800',
      icon: CheckCircle,
      examples: ['实现排序算法', '解决数据结构问题', '编写API接口函数'],
      criteria: ['代码正确性', '效率', '可读性', '健壮性'],
    },
    general: {
      name: '通用任务',
      description: '各种类型的综合问题',
      color: 'bg-orange-100 text-orange-800',
      icon: TrendingUp,
      examples: ['制定学习计划', '分析商业策略', '设计解决方案'],
      criteria: ['任务完成度', '创新性', '实用性', '可行性'],
    },
  };

  const handleSubmit = async () => {
    if (request.task.trim().length === 0) {
      return;
    }

    setIsLoading(true);
    setResponse(null);
    setCurrentStep('');
    setCurrentTrial(0);
    setTrials([]);
    setLearningCurve([]);

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/reflexion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error('请求失败');
      }

      if (request.stream && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                switch (data.type) {
                  case 'start':
                    setCurrentStep(`开始Reflexion学习 - ${data.taskType} 任务`);
                    break;
                  case 'trial_start':
                    setCurrentTrial(data.trial);
                    setCurrentStep(`第 ${data.trial} 次尝试开始`);
                    break;
                  case 'trajectory_generated':
                    setCurrentStep(`第 ${data.trial} 次尝试 - 轨迹生成完成`);
                    break;
                  case 'evaluation_complete':
                    setCurrentStep(
                      `第 ${data.trial} 次尝试 - 评估完成 (得分: ${data.evaluation.rewardScore})`
                    );
                    setLearningCurve((prev) => [
                      ...prev,
                      data.evaluation.rewardScore,
                    ]);
                    break;
                  case 'reflection_generated':
                    setCurrentStep(`第 ${data.trial} 次尝试 - 反思完成`);
                    break;
                  case 'task_success':
                    setCurrentStep(
                      `✅ 任务在第 ${data.trial} 次尝试中成功完成！`
                    );
                    break;
                  case 'final_result':
                    setResponse(data.result);
                    setTrials(data.result.trials);
                    setCurrentStep('Reflexion学习完成！');
                    break;
                  case 'done':
                    setIsLoading(false);
                    break;
                  case 'error':
                    throw new Error(data.error || '处理过程发生错误');
                }
              } catch (e) {
                console.error('Error parsing SSE data:', e);
              }
            }
          }
        }
      } else {
        const data = await response.json();
        setResponse(data);
        setTrials(data.trials);
        setLearningCurve(data.learningCurve);
        setIsLoading(false);
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Reflexion Error:', error);
        setCurrentStep(`错误: ${error.message}`);
      }
      setIsLoading(false);
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
      setCurrentStep('已停止Reflexion学习');
    }
  };

  const addCriterion = () => {
    if (request.evaluationCriteria.length < 6) {
      setRequest((prev) => ({
        ...prev,
        evaluationCriteria: [...prev.evaluationCriteria, ''],
      }));
    }
  };

  const removeCriterion = (index: number) => {
    if (request.evaluationCriteria.length > 1) {
      setRequest((prev) => ({
        ...prev,
        evaluationCriteria: prev.evaluationCriteria.filter(
          (_, i) => i !== index
        ),
      }));
    }
  };

  const updateCriterion = (index: number, value: string) => {
    setRequest((prev) => ({
      ...prev,
      evaluationCriteria: prev.evaluationCriteria.map((item, i) =>
        i === index ? value : item
      ),
    }));
  };

  const setExampleTask = (example: string) => {
    setRequest((prev) => ({ ...prev, task: example }));
  };

  const usePresetCriteria = () => {
    setRequest((prev) => ({
      ...prev,
      evaluationCriteria: [...taskTypes[prev.taskType].criteria],
    }));
  };

  return (
    <TestPageLayout
      title="Reflexion 自我反思框架"
      description="通过语言反馈来强化基于语言的智能体，从错误中学习并持续改进"
    >
      <div className="space-y-6 p-6">
        <Tabs defaultValue="theory" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="theory">原理介绍</TabsTrigger>
            <TabsTrigger value="test">实践测试</TabsTrigger>
          </TabsList>

          <TabsContent value="theory" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RotateCcw className="h-5 w-5" />
                  Reflexion 工作原理
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-gray-600">
                  <p className="mb-4">
                    <strong>Reflexion（自我反思）</strong>
                    是Shinn等人（2023）提出的通过语言反馈来强化基于语言智能体的框架。它将来自环境的反馈转换为语言反馈，为下一轮LLM智能体提供上下文，帮助智能体从错误中学习。
                  </p>

                  <div className="space-y-3">
                    <div className="border-l-4 border-blue-500 pl-4">
                      <h4 className="font-semibold text-blue-700">
                        1. 参与者 (Actor)
                      </h4>
                      <p>
                        根据状态观测量生成文本和动作，使用CoT和ReAct作为基础模型，配备记忆组件提供上下文信息。
                      </p>
                    </div>

                    <div className="border-l-4 border-green-500 pl-4">
                      <h4 className="font-semibold text-green-700">
                        2. 评估者 (Evaluator)
                      </h4>
                      <p>
                        对参与者的输出进行评价，将生成的轨迹作为输入并输出奖励分数，使用多维度评估标准。
                      </p>
                    </div>

                    <div className="border-l-4 border-purple-500 pl-4">
                      <h4 className="font-semibold text-purple-700">
                        3. 自我反思 (Self-Reflection)
                      </h4>
                      <p>
                        生成语言强化线索来帮助参与者实现自我完善，提供具体的改进建议和行动计划。
                      </p>
                    </div>

                    <div className="border-l-4 border-orange-500 pl-4">
                      <h4 className="font-semibold text-orange-700">
                        4. 记忆系统 (Memory)
                      </h4>
                      <p>
                        存储短期轨迹和长期反思，为智能体提供历史经验和学习指导。
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-semibold text-blue-800 mb-2">
                      学习循环
                    </h4>
                    <div className="text-blue-700 space-y-2">
                      <p>
                        <strong>步骤1</strong>：定义任务和评估标准
                      </p>
                      <p>
                        <strong>步骤2</strong>：生成行动轨迹（Actor）
                      </p>
                      <p>
                        <strong>步骤3</strong>：评估轨迹表现（Evaluator）
                      </p>
                      <p>
                        <strong>步骤4</strong>：执行自我反思（Self-Reflection）
                      </p>
                      <p>
                        <strong>步骤5</strong>：基于反思生成改进的轨迹
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h4 className="font-semibold text-green-800 mb-2">
                      核心优势
                    </h4>
                    <ul className="text-green-700 space-y-1">
                      <li>
                        • <strong>快速学习</strong>
                        ：无需模型微调，通过语言反馈快速改进
                      </li>
                      <li>
                        • <strong>细致反馈</strong>
                        ：语言反馈比标量奖励更具体和可操作
                      </li>
                      <li>
                        • <strong>可解释性</strong>
                        ：反思过程完全透明，易于理解和分析
                      </li>
                      <li>
                        • <strong>轻量级</strong>
                        ：相比传统强化学习更高效、更节省计算资源
                      </li>
                    </ul>
                  </div>

                  <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                    <h4 className="font-semibold text-purple-800 mb-2">
                      适用场景
                    </h4>
                    <ul className="text-purple-700 space-y-1">
                      <li>
                        • <strong>序列决策</strong>
                        ：环境导航、多步骤目标完成（AlfWorld）
                      </li>
                      <li>
                        • <strong>推理任务</strong>
                        ：多文档推理、复杂问答（HotPotQA）
                      </li>
                      <li>
                        • <strong>编程任务</strong>
                        ：代码生成、问题解决（HumanEval、MBPP）
                      </li>
                      <li>
                        • <strong>需要从错误中学习的任务</strong>
                        ：试错学习、迭代改进
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="test" className="space-y-6">
            {/* 任务配置 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  任务配置
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="task">任务描述</Label>
                  <Textarea
                    id="task"
                    placeholder="描述需要智能体完成的任务..."
                    value={request.task}
                    onChange={(e) =>
                      setRequest((prev) => ({ ...prev, task: e.target.value }))
                    }
                    className="min-h-[80px]"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="taskType">任务类型</Label>
                    <Select
                      value={request.taskType}
                      onValueChange={(value: ReflexionRequest['taskType']) =>
                        setRequest((prev) => ({ ...prev, taskType: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(taskTypes).map(([key, type]) => {
                          const IconComponent = type.icon;
                          return (
                            <SelectItem key={key} value={key}>
                              <div className="flex items-center gap-2">
                                <IconComponent className="h-4 w-4" />
                                <Badge className={type.color}>
                                  {type.name}
                                </Badge>
                                <span className="text-sm text-gray-600">
                                  {type.description}
                                </span>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxTrials">最大尝试次数</Label>
                    <Input
                      id="maxTrials"
                      type="number"
                      min="1"
                      max="10"
                      value={request.maxTrials}
                      onChange={(e) =>
                        setRequest((prev) => ({
                          ...prev,
                          maxTrials: parseInt(e.target.value) || 3,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="memoryWindow">记忆窗口大小</Label>
                    <Input
                      id="memoryWindow"
                      type="number"
                      min="1"
                      max="20"
                      value={request.memoryWindow}
                      onChange={(e) =>
                        setRequest((prev) => ({
                          ...prev,
                          memoryWindow: parseInt(e.target.value) || 5,
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="temperature">创造性</Label>
                    <Input
                      id="temperature"
                      type="number"
                      min="0"
                      max="1"
                      step="0.1"
                      value={request.temperature}
                      onChange={(e) =>
                        setRequest((prev) => ({
                          ...prev,
                          temperature: parseFloat(e.target.value) || 0.7,
                        }))
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 评估标准 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Eye className="h-5 w-5" />
                    评估标准
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={usePresetCriteria}
                  >
                    使用预设标准
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {request.evaluationCriteria.map((criterion, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      placeholder={`评估标准 ${index + 1}`}
                      value={criterion}
                      onChange={(e) => updateCriterion(index, e.target.value)}
                      className="flex-1"
                    />
                    {request.evaluationCriteria.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeCriterion(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        删除
                      </Button>
                    )}
                  </div>
                ))}

                {request.evaluationCriteria.length < 6 && (
                  <Button variant="outline" size="sm" onClick={addCriterion}>
                    添加标准
                  </Button>
                )}

                <div className="text-sm text-gray-600">
                  <strong>推荐标准：</strong>{' '}
                  {taskTypes[request.taskType].criteria.join(', ')}
                </div>
              </CardContent>
            </Card>

            {/* 示例任务 */}
            <Card>
              <CardHeader>
                <CardTitle>示例任务</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {taskTypes[request.taskType].examples.map(
                    (example, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                        onClick={() => setExampleTask(example)}
                      >
                        <Badge variant="outline">{index + 1}</Badge>
                        <span className="flex-1 text-sm">{example}</span>
                        <Button variant="ghost" size="sm">
                          使用
                        </Button>
                      </div>
                    )
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 执行控制 */}
            <Card>
              <CardHeader>
                <CardTitle>开始Reflexion学习</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <Button
                    onClick={handleSubmit}
                    disabled={isLoading || request.task.trim().length === 0}
                    className="flex-1"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    {isLoading ? '学习中...' : '开始学习'}
                  </Button>

                  {isLoading && (
                    <Button variant="outline" onClick={handleStop}>
                      停止
                    </Button>
                  )}
                </div>

                {/* 实时状态 */}
                {isLoading && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      <span className="text-blue-700 font-medium">
                        Reflexion状态
                      </span>
                    </div>

                    {currentStep && (
                      <p className="text-blue-600 mb-2">{currentStep}</p>
                    )}

                    <div className="bg-white rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${(currentTrial / request.maxTrials) * 100}%`,
                        }}
                      ></div>
                    </div>
                    <p className="text-sm text-blue-600 mt-1">
                      尝试 {currentTrial} / {request.maxTrials}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 学习曲线 */}
            {learningCurve.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    学习曲线
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>得分进度</span>
                      <span>最高分: {Math.max(...learningCurve)}</span>
                    </div>

                    <div className="flex items-end gap-2 h-32">
                      {learningCurve.map((score, index) => (
                        <div
                          key={index}
                          className="flex flex-col items-center flex-1"
                        >
                          <div
                            className="bg-blue-500 rounded-t transition-all duration-300 w-full min-h-[4px]"
                            style={{ height: `${(score / 100) * 100}%` }}
                          ></div>
                          <span className="text-xs text-gray-500 mt-1">
                            T{index + 1}
                          </span>
                          <span className="text-xs text-blue-600 font-medium">
                            {score}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 试验详情 */}
            {trials.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    学习过程详情
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {trials.map((trial, index) => (
                    <div
                      key={index}
                      className="border border-gray-200 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            尝试 {trial.trajectory.trialNumber}
                          </Badge>
                          <Badge
                            className={
                              trial.evaluation.success
                                ? 'bg-green-100 text-green-800'
                                : 'bg-orange-100 text-orange-800'
                            }
                          >
                            {trial.evaluation.success ? '成功' : '失败'} -{' '}
                            {trial.evaluation.rewardScore}/100
                          </Badge>
                        </div>
                        <span className="text-xs text-gray-500">
                          耗时:{' '}
                          {trial.trajectory.endTime -
                            trial.trajectory.startTime}
                          ms
                        </span>
                      </div>

                      <Tabs defaultValue="trajectory" className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                          <TabsTrigger value="trajectory">轨迹</TabsTrigger>
                          <TabsTrigger value="evaluation">评估</TabsTrigger>
                          {trial.reflection && (
                            <TabsTrigger value="reflection">反思</TabsTrigger>
                          )}
                        </TabsList>

                        <TabsContent value="trajectory" className="space-y-3">
                          <div>
                            <Label className="text-sm font-medium text-gray-700">
                              动作序列
                            </Label>
                            <div className="space-y-2 mt-1">
                              {trial.trajectory.actions.map(
                                (action: Action, actionIndex: number) => (
                                  <div
                                    key={actionIndex}
                                    className="bg-gray-50 p-2 rounded"
                                  >
                                    <div className="text-sm font-medium">
                                      动作 {actionIndex + 1}: {action.content}
                                    </div>
                                    <div className="text-xs text-gray-600 mt-1">
                                      推理: {action.reasoning}
                                    </div>
                                  </div>
                                )
                              )}
                            </div>
                          </div>

                          <div>
                            <Label className="text-sm font-medium text-gray-700">
                              最终输出
                            </Label>
                            <p className="text-sm text-gray-700 mt-1 p-2 bg-blue-50 rounded">
                              {trial.trajectory.finalOutput}
                            </p>
                          </div>
                        </TabsContent>

                        <TabsContent value="evaluation" className="space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {trial.evaluation.criteria.map(
                              (criterion: any, critIndex: number) => (
                                <div
                                  key={critIndex}
                                  className="border rounded p-3"
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-medium">
                                      {criterion.criterion}
                                    </span>
                                    <Badge variant="outline">
                                      {criterion.score}/10
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-gray-600">
                                    {criterion.feedback}
                                  </p>
                                </div>
                              )
                            )}
                          </div>

                          <div>
                            <Label className="text-sm font-medium text-gray-700">
                              整体反馈
                            </Label>
                            <p className="text-sm text-gray-700 mt-1 p-2 bg-yellow-50 rounded">
                              {trial.evaluation.overallFeedback}
                            </p>
                          </div>
                        </TabsContent>

                        {trial.reflection && (
                          <TabsContent value="reflection" className="space-y-3">
                            <div>
                              <Label className="text-sm font-medium text-gray-700">
                                <Lightbulb className="h-4 w-4 inline mr-1" />
                                关键洞察
                              </Label>
                              <ul className="text-sm text-gray-700 mt-1 space-y-1">
                                {trial.reflection.insights.map(
                                  (insight: string, insightIndex: number) => (
                                    <li
                                      key={insightIndex}
                                      className="flex items-start gap-2"
                                    >
                                      <span className="text-blue-500">•</span>
                                      <span>{insight}</span>
                                    </li>
                                  )
                                )}
                              </ul>
                            </div>

                            <div>
                              <Label className="text-sm font-medium text-gray-700">
                                改进建议
                              </Label>
                              <ul className="text-sm text-gray-700 mt-1 space-y-1">
                                {trial.reflection.improvements.map(
                                  (improvement: string, impIndex: number) => (
                                    <li
                                      key={impIndex}
                                      className="flex items-start gap-2"
                                    >
                                      <span className="text-green-500">•</span>
                                      <span>{improvement}</span>
                                    </li>
                                  )
                                )}
                              </ul>
                            </div>

                            <div>
                              <Label className="text-sm font-medium text-gray-700">
                                行动计划
                              </Label>
                              <p className="text-sm text-gray-700 mt-1 p-2 bg-green-50 rounded">
                                {trial.reflection.actionPlan}
                              </p>
                            </div>
                          </TabsContent>
                        )}
                      </Tabs>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* 最终结果 */}
            {response && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    学习结果总结
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {response.trials.length}
                      </div>
                      <div className="text-sm text-blue-700">尝试次数</div>
                    </div>

                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {Math.max(...response.learningCurve)}
                      </div>
                      <div className="text-sm text-green-700">最高得分</div>
                    </div>

                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">
                        {response.memory.longTerm.length}
                      </div>
                      <div className="text-sm text-purple-700">反思次数</div>
                    </div>

                    <div className="text-center p-3 bg-orange-50 rounded-lg">
                      <div className="text-2xl font-bold text-orange-600">
                        {response.improvedOverTime ? '✅' : '❌'}
                      </div>
                      <div className="text-sm text-orange-700">是否改进</div>
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium text-gray-800 mb-2">最终结果</h4>
                    <div className="text-sm text-gray-700 whitespace-pre-wrap">
                      {response.finalResult}
                    </div>
                  </div>

                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-700">
                      💡 <strong>Reflexion优势</strong>
                      ：通过自我反思和语言反馈，智能体能够快速从错误中学习，无需模型微调即可显著提升任务表现。
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </TestPageLayout>
  );
}
