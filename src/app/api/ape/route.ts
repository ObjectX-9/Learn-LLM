import { NextRequest, NextResponse } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

export interface APERequest {
  task: string;
  taskType:
    | 'reasoning'
    | 'classification'
    | 'generation'
    | 'qa'
    | 'math'
    | 'general';
  examples: Array<{
    input: string;
    expectedOutput: string;
    reasoning?: string;
  }>;
  evaluationCriteria: string[];
  numCandidates: number;
  temperature?: number;
  modelName?: string;
  stream?: boolean;
}

export interface CandidateInstruction {
  id: string;
  instruction: string;
  description: string;
  generationReasoning: string;
}

export interface EvaluationResult {
  candidateId: string;
  instruction: string;
  results: Array<{
    exampleIndex: number;
    input: string;
    expectedOutput: string;
    actualOutput: string;
    score: number;
    reasoning: string;
  }>;
  overallScore: number;
  averageScore: number;
  successRate: number;
}

export interface APEResponse {
  task: string;
  taskType: string;
  candidates: CandidateInstruction[];
  evaluations: EvaluationResult[];
  bestInstruction: {
    instruction: string;
    score: number;
    reasoning: string;
  };
  totalTime: number;
  improvement: string;
}

export interface StreamMessage {
  type: string;
  message?: string;
  candidates?: CandidateInstruction[];
  evaluation?: EvaluationResult;
  result?: APEResponse;
  error?: string;
}

// 任务类型的基准指令模板
const BASELINE_INSTRUCTIONS = {
  reasoning: '让我们一步一步地思考这个问题。',
  classification: '请分析以下内容并进行分类。',
  generation: '请生成符合要求的内容。',
  qa: '请根据给定信息回答问题。',
  math: '让我们一步一步地解决这个数学问题。',
  general: '请仔细分析并回应以下内容。',
};

// 改进的指令模板示例
const IMPROVED_EXAMPLES = {
  reasoning: [
    '让我们一步一步地解决这个问题，以确保我们有正确的答案。',
    '请系统性地分析这个问题，逐步推理并验证每个步骤。',
    '采用逻辑思维方法，分步骤地解决这个问题并检查答案的合理性。',
  ],
  math: [
    '让我们一步一步地解决这个数学问题，仔细检查每个计算步骤。',
    '请运用数学原理，逐步求解并验证答案的正确性。',
    '采用严谨的数学方法，分步计算并确保结果准确无误。',
  ],
  classification: [
    '请仔细分析内容的特征，然后进行准确的分类。',
    '基于内容的关键特点和模式，进行系统性的分类判断。',
    '运用分析思维，识别关键特征并做出准确的分类决策。',
  ],
};

export async function POST(request: NextRequest) {
  try {
    const body: APERequest = await request.json();
    const {
      task,
      taskType,
      examples,
      evaluationCriteria,
      numCandidates,
      temperature = 0.8,
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
              message: '开始APE自动提示工程...',
              task,
              taskType,
              numCandidates,
            })}\n\n`;
            controller.enqueue(encoder.encode(startData));

            // 1. 生成候选指令
            const candidates = await generateCandidateInstructions(
              task,
              taskType,
              examples,
              numCandidates,
              modelName,
              temperature
            );

            const candidatesData = `data: ${JSON.stringify({
              type: 'candidates_generated',
              message: `生成了 ${candidates.length} 个候选指令`,
              candidates,
            })}\n\n`;
            controller.enqueue(encoder.encode(candidatesData));

            // 2. 评估每个候选指令
            const evaluations: EvaluationResult[] = [];

            for (let i = 0; i < candidates.length; i++) {
              const candidate = candidates[i];

              // 发送评估开始信号
              const evalStartData = `data: ${JSON.stringify({
                type: 'evaluation_start',
                message: `正在评估候选指令 ${i + 1}/${candidates.length}`,
                candidateId: candidate.id,
                instruction: candidate.instruction,
              })}\n\n`;
              controller.enqueue(encoder.encode(evalStartData));

              const evaluation = await evaluateInstruction(
                candidate,
                examples,
                evaluationCriteria,
                modelName,
                temperature
              );

              evaluations.push(evaluation);

              // 发送评估结果
              const evalData = `data: ${JSON.stringify({
                type: 'evaluation_complete',
                evaluation,
              })}\n\n`;
              controller.enqueue(encoder.encode(evalData));
            }

            // 3. 选择最佳指令
            const bestInstruction = selectBestInstruction(evaluations);
            const totalTime = Date.now() - startTime;

            // 计算改进程度
            const baselineScore = await evaluateBaselineInstruction(
              taskType,
              examples,
              evaluationCriteria,
              modelName,
              temperature
            );

            const improvement = calculateImprovement(
              baselineScore,
              bestInstruction.score
            );

            // 发送最终结果
            const finalData = `data: ${JSON.stringify({
              type: 'final_result',
              result: {
                task,
                taskType,
                candidates,
                evaluations,
                bestInstruction,
                totalTime,
                improvement,
              },
            })}\n\n`;
            controller.enqueue(encoder.encode(finalData));

            // 发送完成信号
            const doneData = `data: ${JSON.stringify({ type: 'done' })}\n\n`;
            controller.enqueue(encoder.encode(doneData));
            controller.close();
          } catch (error) {
            console.error('APE Stream Error:', error);
            const errorData = `data: ${JSON.stringify({
              type: 'error',
              error: 'APE处理过程发生错误',
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
      const candidates = await generateCandidateInstructions(
        task,
        taskType,
        examples,
        numCandidates,
        modelName,
        temperature
      );

      const evaluations: EvaluationResult[] = [];
      for (const candidate of candidates) {
        const evaluation = await evaluateInstruction(
          candidate,
          examples,
          evaluationCriteria,
          modelName,
          temperature
        );
        evaluations.push(evaluation);
      }

      const bestInstruction = selectBestInstruction(evaluations);
      const totalTime = Date.now() - startTime;

      const baselineScore = await evaluateBaselineInstruction(
        taskType,
        examples,
        evaluationCriteria,
        modelName,
        temperature
      );

      const improvement = calculateImprovement(
        baselineScore,
        bestInstruction.score
      );

      return NextResponse.json({
        task,
        taskType,
        candidates,
        evaluations,
        bestInstruction,
        totalTime,
        improvement,
        model: modelName,
      });
    }
  } catch (error) {
    console.error('APE API Error:', error);
    return NextResponse.json(
      {
        error: 'APE处理时发生错误',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

// 生成候选指令
async function generateCandidateInstructions(
  task: string,
  taskType: string,
  examples: any[],
  numCandidates: number,
  modelName: string,
  temperature: number
): Promise<CandidateInstruction[]> {
  const chatInstance = new ChatOpenAI({
    openAIApiKey: process.env.OPEN_API_KEY,
    modelName,
    temperature,
    maxTokens: 1000,
    configuration: {
      baseURL: process.env.OPEN_API_BASE_URL,
    },
  });

  const systemMessage = buildAPESystemMessage(taskType);
  const promptMessage = buildCandidateGenerationPrompt(
    task,
    taskType,
    examples,
    numCandidates
  );

  const messages = [
    new SystemMessage(systemMessage),
    new HumanMessage(promptMessage),
  ];

  const response = await chatInstance.invoke(messages);
  const candidates = parseCandidateInstructions(response.content as string);

  return candidates.slice(0, numCandidates);
}

// 构建APE系统消息
function buildAPESystemMessage(taskType: string): string {
  return `你是一个自动提示工程师（APE）系统，专门用于生成和优化AI指令。

你的任务是：
1. 分析给定的任务类型和示例
2. 生成多个候选指令，这些指令应该比基准指令更有效
3. 每个候选指令都应该清晰、具体，并针对任务类型进行优化

任务类型: ${taskType}

生成指令时请考虑：
- 指令的清晰度和具体性
- 是否引导模型进行逐步思考
- 是否包含验证和检查机制
- 是否适合任务的特定要求

基准指令参考: "${BASELINE_INSTRUCTIONS[taskType as keyof typeof BASELINE_INSTRUCTIONS]}"

请生成比基准指令更优秀的候选指令。`;
}

// 构建候选指令生成提示
function buildCandidateGenerationPrompt(
  task: string,
  taskType: string,
  examples: any[],
  numCandidates: number
): string {
  const examplesText = examples
    .map(
      (example, index) =>
        `示例 ${index + 1}:\n输入: ${example.input}\n期望输出: ${example.expectedOutput}${
          example.reasoning ? `\n推理: ${example.reasoning}` : ''
        }`
    )
    .join('\n\n');

  const improvedExamples =
    IMPROVED_EXAMPLES[taskType as keyof typeof IMPROVED_EXAMPLES] || [];
  const examplesSection =
    improvedExamples.length > 0
      ? `\n\n参考改进示例:\n${improvedExamples.map((ex, i) => `${i + 1}. ${ex}`).join('\n')}`
      : '';

  return `任务描述: ${task}
任务类型: ${taskType}

示例数据:
${examplesText}${examplesSection}

请生成 ${numCandidates} 个优化的候选指令。每个指令应该：
1. 比基准指令更有效
2. 清晰具体地指导AI完成任务
3. 包含适当的推理引导
4. 适合给定的任务类型和示例

请按以下格式返回：

CANDIDATE 1:
INSTRUCTION: [指令内容]
DESCRIPTION: [为什么这个指令更好]
REASONING: [设计这个指令的推理过程]

CANDIDATE 2:
...

请生成候选指令：`;
}

// 解析候选指令
function parseCandidateInstructions(response: string): CandidateInstruction[] {
  const candidates: CandidateInstruction[] = [];
  const candidateBlocks = response
    .split(/CANDIDATE \d+:/)
    .filter((block) => block.trim());

  candidateBlocks.forEach((block, index) => {
    const instructionMatch = block.match(
      /INSTRUCTION:\s*([\s\S]+?)(?=\nDESCRIPTION:|$)/
    );
    const descriptionMatch = block.match(
      /DESCRIPTION:\s*([\s\S]+?)(?=\nREASONING:|$)/
    );
    const reasoningMatch = block.match(/REASONING:\s*([\s\S]+?)(?=\n|$)/);

    if (instructionMatch) {
      candidates.push({
        id: `candidate-${index + 1}`,
        instruction: instructionMatch[1].trim(),
        description: descriptionMatch ? descriptionMatch[1].trim() : '',
        generationReasoning: reasoningMatch ? reasoningMatch[1].trim() : '',
      });
    }
  });

  return candidates;
}

// 评估指令性能
async function evaluateInstruction(
  candidate: CandidateInstruction,
  examples: any[],
  evaluationCriteria: string[],
  modelName: string,
  temperature: number
): Promise<EvaluationResult> {
  const chatInstance = new ChatOpenAI({
    openAIApiKey: process.env.OPEN_API_KEY,
    modelName,
    temperature: 0.3, // 较低温度确保一致性
    maxTokens: 800,
    configuration: {
      baseURL: process.env.OPEN_API_BASE_URL,
    },
  });

  const results = [];
  let totalScore = 0;
  let successCount = 0;

  for (let i = 0; i < examples.length; i++) {
    const example = examples[i];

    // 使用候选指令执行任务
    const messages = [
      new SystemMessage(candidate.instruction),
      new HumanMessage(example.input),
    ];

    try {
      const response = await chatInstance.invoke(messages);
      const actualOutput = response.content as string;

      // 评估输出质量
      const score = await evaluateOutput(
        example.input,
        example.expectedOutput,
        actualOutput,
        evaluationCriteria,
        modelName
      );

      results.push({
        exampleIndex: i,
        input: example.input,
        expectedOutput: example.expectedOutput,
        actualOutput,
        score,
        reasoning: `基于评估标准的综合评分`,
      });

      totalScore += score;
      if (score >= 0.7) successCount++; // 70%以上认为成功
    } catch (error) {
      results.push({
        exampleIndex: i,
        input: example.input,
        expectedOutput: example.expectedOutput,
        actualOutput: `执行错误: ${error instanceof Error ? error.message : '未知错误'}`,
        score: 0,
        reasoning: '指令执行失败',
      });
    }
  }

  return {
    candidateId: candidate.id,
    instruction: candidate.instruction,
    results,
    overallScore: totalScore,
    averageScore: examples.length > 0 ? totalScore / examples.length : 0,
    successRate: examples.length > 0 ? successCount / examples.length : 0,
  };
}

// 评估输出质量
async function evaluateOutput(
  input: string,
  expectedOutput: string,
  actualOutput: string,
  criteria: string[],
  modelName: string
): Promise<number> {
  // 简化评估：基于文本相似度和长度合理性
  const similarity = calculateTextSimilarity(expectedOutput, actualOutput);
  const lengthRatio = Math.min(actualOutput.length / expectedOutput.length, 1);
  const qualityScore = actualOutput.length > 10 ? 0.8 : 0.3; // 基础质量检查

  return Math.min(
    similarity * 0.5 + lengthRatio * 0.3 + qualityScore * 0.2,
    1.0
  );
}

// 计算文本相似度（简化版）
function calculateTextSimilarity(text1: string, text2: string): number {
  const words1 = text1
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 0);
  const words2 = text2
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 0);

  const intersection = words1.filter((word) => words2.includes(word));
  const unionSet = new Set([...words1, ...words2]);
  const union = Array.from(unionSet);

  return union.length > 0 ? intersection.length / union.length : 0;
}

// 选择最佳指令
function selectBestInstruction(evaluations: EvaluationResult[]) {
  let best = evaluations[0];

  for (const evaluation of evaluations) {
    // 综合考虑平均分数和成功率
    const currentScore =
      evaluation.averageScore * 0.7 + evaluation.successRate * 0.3;
    const bestScore = best.averageScore * 0.7 + best.successRate * 0.3;

    if (currentScore > bestScore) {
      best = evaluation;
    }
  }

  return {
    instruction: best.instruction,
    score: best.averageScore * 0.7 + best.successRate * 0.3,
    reasoning: `该指令在 ${best.results.length} 个测试样本中获得了 ${(best.averageScore * 100).toFixed(1)}% 的平均分数和 ${(best.successRate * 100).toFixed(1)}% 的成功率`,
  };
}

// 评估基准指令
async function evaluateBaselineInstruction(
  taskType: string,
  examples: any[],
  evaluationCriteria: string[],
  modelName: string,
  temperature: number
): Promise<number> {
  const baselineInstruction =
    BASELINE_INSTRUCTIONS[taskType as keyof typeof BASELINE_INSTRUCTIONS];

  const dummyCandidate: CandidateInstruction = {
    id: 'baseline',
    instruction: baselineInstruction,
    description: '基准指令',
    generationReasoning: '传统基准指令',
  };

  const evaluation = await evaluateInstruction(
    dummyCandidate,
    examples,
    evaluationCriteria,
    modelName,
    temperature
  );

  return evaluation.averageScore * 0.7 + evaluation.successRate * 0.3;
}

// 计算改进程度
function calculateImprovement(
  baselineScore: number,
  bestScore: number
): string {
  if (baselineScore === 0) {
    return '无法计算改进程度（基准分数为0）';
  }

  const improvementPercent = (
    ((bestScore - baselineScore) / baselineScore) *
    100
  ).toFixed(1);
  const improvementAbs = (bestScore - baselineScore).toFixed(3);

  if (bestScore > baselineScore) {
    return `改进了 ${improvementPercent}%（+${improvementAbs}分）`;
  } else if (bestScore < baselineScore) {
    return `下降了 ${Math.abs(parseFloat(improvementPercent))}%（${improvementAbs}分）`;
  } else {
    return '性能持平';
  }
}
