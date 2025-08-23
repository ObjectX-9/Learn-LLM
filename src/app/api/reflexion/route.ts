import { NextRequest, NextResponse } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

export interface ReflexionRequest {
  task: string;
  taskType: 'decision' | 'reasoning' | 'programming' | 'general';
  maxTrials: number;
  evaluationCriteria: string[];
  memoryWindow: number;
  temperature?: number;
  modelName?: string;
  stream?: boolean;
}

export interface Action {
  type: string;
  content: string;
  reasoning: string;
  timestamp: number;
}

export interface Trajectory {
  trialNumber: number;
  actions: Action[];
  observations: string[];
  finalOutput: string;
  startTime: number;
  endTime: number;
}

export interface Evaluation {
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

export interface Reflection {
  trialNumber: number;
  previousTrajectory: Trajectory;
  evaluation: Evaluation;
  insights: string[];
  improvements: string[];
  actionPlan: string;
  learningPoints: string[];
}

export interface Memory {
  shortTerm: Trajectory[];
  longTerm: Reflection[];
  bestTrajectory?: Trajectory;
  bestScore: number;
}

export interface ReflexionResponse {
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

export interface StreamMessage {
  type: string;
  message?: string;
  trial?: number;
  trajectory?: Trajectory;
  evaluation?: Evaluation;
  reflection?: Reflection;
  result?: ReflexionResponse;
  error?: string;
}

// 任务类型配置
const TASK_CONFIGS = {
  decision: {
    name: '序列决策',
    description: '多步骤环境导航和目标完成',
    maxActions: 10,
    evaluationFocus: ['目标完成度', '效率', '路径优化'],
    examples: [
      '在厨房环境中找到苹果并放到餐桌上',
      '在办公室环境中找到文件并打印出来',
      '在图书馆中找到特定书籍并借阅',
    ],
  },
  reasoning: {
    name: '推理任务',
    description: '多文档推理和问答',
    maxActions: 8,
    evaluationFocus: ['答案准确性', '推理逻辑', '证据支持'],
    examples: [
      '基于多个文档回答复杂问题',
      '进行多步骤逻辑推理',
      '分析因果关系并得出结论',
    ],
  },
  programming: {
    name: '编程任务',
    description: '代码生成和问题解决',
    maxActions: 6,
    evaluationFocus: ['代码正确性', '效率', '可读性'],
    examples: ['实现排序算法', '解决数据结构问题', '编写API接口函数'],
  },
  general: {
    name: '通用任务',
    description: '各种类型的综合问题',
    maxActions: 8,
    evaluationFocus: ['任务完成度', '创新性', '实用性'],
    examples: ['制定学习计划', '分析商业策略', '设计解决方案'],
  },
};

export async function POST(request: NextRequest) {
  try {
    const body: ReflexionRequest = await request.json();
    const {
      task,
      taskType,
      maxTrials,
      evaluationCriteria,
      memoryWindow,
      temperature = 0.7,
      modelName = 'gpt-3.5-turbo',
      stream = true,
    } = body;

    const startTime = Date.now();

    if (stream) {
      // 流式响应
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          try {
            // 发送开始信号
            const startData = `data: ${JSON.stringify({
              type: 'start',
              message: '开始Reflexion自我反思学习...',
              task,
              taskType,
              maxTrials,
            })}\n\n`;
            controller.enqueue(encoder.encode(startData));

            // 初始化记忆系统
            const memory: Memory = {
              shortTerm: [],
              longTerm: [],
              bestScore: -1,
            };

            const trials: {
              trajectory: Trajectory;
              evaluation: Evaluation;
              reflection?: Reflection;
            }[] = [];
            let improved = false;

            // Reflexion学习循环
            for (let trialNumber = 1; trialNumber <= maxTrials; trialNumber++) {
              // 发送试验开始信号
              const trialStartData = `data: ${JSON.stringify({
                type: 'trial_start',
                trial: trialNumber,
                message: `开始第 ${trialNumber} 次尝试...`,
              })}\n\n`;
              controller.enqueue(encoder.encode(trialStartData));

              // 1. Actor: 生成轨迹
              const trajectory = await generateTrajectory(
                task,
                taskType,
                trialNumber,
                memory,
                modelName,
                temperature
              );

              // 发送轨迹结果
              const trajectoryData = `data: ${JSON.stringify({
                type: 'trajectory_generated',
                trial: trialNumber,
                trajectory,
              })}\n\n`;
              controller.enqueue(encoder.encode(trajectoryData));

              // 2. Evaluator: 评估轨迹
              const evaluation = await evaluateTrajectory(
                trajectory,
                task,
                evaluationCriteria,
                modelName,
                temperature
              );

              // 发送评估结果
              const evaluationData = `data: ${JSON.stringify({
                type: 'evaluation_complete',
                trial: trialNumber,
                evaluation,
              })}\n\n`;
              controller.enqueue(encoder.encode(evaluationData));

              // 更新最佳轨迹
              if (evaluation.rewardScore > memory.bestScore) {
                memory.bestScore = evaluation.rewardScore;
                memory.bestTrajectory = trajectory;
                improved = true;
              }

              // 3. Self-Reflection: 生成反思（除了最后一次试验）
              let reflection: Reflection | undefined;
              if (trialNumber < maxTrials && !evaluation.success) {
                reflection = await generateReflection(
                  trajectory,
                  evaluation,
                  memory,
                  task,
                  modelName,
                  temperature
                );

                // 发送反思结果
                const reflectionData = `data: ${JSON.stringify({
                  type: 'reflection_generated',
                  trial: trialNumber,
                  reflection,
                })}\n\n`;
                controller.enqueue(encoder.encode(reflectionData));

                // 更新记忆
                memory.longTerm.push(reflection);
                if (memory.longTerm.length > memoryWindow) {
                  memory.longTerm.shift();
                }
              }

              // 更新短期记忆
              memory.shortTerm.push(trajectory);
              if (memory.shortTerm.length > memoryWindow) {
                memory.shortTerm.shift();
              }

              trials.push({ trajectory, evaluation, reflection });

              // 如果任务成功完成，可以提前结束
              if (evaluation.success) {
                const successData = `data: ${JSON.stringify({
                  type: 'task_success',
                  trial: trialNumber,
                  message: `任务在第 ${trialNumber} 次尝试中成功完成！`,
                })}\n\n`;
                controller.enqueue(encoder.encode(successData));
                break;
              }
            }

            const totalTime = Date.now() - startTime;
            const learningCurve = trials.map(
              (trial) => trial.evaluation.rewardScore
            );
            const finalResult = generateFinalResult(trials, memory);

            // 发送最终结果
            const finalData = `data: ${JSON.stringify({
              type: 'final_result',
              result: {
                task,
                taskType,
                trials,
                memory,
                finalResult,
                improvedOverTime: improved,
                totalTime,
                learningCurve,
              },
            })}\n\n`;
            controller.enqueue(encoder.encode(finalData));

            // 发送完成信号
            const doneData = `data: ${JSON.stringify({ type: 'done' })}\n\n`;
            controller.enqueue(encoder.encode(doneData));
            controller.close();
          } catch (error) {
            console.error('Reflexion Stream Error:', error);
            const errorData = `data: ${JSON.stringify({
              type: 'error',
              error: 'Reflexion处理过程发生错误',
              details: error instanceof Error ? error.message : '未知错误',
            })}\n\n`;
            controller.enqueue(encoder.encode(errorData));
            controller.close();
          }
        },
      });

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    } else {
      // 非流式响应
      const memory: Memory = {
        shortTerm: [],
        longTerm: [],
        bestScore: -1,
      };

      const trials: {
        trajectory: Trajectory;
        evaluation: Evaluation;
        reflection?: Reflection;
      }[] = [];
      let improved = false;

      for (let trialNumber = 1; trialNumber <= maxTrials; trialNumber++) {
        const trajectory = await generateTrajectory(
          task,
          taskType,
          trialNumber,
          memory,
          modelName,
          temperature
        );
        const evaluation = await evaluateTrajectory(
          trajectory,
          task,
          evaluationCriteria,
          modelName,
          temperature
        );

        if (evaluation.rewardScore > memory.bestScore) {
          memory.bestScore = evaluation.rewardScore;
          memory.bestTrajectory = trajectory;
          improved = true;
        }

        let reflection: Reflection | undefined;
        if (trialNumber < maxTrials && !evaluation.success) {
          reflection = await generateReflection(
            trajectory,
            evaluation,
            memory,
            task,
            modelName,
            temperature
          );
          memory.longTerm.push(reflection);
          if (memory.longTerm.length > memoryWindow) {
            memory.longTerm.shift();
          }
        }

        memory.shortTerm.push(trajectory);
        if (memory.shortTerm.length > memoryWindow) {
          memory.shortTerm.shift();
        }

        trials.push({ trajectory, evaluation, reflection });

        if (evaluation.success) break;
      }

      const totalTime = Date.now() - startTime;
      const learningCurve = trials.map((trial) => trial.evaluation.rewardScore);
      const finalResult = generateFinalResult(trials, memory);

      return NextResponse.json({
        task,
        taskType,
        trials,
        memory,
        finalResult,
        improvedOverTime: improved,
        totalTime,
        learningCurve,
        model: modelName,
      });
    }
  } catch (error) {
    console.error('Reflexion API Error:', error);
    return NextResponse.json(
      {
        error: 'Reflexion处理时发生错误',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

// Actor: 生成轨迹
async function generateTrajectory(
  task: string,
  taskType: string,
  trialNumber: number,
  memory: Memory,
  modelName: string,
  temperature: number
): Promise<Trajectory> {
  const chatInstance = new ChatOpenAI({
    openAIApiKey: process.env.OPEN_API_KEY,
    modelName,
    temperature,
    maxTokens: 1000,
    configuration: {
      baseURL: process.env.OPEN_API_BASE_URL,
    },
  });

  const taskConfig = TASK_CONFIGS[taskType as keyof typeof TASK_CONFIGS];
  const systemMessage = buildActorSystemMessage(taskType, taskConfig);
  const promptMessage = buildActorPrompt(task, trialNumber, memory);

  const messages = [
    new SystemMessage(systemMessage),
    new HumanMessage(promptMessage),
  ];

  const startTime = Date.now();
  const response = await chatInstance.invoke(messages);
  const content = response.content as string;

  const actions = parseActorResponse(content);
  const observations = generateObservations(actions, taskType);
  const finalOutput = generateFinalOutput(actions);

  return {
    trialNumber,
    actions,
    observations,
    finalOutput,
    startTime,
    endTime: Date.now(),
  };
}

// Evaluator: 评估轨迹
async function evaluateTrajectory(
  trajectory: Trajectory,
  task: string,
  evaluationCriteria: string[],
  modelName: string,
  temperature: number
): Promise<Evaluation> {
  const chatInstance = new ChatOpenAI({
    openAIApiKey: process.env.OPEN_API_KEY,
    modelName,
    temperature: 0.3, // 评估需要一致性
    maxTokens: 800,
    configuration: {
      baseURL: process.env.OPEN_API_BASE_URL,
    },
  });

  const systemMessage = buildEvaluatorSystemMessage(evaluationCriteria);
  const promptMessage = buildEvaluatorPrompt(
    task,
    trajectory,
    evaluationCriteria
  );

  const messages = [
    new SystemMessage(systemMessage),
    new HumanMessage(promptMessage),
  ];

  const response = await chatInstance.invoke(messages);
  const content = response.content as string;

  return parseEvaluationResponse(
    content,
    trajectory.trialNumber,
    evaluationCriteria
  );
}

// Self-Reflection: 生成反思
async function generateReflection(
  trajectory: Trajectory,
  evaluation: Evaluation,
  memory: Memory,
  task: string,
  modelName: string,
  temperature: number
): Promise<Reflection> {
  const chatInstance = new ChatOpenAI({
    openAIApiKey: process.env.OPEN_API_KEY,
    modelName,
    temperature,
    maxTokens: 1000,
    configuration: {
      baseURL: process.env.OPEN_API_BASE_URL,
    },
  });

  const systemMessage = buildReflectionSystemMessage();
  const promptMessage = buildReflectionPrompt(
    task,
    trajectory,
    evaluation,
    memory
  );

  const messages = [
    new SystemMessage(systemMessage),
    new HumanMessage(promptMessage),
  ];

  const response = await chatInstance.invoke(messages);
  const content = response.content as string;

  return parseReflectionResponse(content, trajectory, evaluation);
}

// 构建Actor系统消息
function buildActorSystemMessage(taskType: string, taskConfig: any): string {
  return `你是一个智能代理的参与者(Actor)组件，专门处理${taskConfig.name}任务。

任务特点: ${taskConfig.description}
最大动作数: ${taskConfig.maxActions}

你的职责是：
1. 分析任务需求，制定行动计划
2. 执行具体的动作步骤
3. 观察环境反馈，调整策略
4. 基于历史经验和反思改进行为

请按以下格式生成行动序列：

ACTION_1: [动作类型] - [具体内容]
REASONING_1: [推理过程]

ACTION_2: [动作类型] - [具体内容]  
REASONING_2: [推理过程]

...

FINAL_OUTPUT: [最终结果]

保持动作序列逻辑清晰，每个动作都要有明确的推理依据。`;
}

// 构建Actor提示
function buildActorPrompt(
  task: string,
  trialNumber: number,
  memory: Memory
): string {
  let prompt = `任务: ${task}\n试验次数: ${trialNumber}\n\n`;

  if (memory.longTerm.length > 0) {
    prompt += '历史反思经验:\n';
    memory.longTerm.forEach((reflection, index) => {
      prompt += `反思${index + 1}: ${reflection.actionPlan}\n`;
      prompt += `关键改进点: ${reflection.improvements.join(', ')}\n\n`;
    });
  }

  if (memory.bestTrajectory) {
    prompt += `最佳表现参考 (得分: ${memory.bestScore}):\n`;
    prompt += `输出: ${memory.bestTrajectory.finalOutput}\n\n`;
  }

  prompt += '请基于以上信息执行任务，生成改进的行动序列:';

  return prompt;
}

// 解析Actor响应
function parseActorResponse(content: string): Action[] {
  const actions: Action[] = [];
  const actionRegex = /ACTION_(\d+):\s*([^\n]+)\nREASONING_\1:\s*([^\n]+)/g;

  let match;
  while ((match = actionRegex.exec(content)) !== null) {
    actions.push({
      type: 'action',
      content: match[2].trim(),
      reasoning: match[3].trim(),
      timestamp: Date.now(),
    });
  }

  return actions;
}

// 生成观察结果
function generateObservations(actions: Action[], taskType: string): string[] {
  return actions.map((action, index) => {
    // 模拟环境反馈
    const feedbacks = {
      decision: [
        `执行动作 ${index + 1}: ${action.content}，环境状态已更新`,
        '观察到新的环境变化',
        '目标进度已推进',
      ],
      reasoning: [
        `推理步骤 ${index + 1}: ${action.content}，获得新信息`,
        '逻辑链条已建立',
        '证据收集完成',
      ],
      programming: [
        `代码片段 ${index + 1}: ${action.content}，编译成功`,
        '函数逻辑已实现',
        '测试用例通过',
      ],
      general: [
        `步骤 ${index + 1}: ${action.content}，进展顺利`,
        '获得积极反馈',
        '目标更加清晰',
      ],
    };

    const categoryFeedbacks =
      feedbacks[taskType as keyof typeof feedbacks] || feedbacks.general;
    return categoryFeedbacks[index % categoryFeedbacks.length];
  });
}

// 生成最终输出
function generateFinalOutput(actions: Action[]): string {
  if (actions.length === 0) return '未生成有效输出';

  const lastAction = actions[actions.length - 1];
  return `基于 ${actions.length} 个动作步骤，最终完成：${lastAction.content}`;
}

// 构建Evaluator系统消息
function buildEvaluatorSystemMessage(criteria: string[]): string {
  return `你是一个严格的评估者(Evaluator)，负责评价智能代理的行为轨迹。

评估维度: ${criteria.join(', ')}

评估标准：
- 每个维度评分范围: 0-10分
- 总分范围: 0-100分
- 成功阈值: 80分以上

请客观、公正地评估代理的表现，提供具体的改进建议。

返回格式：
SCORE: [总分]
SUCCESS: [true/false]
CRITERIA_SCORES:
- 维度1: [分数] - [具体反馈]
- 维度2: [分数] - [具体反馈]
...
FEEDBACK: [整体反馈和改进建议]`;
}

// 构建Evaluator提示
function buildEvaluatorPrompt(
  task: string,
  trajectory: Trajectory,
  criteria: string[]
): string {
  const actionsText = trajectory.actions
    .map(
      (action, index) =>
        `动作${index + 1}: ${action.content} (推理: ${action.reasoning})`
    )
    .join('\n');

  return `任务: ${task}

代理行为轨迹:
${actionsText}

最终输出: ${trajectory.finalOutput}
执行时间: ${trajectory.endTime - trajectory.startTime}ms

请根据以下标准评估表现:
${criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

请提供详细评估:`;
}

// 解析评估响应
function parseEvaluationResponse(
  content: string,
  trialNumber: number,
  criteria: string[]
): Evaluation {
  const scoreMatch = content.match(/SCORE:\s*(\d+)/);
  const successMatch = content.match(/SUCCESS:\s*(true|false)/);
  const feedbackMatch = content.match(/FEEDBACK:\s*([\s\S]*?)$/);

  const rewardScore = scoreMatch ? parseInt(scoreMatch[1]) : 50;
  const success = successMatch ? successMatch[1] === 'true' : false;
  const overallFeedback = feedbackMatch
    ? feedbackMatch[1].trim()
    : '需要继续改进';

  // 解析各维度得分
  const criteriaScores = criteria.map((criterion, index) => {
    const pattern = new RegExp(`- ${criterion}:\\s*(\\d+)\\s*-\\s*([^\\n]+)`);
    const match = content.match(pattern);
    return {
      criterion,
      score: match
        ? parseInt(match[1])
        : Math.floor(rewardScore / criteria.length),
      feedback: match ? match[2].trim() : '需要改进',
    };
  });

  return {
    trialNumber,
    rewardScore,
    maxScore: 100,
    criteria: criteriaScores,
    overallFeedback,
    success,
  };
}

// 构建Reflection系统消息
function buildReflectionSystemMessage(): string {
  return `你是一个自我反思(Self-Reflection)组件，负责分析失败的轨迹并生成改进建议。

你的任务是：
1. 深入分析轨迹中的问题和不足
2. 从失败中提取有价值的学习点
3. 生成具体的改进策略和行动计划
4. 为下次尝试提供明确的指导

返回格式：
INSIGHTS:
- 洞察1
- 洞察2
...

IMPROVEMENTS:
- 改进点1
- 改进点2
...

ACTION_PLAN:
[下次尝试的具体行动计划]

LEARNING_POINTS:
- 学习点1
- 学习点2
...

保持反思深入、具体、可操作。`;
}

// 构建Reflection提示
function buildReflectionPrompt(
  task: string,
  trajectory: Trajectory,
  evaluation: Evaluation,
  memory: Memory
): string {
  const actionsText = trajectory.actions
    .map(
      (action, index) =>
        `动作${index + 1}: ${action.content} (推理: ${action.reasoning})`
    )
    .join('\n');

  const previousReflections =
    memory.longTerm.length > 0
      ? `\n历史反思:\n${memory.longTerm.map((r) => r.actionPlan).join('\n')}`
      : '';

  return `任务: ${task}

失败的轨迹分析:
${actionsText}

最终输出: ${trajectory.finalOutput}

评估结果:
- 总分: ${evaluation.rewardScore}/100
- 具体反馈: ${evaluation.overallFeedback}
- 维度得分: ${evaluation.criteria.map((c) => `${c.criterion}: ${c.score}`).join(', ')}

${previousReflections}

请深入反思这次失败，生成改进策略:`;
}

// 解析反思响应
function parseReflectionResponse(
  content: string,
  trajectory: Trajectory,
  evaluation: Evaluation
): Reflection {
  const insightsMatch = content.match(
    /INSIGHTS:\s*([\s\S]*?)(?=IMPROVEMENTS:|$)/
  );
  const improvementsMatch = content.match(
    /IMPROVEMENTS:\s*([\s\S]*?)(?=ACTION_PLAN:|$)/
  );
  const actionPlanMatch = content.match(
    /ACTION_PLAN:\s*([\s\S]*?)(?=LEARNING_POINTS:|$)/
  );
  const learningPointsMatch = content.match(/LEARNING_POINTS:\s*([\s\S]*?)$/);

  const parseList = (text: string): string[] => {
    return text
      ? text
          .split('\n')
          .map((line) => line.replace(/^-\s*/, '').trim())
          .filter((line) => line.length > 0)
      : [];
  };

  return {
    trialNumber: trajectory.trialNumber,
    previousTrajectory: trajectory,
    evaluation,
    insights: parseList(insightsMatch ? insightsMatch[1] : ''),
    improvements: parseList(improvementsMatch ? improvementsMatch[1] : ''),
    actionPlan: actionPlanMatch ? actionPlanMatch[1].trim() : '继续尝试改进',
    learningPoints: parseList(
      learningPointsMatch ? learningPointsMatch[1] : ''
    ),
  };
}

// 生成最终结果
function generateFinalResult(trials: any[], memory: Memory): string {
  const bestTrial = trials.reduce((best, current) =>
    current.evaluation.rewardScore > best.evaluation.rewardScore
      ? current
      : best
  );

  const improvementRate =
    trials.length > 1
      ? (
          ((bestTrial.evaluation.rewardScore -
            trials[0].evaluation.rewardScore) /
            trials[0].evaluation.rewardScore) *
          100
        ).toFixed(1)
      : '0';

  return `经过 ${trials.length} 次尝试，最佳表现得分: ${bestTrial.evaluation.rewardScore}/100
改进幅度: ${improvementRate}%
最佳输出: ${bestTrial.trajectory.finalOutput}
${bestTrial.evaluation.success ? '✅ 任务成功完成' : '⚠️ 任务未完全成功，但有所改进'}

关键学习点: ${memory.longTerm.map((r) => r.learningPoints.join(', ')).join('; ')}`;
}
