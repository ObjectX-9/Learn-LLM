import { NextRequest, NextResponse } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

export interface DSPRequest {
  task: string;
  taskType: 'summarization' | 'translation' | 'qa' | 'generation' | 'analysis';
  input: string;
  targetObjective: string; // 期望的输出目标
  stimulusType: 'keyword' | 'instruction' | 'example' | 'constraint' | 'style';
  optimizationRounds: number; // 优化轮次
  policyModelName?: string; // 策略模型
  mainModelName?: string; // 主执行模型
  temperature?: number;
  stream?: boolean;
}

export interface StimulusGeneration {
  round: number;
  stimulus: string;
  stimulusType: string;
  reasoning: string;
  confidence: number;
}

export interface DSPExecution {
  round: number;
  stimulus: string;
  output: string;
  quality: number;
  improvement: string;
  executionTime: number;
}

export interface PolicyOptimization {
  round: number;
  previousQuality: number;
  currentQuality: number;
  improvement: number;
  strategy: string;
  nextDirection: string;
}

export interface DSPResponse {
  task: string;
  taskType: string;
  input: string;
  targetObjective: string;
  stimulusGenerations: StimulusGeneration[];
  executions: DSPExecution[];
  optimizations: PolicyOptimization[];
  bestStimulus: {
    stimulus: string;
    output: string;
    quality: number;
    round: number;
  };
  finalResult: string;
  totalTime: number;
  improvementRate: number;
}

export interface StreamMessage {
  type: string;
  message?: string;
  round?: number;
  stimulus?: StimulusGeneration;
  execution?: DSPExecution;
  optimization?: PolicyOptimization;
  result?: DSPResponse;
  error?: string;
}

// 刺激类型模板
const STIMULUS_TEMPLATES = {
  keyword: {
    name: '关键词刺激',
    description: '生成关键概念和要点提示',
    prompt: '为以下任务生成关键词和要点提示',
  },
  instruction: {
    name: '指令刺激',
    description: '生成具体的执行指令',
    prompt: '为以下任务生成详细的执行指令',
  },
  example: {
    name: '示例刺激',
    description: '生成相关示例和类比',
    prompt: '为以下任务生成相关示例和类比',
  },
  constraint: {
    name: '约束刺激',
    description: '生成限制条件和要求',
    prompt: '为以下任务生成约束条件和质量要求',
  },
  style: {
    name: '风格刺激',
    description: '生成风格和语调指导',
    prompt: '为以下任务生成风格和语调指导',
  },
};

// 任务类型配置
const TASK_CONFIGS = {
  summarization: {
    name: '文本摘要',
    description: '生成简洁准确的文本摘要',
    qualityMetrics: ['准确性', '简洁性', '完整性', '可读性'],
    defaultObjective: '生成准确、简洁、完整的摘要',
  },
  translation: {
    name: '文本翻译',
    description: '进行高质量的语言翻译',
    qualityMetrics: ['准确性', '流畅性', '忠实性', '自然性'],
    defaultObjective: '生成准确、流畅、自然的翻译',
  },
  qa: {
    name: '问答任务',
    description: '回答问题并提供详细解释',
    qualityMetrics: ['准确性', '完整性', '清晰性', '相关性'],
    defaultObjective: '提供准确、完整、清晰的答案',
  },
  generation: {
    name: '内容生成',
    description: '创造性内容生成',
    qualityMetrics: ['创意性', '相关性', '连贯性', '吸引力'],
    defaultObjective: '生成有创意、相关、连贯的内容',
  },
  analysis: {
    name: '文本分析',
    description: '深入分析文本内容',
    qualityMetrics: ['深度', '准确性', '洞察力', '结构性'],
    defaultObjective: '提供深入、准确、有洞察力的分析',
  },
};

export async function POST(request: NextRequest) {
  try {
    const body: DSPRequest = await request.json();
    const {
      task,
      taskType,
      input,
      targetObjective,
      stimulusType,
      optimizationRounds,
      policyModelName = 'gpt-3.5-turbo',
      mainModelName = 'gpt-4',
      temperature = 0.7,
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
              message: '开始DSP方向性刺激提示...',
              task,
              taskType,
              optimizationRounds,
            })}\n\n`;
            controller.enqueue(encoder.encode(startData));

            const stimulusGenerations: StimulusGeneration[] = [];
            const executions: DSPExecution[] = [];
            const optimizations: PolicyOptimization[] = [];

            let bestResult = { stimulus: '', output: '', quality: 0, round: 0 };

            // 多轮优化循环
            for (let round = 1; round <= optimizationRounds; round++) {
              // 1. 策略模型生成方向性刺激
              const stimulus = await generateDirectionalStimulus(
                task,
                taskType,
                input,
                targetObjective,
                stimulusType,
                round,
                optimizations,
                policyModelName,
                temperature
              );

              stimulusGenerations.push(stimulus);

              // 发送刺激生成结果
              const stimulusData = `data: ${JSON.stringify({
                type: 'stimulus_generated',
                round,
                stimulus,
              })}\n\n`;
              controller.enqueue(encoder.encode(stimulusData));

              // 2. 主模型执行任务
              const execution = await executeTaskWithStimulus(
                task,
                taskType,
                input,
                stimulus.stimulus,
                targetObjective,
                round,
                mainModelName,
                temperature
              );

              executions.push(execution);

              // 发送执行结果
              const executionData = `data: ${JSON.stringify({
                type: 'execution_complete',
                execution,
              })}\n\n`;
              controller.enqueue(encoder.encode(executionData));

              // 3. 更新最佳结果
              if (execution.quality > bestResult.quality) {
                bestResult = {
                  stimulus: stimulus.stimulus,
                  output: execution.output,
                  quality: execution.quality,
                  round,
                };
              }

              // 4. 策略优化（除了最后一轮）
              if (round < optimizationRounds) {
                const optimization = generatePolicyOptimization(
                  round,
                  executions,
                  targetObjective,
                  stimulusType
                );

                optimizations.push(optimization);

                // 发送优化结果
                const optimizationData = `data: ${JSON.stringify({
                  type: 'optimization_complete',
                  optimization,
                })}\n\n`;
                controller.enqueue(encoder.encode(optimizationData));
              }
            }

            const totalTime = Date.now() - startTime;
            const improvementRate =
              executions.length > 1
                ? ((bestResult.quality - executions[0].quality) /
                    executions[0].quality) *
                  100
                : 0;

            // 发送最终结果
            const finalData = `data: ${JSON.stringify({
              type: 'final_result',
              result: {
                task,
                taskType,
                input,
                targetObjective,
                stimulusGenerations,
                executions,
                optimizations,
                bestStimulus: bestResult,
                finalResult: bestResult.output,
                totalTime,
                improvementRate,
              },
            })}\n\n`;
            controller.enqueue(encoder.encode(finalData));

            // 发送完成信号
            const doneData = `data: ${JSON.stringify({ type: 'done' })}\n\n`;
            controller.enqueue(encoder.encode(doneData));
            controller.close();
          } catch (error) {
            console.error('DSP Stream Error:', error);
            const errorData = `data: ${JSON.stringify({
              type: 'error',
              error: 'DSP处理过程发生错误',
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
      const stimulusGenerations: StimulusGeneration[] = [];
      const executions: DSPExecution[] = [];
      const optimizations: PolicyOptimization[] = [];

      let bestResult = { stimulus: '', output: '', quality: 0, round: 0 };

      for (let round = 1; round <= optimizationRounds; round++) {
        const stimulus = await generateDirectionalStimulus(
          task,
          taskType,
          input,
          targetObjective,
          stimulusType,
          round,
          optimizations,
          policyModelName,
          temperature
        );

        stimulusGenerations.push(stimulus);

        const execution = await executeTaskWithStimulus(
          task,
          taskType,
          input,
          stimulus.stimulus,
          targetObjective,
          round,
          mainModelName,
          temperature
        );

        executions.push(execution);

        if (execution.quality > bestResult.quality) {
          bestResult = {
            stimulus: stimulus.stimulus,
            output: execution.output,
            quality: execution.quality,
            round,
          };
        }

        if (round < optimizationRounds) {
          const optimization = generatePolicyOptimization(
            round,
            executions,
            targetObjective,
            stimulusType
          );
          optimizations.push(optimization);
        }
      }

      const totalTime = Date.now() - startTime;
      const improvementRate =
        executions.length > 1
          ? ((bestResult.quality - executions[0].quality) /
              executions[0].quality) *
            100
          : 0;

      return NextResponse.json({
        task,
        taskType,
        input,
        targetObjective,
        stimulusGenerations,
        executions,
        optimizations,
        bestStimulus: bestResult,
        finalResult: bestResult.output,
        totalTime,
        improvementRate,
        policyModel: policyModelName,
        mainModel: mainModelName,
      });
    }
  } catch (error) {
    console.error('DSP API Error:', error);
    return NextResponse.json(
      {
        error: 'DSP处理时发生错误',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

// 生成方向性刺激
async function generateDirectionalStimulus(
  task: string,
  taskType: string,
  input: string,
  targetObjective: string,
  stimulusType: string,
  round: number,
  previousOptimizations: PolicyOptimization[],
  modelName: string,
  temperature: number
): Promise<StimulusGeneration> {
  const chatInstance = new ChatOpenAI({
    openAIApiKey: process.env.OPEN_API_KEY,
    modelName,
    temperature,
    maxTokens: 800,
    configuration: {
      baseURL: process.env.OPEN_API_BASE_URL,
    },
  });

  const stimulusTemplate =
    STIMULUS_TEMPLATES[stimulusType as keyof typeof STIMULUS_TEMPLATES];
  const taskConfig = TASK_CONFIGS[taskType as keyof typeof TASK_CONFIGS];

  const systemMessage = buildPolicySystemMessage(
    taskType,
    stimulusType,
    taskConfig
  );
  const promptMessage = buildStimulusPrompt(
    task,
    input,
    targetObjective,
    stimulusTemplate,
    round,
    previousOptimizations
  );

  const messages = [
    new SystemMessage(systemMessage),
    new HumanMessage(promptMessage),
  ];

  const response = await chatInstance.invoke(messages);
  const content = response.content as string;

  const parsed = parseStimulusGeneration(content);

  return {
    round,
    stimulus: parsed.stimulus,
    stimulusType,
    reasoning: parsed.reasoning,
    confidence: calculateStimulusConfidence(parsed.stimulus, parsed.reasoning),
  };
}

// 构建策略系统消息
function buildPolicySystemMessage(
  taskType: string,
  stimulusType: string,
  taskConfig: any
): string {
  const stimulusTemplate =
    STIMULUS_TEMPLATES[stimulusType as keyof typeof STIMULUS_TEMPLATES];

  return `你是一个专门的策略模型，负责生成方向性刺激提示来指导主模型更好地完成任务。

任务类型: ${taskConfig.name}
刺激类型: ${stimulusTemplate.name}

你的目标是生成高质量的${stimulusTemplate.description}，帮助主模型产生更好的输出。

评估标准: ${taskConfig.qualityMetrics.join('、')}

生成策略:
1. 分析任务特点和目标要求
2. 基于刺激类型生成针对性的提示
3. 考虑之前轮次的反馈进行优化
4. 确保刺激简洁有效且具有指导性

请按以下格式返回:
STIMULUS: [具体的刺激提示内容]
REASONING: [生成这个刺激的推理过程]`;
}

// 构建刺激生成提示
function buildStimulusPrompt(
  task: string,
  input: string,
  targetObjective: string,
  stimulusTemplate: any,
  round: number,
  previousOptimizations: PolicyOptimization[]
): string {
  let optimizationContext = '';
  if (previousOptimizations.length > 0) {
    const lastOptimization =
      previousOptimizations[previousOptimizations.length - 1];
    optimizationContext = `\n\n前轮优化反馈:
策略: ${lastOptimization.strategy}
下一步方向: ${lastOptimization.nextDirection}`;
  }

  return `任务: ${task}
输入内容: ${input}
目标要求: ${targetObjective}

刺激类型: ${stimulusTemplate.description}
当前轮次: ${round}${optimizationContext}

请${stimulusTemplate.prompt}，帮助主模型更好地完成任务目标。

要求:
1. 刺激提示要具体、明确、有指导性
2. 针对任务类型和目标要求进行优化
3. 考虑前轮反馈进行改进
4. 保持简洁有效

请生成方向性刺激:`;
}

// 解析刺激生成结果
function parseStimulusGeneration(content: string): {
  stimulus: string;
  reasoning: string;
} {
  const stimulusMatch = content.match(
    /STIMULUS:\s*([\s\S]*?)(?=\nREASONING:|$)/
  );
  const reasoningMatch = content.match(/REASONING:\s*([\s\S]*?)$/);

  return {
    stimulus: stimulusMatch ? stimulusMatch[1].trim() : content.trim(),
    reasoning: reasoningMatch ? reasoningMatch[1].trim() : '自动生成的刺激提示',
  };
}

// 计算刺激置信度
function calculateStimulusConfidence(
  stimulus: string,
  reasoning: string
): number {
  let confidence = 0.5;

  // 刺激长度合理性
  if (stimulus.length > 10 && stimulus.length < 300) confidence += 0.15;

  // 推理完整性
  if (reasoning.length > 20) confidence += 0.1;
  if (reasoning.includes('因为') || reasoning.includes('通过'))
    confidence += 0.1;

  // 刺激具体性
  if (
    stimulus.includes('具体') ||
    stimulus.includes('详细') ||
    stimulus.includes('明确')
  )
    confidence += 0.1;

  // 指导性语言
  if (
    stimulus.includes('请') ||
    stimulus.includes('需要') ||
    stimulus.includes('应该')
  )
    confidence += 0.05;

  return Math.min(confidence, 1.0);
}

// 执行任务
async function executeTaskWithStimulus(
  task: string,
  taskType: string,
  input: string,
  stimulus: string,
  targetObjective: string,
  round: number,
  modelName: string,
  temperature: number
): Promise<DSPExecution> {
  const startTime = Date.now();

  const chatInstance = new ChatOpenAI({
    openAIApiKey: process.env.OPEN_API_KEY,
    modelName,
    temperature: 0.3, // 主模型使用较低温度确保稳定性
    maxTokens: 1000,
    configuration: {
      baseURL: process.env.OPEN_API_BASE_URL,
    },
  });

  const taskConfig = TASK_CONFIGS[taskType as keyof typeof TASK_CONFIGS];

  const systemMessage = `你是一个专业的AI助手，专门处理${taskConfig.description}任务。

目标要求: ${targetObjective}
评估标准: ${taskConfig.qualityMetrics.join('、')}

请按照给定的方向性刺激来完成任务，确保输出质量高且符合要求。`;

  const promptMessage = `任务: ${task}

输入内容:
${input}

方向性刺激:
${stimulus}

请根据上述刺激指导完成任务，生成高质量的输出:`;

  const messages = [
    new SystemMessage(systemMessage),
    new HumanMessage(promptMessage),
  ];

  try {
    const response = await chatInstance.invoke(messages);
    const output = response.content as string;

    const quality = evaluateOutputQuality(output, taskType, targetObjective);
    const improvement = round > 1 ? '基于前轮优化的改进输出' : '初始输出';

    return {
      round,
      stimulus,
      output,
      quality,
      improvement,
      executionTime: Date.now() - startTime,
    };
  } catch (error) {
    return {
      round,
      stimulus,
      output: `执行失败: ${error instanceof Error ? error.message : '未知错误'}`,
      quality: 0,
      improvement: '执行失败',
      executionTime: Date.now() - startTime,
    };
  }
}

// 评估输出质量
function evaluateOutputQuality(
  output: string,
  taskType: string,
  targetObjective: string
): number {
  let quality = 0.5; // 基础质量

  // 长度合理性
  if (output.length > 50 && output.length < 2000) quality += 0.1;

  // 结构性
  if (output.includes('\n') || output.includes('：') || output.includes('。'))
    quality += 0.1;

  // 任务特定质量
  switch (taskType) {
    case 'summarization':
      if (
        output.includes('总结') ||
        output.includes('主要') ||
        output.includes('关键')
      )
        quality += 0.15;
      break;
    case 'translation':
      if (output.length > 20 && !output.includes('翻译')) quality += 0.15;
      break;
    case 'qa':
      if (
        output.includes('答案') ||
        output.includes('因为') ||
        output.includes('所以')
      )
        quality += 0.15;
      break;
    case 'generation':
      if (output.length > 100) quality += 0.15;
      break;
    case 'analysis':
      if (
        output.includes('分析') ||
        output.includes('观点') ||
        output.includes('结论')
      )
        quality += 0.15;
      break;
  }

  return Math.min(quality, 1.0);
}

// 生成策略优化
function generatePolicyOptimization(
  round: number,
  executions: DSPExecution[],
  targetObjective: string,
  stimulusType: string
): PolicyOptimization {
  const currentExecution = executions[executions.length - 1];
  const previousExecution =
    executions.length > 1 ? executions[executions.length - 2] : null;

  const previousQuality = previousExecution ? previousExecution.quality : 0;
  const currentQuality = currentExecution.quality;
  const improvement = currentQuality - previousQuality;

  let strategy = '';
  let nextDirection = '';

  if (improvement > 0.1) {
    strategy = '当前策略有效，继续优化';
    nextDirection = '在现有基础上进一步细化刺激内容';
  } else if (improvement > 0) {
    strategy = '略有改进，需要调整方向';
    nextDirection = '尝试不同的刺激角度和表达方式';
  } else {
    strategy = '效果不佳，需要改变策略';
    nextDirection = '重新考虑刺激类型和指导方式';
  }

  // 基于刺激类型的特定优化
  switch (stimulusType) {
    case 'keyword':
      nextDirection += '，增加更精准的关键词';
      break;
    case 'instruction':
      nextDirection += '，提供更详细的操作指令';
      break;
    case 'example':
      nextDirection += '，使用更相关的示例';
      break;
    case 'constraint':
      nextDirection += '，设置更明确的约束条件';
      break;
    case 'style':
      nextDirection += '，调整风格指导的具体性';
      break;
  }

  return {
    round,
    previousQuality,
    currentQuality,
    improvement,
    strategy,
    nextDirection,
  };
}
