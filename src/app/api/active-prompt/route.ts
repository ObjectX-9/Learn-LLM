import { NextRequest, NextResponse } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

export interface ActivePromptRequest {
  task: string;
  taskType: 'reasoning' | 'classification' | 'qa' | 'math' | 'general';
  initialExamples: Array<{
    input: string;
    output?: string;
    reasoning?: string;
  }>;
  testQuestions: string[];
  numGenerations: number; // k个可能答案
  uncertaintyThreshold: number; // 不确定度阈值
  temperature?: number;
  modelName?: string;
  stream?: boolean;
}

export interface GenerationResult {
  questionIndex: number;
  question: string;
  generations: Array<{
    answer: string;
    reasoning: string;
    confidence: number;
  }>;
  uncertainty: number;
  consistency: number;
  needsAnnotation: boolean;
}

export interface UncertaintyMeasure {
  disagreementScore: number; // 答案分歧程度
  consistencyScore: number; // 答案一致性
  confidenceVariance: number; // 置信度方差
  overallUncertainty: number; // 综合不确定度
}

export interface ActivePromptResponse {
  task: string;
  taskType: string;
  initialExamples: any[];
  results: GenerationResult[];
  uncertaintyRanking: Array<{
    questionIndex: number;
    question: string;
    uncertainty: number;
    priority: 'high' | 'medium' | 'low';
  }>;
  recommendedAnnotations: Array<{
    questionIndex: number;
    question: string;
    suggestedAnswer: string;
    reasoning: string;
  }>;
  statistics: {
    totalQuestions: number;
    highUncertaintyCount: number;
    averageUncertainty: number;
    improvementPotential: number;
  };
  totalTime: number;
}

export interface StreamMessage {
  type: string;
  message?: string;
  questionIndex?: number;
  generation?: GenerationResult;
  uncertainty?: UncertaintyMeasure;
  result?: ActivePromptResponse;
  error?: string;
}

// CoT示例模板
const COT_TEMPLATES = {
  reasoning: '让我们一步一步分析这个问题：',
  classification: '让我分析这个内容的特征来进行分类：',
  qa: '基于给定信息，让我逐步推理来回答这个问题：',
  math: '让我们一步一步解决这个数学问题：',
  general: '让我仔细分析并逐步推理：',
};

export async function POST(request: NextRequest) {
  try {
    const body: ActivePromptRequest = await request.json();
    const {
      task,
      taskType,
      initialExamples,
      testQuestions,
      numGenerations,
      uncertaintyThreshold,
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
              message: '开始Active-Prompt主动学习...',
              task,
              taskType,
              totalQuestions: testQuestions.length,
            })}\n\n`;
            controller.enqueue(encoder.encode(startData));

            const results: GenerationResult[] = [];

            // 对每个测试问题进行多次生成
            for (let i = 0; i < testQuestions.length; i++) {
              const question = testQuestions[i];

              // 发送处理开始信号
              const questionStartData = `data: ${JSON.stringify({
                type: 'question_start',
                message: `处理问题 ${i + 1}/${testQuestions.length}`,
                questionIndex: i,
                question,
              })}\n\n`;
              controller.enqueue(encoder.encode(questionStartData));

              // 生成k个答案
              const generations = await generateMultipleAnswers(
                question,
                taskType,
                initialExamples,
                numGenerations,
                modelName,
                temperature
              );

              // 计算不确定度
              const uncertaintyMeasure = calculateUncertainty(generations);

              const result: GenerationResult = {
                questionIndex: i,
                question,
                generations,
                uncertainty: uncertaintyMeasure.overallUncertainty,
                consistency: uncertaintyMeasure.consistencyScore,
                needsAnnotation:
                  uncertaintyMeasure.overallUncertainty > uncertaintyThreshold,
              };

              results.push(result);

              // 发送生成结果
              const generationData = `data: ${JSON.stringify({
                type: 'generation_complete',
                generation: result,
                uncertainty: uncertaintyMeasure,
              })}\n\n`;
              controller.enqueue(encoder.encode(generationData));
            }

            // 分析结果并生成推荐
            const analysis = analyzeResults(results, uncertaintyThreshold);

            const totalTime = Date.now() - startTime;

            // 发送最终结果
            const finalData = `data: ${JSON.stringify({
              type: 'final_result',
              result: {
                task,
                taskType,
                initialExamples,
                results,
                uncertaintyRanking: analysis.uncertaintyRanking,
                recommendedAnnotations: analysis.recommendedAnnotations,
                statistics: analysis.statistics,
                totalTime,
              },
            })}\n\n`;
            controller.enqueue(encoder.encode(finalData));

            // 发送完成信号
            const doneData = `data: ${JSON.stringify({ type: 'done' })}\n\n`;
            controller.enqueue(encoder.encode(doneData));
            controller.close();
          } catch (error) {
            console.error('Active-Prompt Stream Error:', error);
            const errorData = `data: ${JSON.stringify({
              type: 'error',
              error: 'Active-Prompt处理过程发生错误',
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
      const results: GenerationResult[] = [];

      for (let i = 0; i < testQuestions.length; i++) {
        const question = testQuestions[i];

        const generations = await generateMultipleAnswers(
          question,
          taskType,
          initialExamples,
          numGenerations,
          modelName,
          temperature
        );

        const uncertaintyMeasure = calculateUncertainty(generations);

        results.push({
          questionIndex: i,
          question,
          generations,
          uncertainty: uncertaintyMeasure.overallUncertainty,
          consistency: uncertaintyMeasure.consistencyScore,
          needsAnnotation:
            uncertaintyMeasure.overallUncertainty > uncertaintyThreshold,
        });
      }

      const analysis = analyzeResults(results, uncertaintyThreshold);
      const totalTime = Date.now() - startTime;

      return NextResponse.json({
        task,
        taskType,
        initialExamples,
        results,
        uncertaintyRanking: analysis.uncertaintyRanking,
        recommendedAnnotations: analysis.recommendedAnnotations,
        statistics: analysis.statistics,
        totalTime,
        model: modelName,
      });
    }
  } catch (error) {
    console.error('Active-Prompt API Error:', error);
    return NextResponse.json(
      {
        error: 'Active-Prompt处理时发生错误',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

// 生成多个答案
async function generateMultipleAnswers(
  question: string,
  taskType: string,
  examples: any[],
  numGenerations: number,
  modelName: string,
  temperature: number
): Promise<Array<{ answer: string; reasoning: string; confidence: number }>> {
  const chatInstance = new ChatOpenAI({
    openAIApiKey: process.env.OPEN_API_KEY,
    modelName,
    temperature,
    maxTokens: 800,
    configuration: {
      baseURL: process.env.OPEN_API_BASE_URL,
    },
  });

  const generations = [];
  const systemMessage = buildSystemMessage(taskType, examples);

  for (let i = 0; i < numGenerations; i++) {
    try {
      const promptMessage = buildPromptMessage(question, taskType);

      const messages = [
        new SystemMessage(systemMessage),
        new HumanMessage(promptMessage),
      ];

      const response = await chatInstance.invoke(messages);
      const content = response.content as string;

      // 解析答案和推理过程
      const parsed = parseGenerationResult(content);

      generations.push({
        answer: parsed.answer,
        reasoning: parsed.reasoning,
        confidence: calculateAnswerConfidence(parsed.answer, parsed.reasoning),
      });
    } catch (error) {
      // 如果生成失败，添加一个默认结果
      generations.push({
        answer: '生成失败',
        reasoning: `第${i + 1}次生成失败: ${error instanceof Error ? error.message : '未知错误'}`,
        confidence: 0,
      });
    }
  }

  return generations;
}

// 构建系统消息
function buildSystemMessage(taskType: string, examples: any[]): string {
  const cotTemplate = COT_TEMPLATES[taskType as keyof typeof COT_TEMPLATES];

  let examplesText = '';
  if (examples.length > 0) {
    examplesText = examples
      .map((example, index) => {
        return `示例 ${index + 1}:\n问题: ${example.input}\n${
          example.output ? `答案: ${example.output}\n` : ''
        }${example.reasoning ? `推理: ${example.reasoning}\n` : ''}`;
      })
      .join('\n---\n');
  }

  return `你是一个专业的AI助手，擅长${getTaskTypeDescription(taskType)}。

${examplesText ? `参考示例:\n${examplesText}\n\n` : ''}

请按以下格式回答问题：
推理过程: ${cotTemplate}
[详细的步骤分析]

最终答案: [明确的答案]

要求：
1. 提供清晰的推理步骤
2. 给出明确的最终答案
3. 确保逻辑连贯性`;
}

// 构建提示消息
function buildPromptMessage(question: string, taskType: string): string {
  const cotTemplate = COT_TEMPLATES[taskType as keyof typeof COT_TEMPLATES];

  return `问题: ${question}

请使用以下格式回答：
推理过程: ${cotTemplate}
最终答案: `;
}

// 解析生成结果
function parseGenerationResult(content: string): {
  answer: string;
  reasoning: string;
} {
  const reasoningMatch = content.match(
    /推理过程[:：]\s*([\s\S]*?)(?=最终答案|$)/
  );
  const answerMatch = content.match(/最终答案[:：]\s*([\s\S]*?)$/);

  return {
    reasoning: reasoningMatch ? reasoningMatch[1].trim() : content,
    answer: answerMatch
      ? answerMatch[1].trim()
      : content.split('\n').pop() || content,
  };
}

// 计算答案置信度
function calculateAnswerConfidence(answer: string, reasoning: string): number {
  let confidence = 0.5; // 基础置信度

  // 答案长度合理性
  if (answer.length > 5 && answer.length < 200) confidence += 0.1;

  // 推理步骤完整性
  if (reasoning.length > 20) confidence += 0.1;
  if (reasoning.includes('因为') || reasoning.includes('所以'))
    confidence += 0.1;
  if (
    reasoning.includes('步骤') ||
    reasoning.includes('首先') ||
    reasoning.includes('然后')
  )
    confidence += 0.1;

  // 答案确定性
  if (
    !answer.includes('可能') &&
    !answer.includes('也许') &&
    !answer.includes('不确定')
  ) {
    confidence += 0.1;
  }

  // 数值答案
  if (/\d+/.test(answer)) confidence += 0.1;

  return Math.min(confidence, 1.0);
}

// 计算不确定度
function calculateUncertainty(
  generations: Array<{ answer: string; reasoning: string; confidence: number }>
): UncertaintyMeasure {
  if (generations.length <= 1) {
    return {
      disagreementScore: 0,
      consistencyScore: 1,
      confidenceVariance: 0,
      overallUncertainty: 0,
    };
  }

  // 1. 计算答案分歧程度
  const answers = generations.map((g) => g.answer.toLowerCase().trim());
  const uniqueAnswers = new Set(answers);
  const disagreementScore = (uniqueAnswers.size - 1) / (answers.length - 1);

  // 2. 计算答案一致性（最频繁答案的比例）
  const answerCounts = new Map<string, number>();
  answers.forEach((answer) => {
    answerCounts.set(answer, (answerCounts.get(answer) || 0) + 1);
  });

  const maxCount = Math.max(...Array.from(answerCounts.values()));
  const consistencyScore = maxCount / answers.length;

  // 3. 计算置信度方差
  const confidences = generations.map((g) => g.confidence);
  const avgConfidence =
    confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
  const confidenceVariance =
    confidences.reduce(
      (sum, conf) => sum + Math.pow(conf - avgConfidence, 2),
      0
    ) / confidences.length;

  // 4. 综合不确定度计算
  const overallUncertainty =
    disagreementScore * 0.5 +
    (1 - consistencyScore) * 0.3 +
    confidenceVariance * 0.2;

  return {
    disagreementScore,
    consistencyScore,
    confidenceVariance,
    overallUncertainty,
  };
}

// 分析结果
function analyzeResults(
  results: GenerationResult[],
  uncertaintyThreshold: number
) {
  // 按不确定度排序
  const uncertaintyRanking = results
    .map((result, index) => ({
      questionIndex: index,
      question: result.question,
      uncertainty: result.uncertainty,
      priority:
        result.uncertainty > uncertaintyThreshold
          ? 'high'
          : result.uncertainty > uncertaintyThreshold * 0.6
            ? 'medium'
            : ('low' as 'high' | 'medium' | 'low'),
    }))
    .sort((a, b) => b.uncertainty - a.uncertainty);

  // 生成标注推荐
  const recommendedAnnotations = results
    .filter((result) => result.needsAnnotation)
    .map((result) => {
      // 选择置信度最高的生成作为建议答案
      const bestGeneration = result.generations.reduce((best, current) =>
        current.confidence > best.confidence ? current : best
      );

      return {
        questionIndex: result.questionIndex,
        question: result.question,
        suggestedAnswer: bestGeneration.answer,
        reasoning: bestGeneration.reasoning,
      };
    })
    .slice(0, 5); // 限制推荐数量

  // 统计信息
  const totalQuestions = results.length;
  const highUncertaintyCount = results.filter(
    (r) => r.uncertainty > uncertaintyThreshold
  ).length;
  const averageUncertainty =
    results.reduce((sum, r) => sum + r.uncertainty, 0) / totalQuestions;
  const improvementPotential = highUncertaintyCount / totalQuestions;

  return {
    uncertaintyRanking,
    recommendedAnnotations,
    statistics: {
      totalQuestions,
      highUncertaintyCount,
      averageUncertainty,
      improvementPotential,
    },
  };
}

// 获取任务类型描述
function getTaskTypeDescription(taskType: string): string {
  const descriptions = {
    reasoning: '逻辑推理和分析',
    classification: '内容分类和判断',
    qa: '问答和信息提取',
    math: '数学计算和解题',
    general: '通用问题处理',
  };
  return descriptions[taskType as keyof typeof descriptions] || '问题解决';
}
