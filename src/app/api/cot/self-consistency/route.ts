import { NextRequest, NextResponse } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

export interface SelfConsistencyRequest {
  problem: string;
  systemMessage?: string;
  baseTemperature?: number;
  maxTokens?: number;
  modelName?: string;
  numReasoning?: number; // 推理次数，默认3次
  stream?: boolean;
  difficulty?: 'basic' | 'intermediate' | 'advanced';
  domain?: 'math' | 'logic' | 'reasoning' | 'analysis' | 'general';
  consensusMethod?: 'voting' | 'similarity' | 'confidence'; // 共识方法
}

export interface ReasoningAttempt {
  id: number;
  temperature: number;
  reasoning: string;
  answer: string;
  confidence: number;
  tokens: number;
  duration: number;
}

export interface SelfConsistencyResponse {
  problem: string;
  attempts: ReasoningAttempt[];
  finalAnswer: string;
  consensus: {
    method: string;
    confidence: number;
    agreement: number;
    reasoning: string;
  };
  totalAttempts: number;
  totalTime: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: SelfConsistencyRequest = await request.json();
    const {
      problem,
      systemMessage,
      baseTemperature = 0.7,
      maxTokens = 3000,
      modelName = 'gpt-3.5-turbo',
      numReasoning = 3,
      stream = true,
      difficulty = 'intermediate',
      domain = 'general',
      consensusMethod = 'voting',
    } = body;

    // 构建基础系统消息
    const scSystemMessage =
      systemMessage || buildSelfConsistencySystemMessage(difficulty, domain);

    // 构建CoT提示词
    const cotPrompt = buildCoTPrompt(problem);

    if (stream) {
      // 流式响应 - 逐次展示推理过程
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          try {
            const startTime = Date.now();
            const attempts: ReasoningAttempt[] = [];

            // 发送开始信号
            const startData = `data: ${JSON.stringify({
              type: 'start',
              message: '开始自我一致性推理...',
              totalAttempts: numReasoning,
            })}\n\n`;
            controller.enqueue(encoder.encode(startData));

            // 进行多次独立推理
            for (let i = 0; i < numReasoning; i++) {
              const attemptStartTime = Date.now();

              // 为每次推理使用不同的温度
              const temperature = baseTemperature + (Math.random() - 0.5) * 0.4;

              // 发送当前推理开始信号
              const attemptStartData = `data: ${JSON.stringify({
                type: 'attempt_start',
                attemptId: i + 1,
                temperature: temperature,
                message: `开始第 ${i + 1} 次推理 (温度: ${temperature.toFixed(2)})...`,
              })}\n\n`;
              controller.enqueue(encoder.encode(attemptStartData));

              // 创建消息
              const messages = [
                new SystemMessage(scSystemMessage),
                new HumanMessage(cotPrompt),
              ];

              // 配置模型参数
              const chatInstance = new ChatOpenAI({
                openAIApiKey: process.env.OPEN_API_KEY,
                modelName,
                temperature,
                maxTokens,
                configuration: {
                  baseURL: process.env.OPEN_API_BASE_URL,
                },
              });

              try {
                const response = await chatInstance.invoke(messages);
                const attemptDuration = Date.now() - attemptStartTime;

                // 解析推理结果
                const reasoning = response.content as string;
                const extractedAnswer = extractAnswer(reasoning);
                const confidence = calculateConfidence(reasoning);

                const attempt: ReasoningAttempt = {
                  id: i + 1,
                  temperature,
                  reasoning,
                  answer: extractedAnswer,
                  confidence,
                  tokens: response.usage_metadata?.total_tokens || 0,
                  duration: attemptDuration,
                };

                attempts.push(attempt);

                // 发送推理结果
                const attemptData = `data: ${JSON.stringify({
                  type: 'attempt_complete',
                  attempt: attempt,
                  progress: (((i + 1) / numReasoning) * 100).toFixed(0),
                })}\n\n`;
                controller.enqueue(encoder.encode(attemptData));

                // 添加间隔时间
                await new Promise((resolve) => setTimeout(resolve, 500));
              } catch (error) {
                console.error(`推理尝试 ${i + 1} 失败:`, error);

                const errorData = `data: ${JSON.stringify({
                  type: 'attempt_error',
                  attemptId: i + 1,
                  error: `第 ${i + 1} 次推理失败: ${error instanceof Error ? error.message : '未知错误'}`,
                })}\n\n`;
                controller.enqueue(encoder.encode(errorData));
              }
            }

            // 计算共识
            const consensus = calculateConsensus(attempts, consensusMethod);
            const totalTime = Date.now() - startTime;

            // 发送最终结果
            const finalData = `data: ${JSON.stringify({
              type: 'final_result',
              result: {
                problem,
                attempts,
                finalAnswer: consensus.answer,
                consensus: {
                  method: consensusMethod,
                  confidence: consensus.confidence,
                  agreement: consensus.agreement,
                  reasoning: consensus.reasoning,
                },
                totalAttempts: numReasoning,
                totalTime,
              },
            })}\n\n`;
            controller.enqueue(encoder.encode(finalData));

            // 发送完成信号
            const doneData = `data: ${JSON.stringify({ type: 'done' })}\n\n`;
            controller.enqueue(encoder.encode(doneData));
            controller.close();
          } catch (error) {
            console.error('Self-Consistency Stream Error:', error);
            const errorData = `data: ${JSON.stringify({
              type: 'error',
              error: '自我一致性推理过程发生错误',
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
      const startTime = Date.now();
      const attempts: ReasoningAttempt[] = [];

      // 进行多次独立推理
      for (let i = 0; i < numReasoning; i++) {
        const attemptStartTime = Date.now();
        const temperature = baseTemperature + (Math.random() - 0.5) * 0.4;

        const messages = [
          new SystemMessage(scSystemMessage),
          new HumanMessage(cotPrompt),
        ];

        const chatInstance = new ChatOpenAI({
          openAIApiKey: process.env.OPEN_API_KEY,
          modelName,
          temperature,
          maxTokens,
          configuration: {
            baseURL: process.env.OPEN_API_BASE_URL,
          },
        });

        try {
          const response = await chatInstance.invoke(messages);
          const attemptDuration = Date.now() - attemptStartTime;

          const reasoning = response.content as string;
          const extractedAnswer = extractAnswer(reasoning);
          const confidence = calculateConfidence(reasoning);

          attempts.push({
            id: i + 1,
            temperature,
            reasoning,
            answer: extractedAnswer,
            confidence,
            tokens: response.usage_metadata?.total_tokens || 0,
            duration: attemptDuration,
          });
        } catch (error) {
          console.error(`推理尝试 ${i + 1} 失败:`, error);
        }
      }

      // 计算共识
      const consensus = calculateConsensus(attempts, consensusMethod);
      const totalTime = Date.now() - startTime;

      return NextResponse.json({
        problem,
        attempts,
        finalAnswer: consensus.answer,
        consensus: {
          method: consensusMethod,
          confidence: consensus.confidence,
          agreement: consensus.agreement,
          reasoning: consensus.reasoning,
        },
        totalAttempts: numReasoning,
        totalTime,
        model: modelName,
        difficulty,
        domain,
      });
    }
  } catch (error) {
    console.error('Self-Consistency API Error:', error);
    return NextResponse.json(
      {
        error: '自我一致性推理处理时发生错误',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

function buildSelfConsistencySystemMessage(
  difficulty: string,
  domain: string
): string {
  const difficultyInstructions = {
    basic: '请使用简单直观的推理步骤，确保每一步都容易理解。',
    intermediate: '请提供中等复杂度的推理过程，平衡详细性和简洁性。',
    advanced: '请进行深入的推理分析，可以包含复杂的逻辑链条和多层次思考。',
  };

  const domainInstructions = {
    math: '你是一个数学专家，擅长解决各种数学问题。请按照数学推理的标准步骤进行分析，确保计算准确无误。对于几何问题，请明确写出相关公式，逐步计算，并检查结果的合理性。',
    logic:
      '你是一个逻辑推理专家，擅长分析逻辑关系和推理模式。请使用严格的逻辑推理方法，列出所有可能的情况。',
    reasoning:
      '你是一个推理专家，能够进行多步骤的逻辑推理和分析。请确保推理链条完整，每一步都有充分的依据。',
    analysis:
      '你是一个分析专家，能够深入分析问题的各个方面和层次。请从多个角度全面分析问题。',
    general:
      '你是一个通用问题解决专家，能够处理各种类型的问题。请根据问题类型选择最合适的分析方法。',
  };

  return `${domainInstructions[domain as keyof typeof domainInstructions]} 

使用链式思考（Chain of Thought）方法来解决问题。${difficultyInstructions[difficulty as keyof typeof difficultyInstructions]}

重要提示：这是一次独立的推理尝试，请：
1. 完全独立地分析这个问题，不要受任何先入为主的想法影响
2. 使用你自己的推理路径，可以与其他解法不同
3. 展示完整的思考过程，包括每一步的推理逻辑
4. 最后明确给出你的答案

请严格按照以下格式输出：

【问题分析】
分析问题的核心要求和关键信息

【推理步骤】
逐步进行推理，每一步都要有清晰的逻辑

【最终答案】
明确给出最终结果

确保推理过程独立、完整、逻辑清晰。`;
}

function buildCoTPrompt(problem: string): string {
  return `请独立分析并解决以下问题：

${problem}

请记住：
1. 这是一次独立的推理，使用你自己的思路
2. 展示完整的推理过程
3. 保持逻辑的严谨性
4. 明确给出最终答案`;
}

function extractAnswer(reasoning: string): string {
  // 尝试提取最终答案
  const answerPatterns = [
    /【最终答案】\s*([^【\n]+)/,
    /最终答案[：:]\s*([^【\n]+)/,
    /答案[：:]\s*([^【\n]+)/,
    /结论[：:]\s*([^【\n]+)/,
  ];

  for (const pattern of answerPatterns) {
    const match = reasoning.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  // 如果没有找到明确的答案标记，取最后一段内容
  const lines = reasoning
    .trim()
    .split('\n')
    .filter((line) => line.trim());
  return lines[lines.length - 1] || '无法提取答案';
}

function calculateConfidence(reasoning: string): number {
  // 改进的置信度计算，针对数学计算和推理质量
  let confidence = 0.4; // 降低基础置信度

  // 推理长度因子（适度详细更好，避免过度冗长）
  const reasoningLength = reasoning.length;
  if (reasoningLength > 1500) confidence += 0.15;
  else if (reasoningLength > 800)
    confidence += 0.25; // 最佳长度区间
  else if (reasoningLength > 400) confidence += 0.15;
  else confidence -= 0.1; // 过短的推理扣分

  // 数学计算相关指标
  const hasCalculation = /\d+\.?\d*\s*[×*÷/+-]\s*\d+\.?\d*/.test(reasoning);
  const hasFormula = /π|半径|面积|周长|公式/.test(reasoning);
  const hasVerification = /验证|检查|核对/.test(reasoning);
  const hasUnits = /平方米|m²|平方|面积/.test(reasoning);

  if (hasCalculation) confidence += 0.1;
  if (hasFormula) confidence += 0.1;
  if (hasVerification) confidence += 0.15;
  if (hasUnits) confidence += 0.05;

  // 确定性和不确定性词汇（细化权重）
  const certaintyWords = [
    '明确',
    '显然',
    '确定',
    '肯定',
    '必然',
    '一定',
    '准确',
    '精确',
  ];
  const uncertaintyWords = [
    '可能',
    '也许',
    '大概',
    '估计',
    '猜测',
    '不确定',
    '大约',
    '约等于',
  ];

  let certaintyCount = 0;
  let uncertaintyCount = 0;

  certaintyWords.forEach((word) => {
    if (reasoning.includes(word)) certaintyCount++;
  });

  uncertaintyWords.forEach((word) => {
    if (reasoning.includes(word)) uncertaintyCount++;
  });

  confidence += Math.min(certaintyCount * 0.03, 0.15);
  confidence -= Math.min(uncertaintyCount * 0.04, 0.2);

  // 步骤完整性检查（更细致的评分）
  const hasAnalysis =
    reasoning.includes('分析') || reasoning.includes('【问题分析】');
  const hasSteps =
    reasoning.includes('步骤') || reasoning.includes('【推理步骤】');
  const hasAnswer =
    reasoning.includes('答案') || reasoning.includes('【最终答案】');

  let structureScore = 0;
  if (hasAnalysis) structureScore += 0.05;
  if (hasSteps) structureScore += 0.1;
  if (hasAnswer) structureScore += 0.05;

  confidence += structureScore;

  // 逻辑连贯性（检查逻辑连接词）
  const logicWords = [
    '因为',
    '所以',
    '由于',
    '因此',
    '然后',
    '接下来',
    '综上',
    '根据',
  ];
  const logicCount = logicWords.filter((word) =>
    reasoning.includes(word)
  ).length;
  confidence += Math.min(logicCount * 0.02, 0.1);

  // 错误检测（降低置信度）
  const errorWords = ['错误', '不对', '重新', '修正', '更正'];
  const errorCount = errorWords.filter((word) =>
    reasoning.includes(word)
  ).length;
  confidence -= errorCount * 0.05;

  // 添加基于推理ID的轻微随机性，确保不会完全相同
  const timeBasedRandom = (Date.now() % 100) / 1000; // 0-0.099的变化
  const hashBasedRandom = (reasoning.length % 7) / 100; // 基于内容长度的变化
  confidence += timeBasedRandom + hashBasedRandom - 0.05;

  return Math.max(0.15, Math.min(0.95, confidence));
}

function calculateConsensus(attempts: ReasoningAttempt[], method: string) {
  if (attempts.length === 0) {
    return {
      answer: '无可用推理结果',
      confidence: 0,
      agreement: 0,
      reasoning: '没有成功的推理尝试',
    };
  }

  switch (method) {
    case 'voting':
      return calculateVotingConsensus(attempts);
    case 'similarity':
      return calculateSimilarityConsensus(attempts);
    case 'confidence':
      return calculateConfidenceConsensus(attempts);
    default:
      return calculateVotingConsensus(attempts);
  }
}

function calculateVotingConsensus(attempts: ReasoningAttempt[]) {
  // 计算答案频次
  const answerCounts = new Map<string, number>();
  const answerDetails = new Map<string, ReasoningAttempt[]>();

  attempts.forEach((attempt) => {
    const normalizedAnswer = normalizeAnswer(attempt.answer);
    answerCounts.set(
      normalizedAnswer,
      (answerCounts.get(normalizedAnswer) || 0) + 1
    );

    if (!answerDetails.has(normalizedAnswer)) {
      answerDetails.set(normalizedAnswer, []);
    }
    answerDetails.get(normalizedAnswer)!.push(attempt);
  });

  // 找到得票最多的答案
  let maxVotes = 0;
  let winningAnswer = '';

  answerCounts.forEach((votes, answer) => {
    if (votes > maxVotes) {
      maxVotes = votes;
      winningAnswer = answer;
    }
  });

  const agreement = maxVotes / attempts.length;
  const winningAttempts = answerDetails.get(winningAnswer) || [];
  const avgConfidence =
    winningAttempts.reduce((sum, att) => sum + att.confidence, 0) /
    winningAttempts.length;

  return {
    answer: winningAnswer,
    confidence: avgConfidence * agreement, // 结合置信度和一致性
    agreement,
    reasoning: `通过投票选择：${maxVotes}/${attempts.length} 次推理得出相同答案，一致性 ${(agreement * 100).toFixed(1)}%`,
  };
}

function calculateSimilarityConsensus(attempts: ReasoningAttempt[]) {
  // 简化的相似性计算 - 在实际应用中可能需要更复杂的NLP技术
  let bestAnswer = '';
  let bestScore = 0;
  let bestReasoning = '';

  attempts.forEach((attempt, i) => {
    let similarityScore = 0;

    attempts.forEach((other, j) => {
      if (i !== j) {
        similarityScore += calculateAnswerSimilarity(
          attempt.answer,
          other.answer
        );
      }
    });

    similarityScore = similarityScore / (attempts.length - 1);
    const combinedScore = similarityScore * attempt.confidence;

    if (combinedScore > bestScore) {
      bestScore = combinedScore;
      bestAnswer = attempt.answer;
      bestReasoning = `基于相似性分析，该答案与其他推理结果平均相似度 ${(similarityScore * 100).toFixed(1)}%`;
    }
  });

  return {
    answer: bestAnswer,
    confidence: bestScore,
    agreement: bestScore,
    reasoning: bestReasoning,
  };
}

function calculateConfidenceConsensus(attempts: ReasoningAttempt[]) {
  // 按置信度排序
  const sortedAttempts = [...attempts].sort(
    (a, b) => b.confidence - a.confidence
  );

  // 找出置信度最高的所有答案
  const maxConfidence = sortedAttempts[0].confidence;
  const topAttempts = sortedAttempts.filter(
    (att) => Math.abs(att.confidence - maxConfidence) < 0.01 // 允许1%的误差
  );

  let bestAttempt: ReasoningAttempt;
  let selectionReason = '';

  if (topAttempts.length === 1) {
    // 只有一个最高置信度答案
    bestAttempt = topAttempts[0];
    selectionReason = `唯一最高置信度答案 (${(bestAttempt.confidence * 100).toFixed(1)}%)`;
  } else {
    // 多个相同置信度答案，使用次要标准选择

    // 标准1: 推理时间最短（通常表示思路更清晰）
    const fastestAttempt = topAttempts.reduce((fastest, current) =>
      current.duration < fastest.duration ? current : fastest
    );

    // 标准2: 答案中包含更多数值细节
    const detailedAttempt = topAttempts.reduce((detailed, current) => {
      const currentNumbers = (current.answer.match(/\d+\.?\d*/g) || []).length;
      const detailedNumbers = (detailed.answer.match(/\d+\.?\d*/g) || [])
        .length;
      return currentNumbers > detailedNumbers ? current : detailed;
    });

    // 标准3: 推理编号最小（第一个达到最高置信度）
    const firstAttempt = topAttempts.reduce((first, current) =>
      current.id < first.id ? current : first
    );

    // 综合判断选择最佳答案
    if (fastestAttempt === detailedAttempt) {
      bestAttempt = fastestAttempt;
      selectionReason = `置信度并列最高 (${(maxConfidence * 100).toFixed(1)}%)，选择推理时间最短且细节最丰富的答案`;
    } else if (fastestAttempt.duration < detailedAttempt.duration * 0.8) {
      bestAttempt = fastestAttempt;
      selectionReason = `置信度并列最高 (${(maxConfidence * 100).toFixed(1)}%)，选择推理效率最高的答案 (${fastestAttempt.duration}ms)`;
    } else {
      bestAttempt = detailedAttempt;
      selectionReason = `置信度并列最高 (${(maxConfidence * 100).toFixed(1)}%)，选择数值细节最丰富的答案`;
    }

    // 如果还是无法区分，选择第一个
    if (!bestAttempt) {
      bestAttempt = firstAttempt;
      selectionReason = `置信度并列最高 (${(maxConfidence * 100).toFixed(1)}%)，选择首个达到最高置信度的答案`;
    }
  }

  // 计算与最佳答案相同的尝试比例
  const sameAnswerCount = attempts.filter(
    (att) => normalizeAnswer(att.answer) === normalizeAnswer(bestAttempt.answer)
  ).length;

  const agreement = sameAnswerCount / attempts.length;

  return {
    answer: bestAttempt.answer,
    confidence: bestAttempt.confidence,
    agreement,
    reasoning: `${selectionReason}，${sameAnswerCount}/${attempts.length} 次推理得出相同结果`,
  };
}

function normalizeAnswer(answer: string): string {
  // 标准化答案以便比较
  return answer
    .toLowerCase()
    .replace(/[^\w\s\d]/g, '') // 移除标点符号
    .replace(/\s+/g, ' ') // 标准化空格
    .trim();
}

function calculateAnswerSimilarity(answer1: string, answer2: string): number {
  const norm1 = normalizeAnswer(answer1);
  const norm2 = normalizeAnswer(answer2);

  if (norm1 === norm2) return 1.0;

  // 简单的基于词汇重叠的相似性计算
  const words1 = norm1.split(' ');
  const words2 = norm2.split(' ');

  const intersection = words1.filter((word) => words2.includes(word));
  const unionSet = new Set([...words1, ...words2]);
  const union = Array.from(unionSet);

  return intersection.length / union.length;
}
