import { NextRequest, NextResponse } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

export interface CoTRequest {
  problem: string;
  systemMessage?: string;
  temperature?: number;
  maxTokens?: number;
  modelName?: string;
  stream?: boolean;
  showSteps?: boolean;
  difficulty?: 'basic' | 'intermediate' | 'advanced';
  domain?: 'math' | 'logic' | 'reasoning' | 'analysis' | 'general';
}

export interface CoTStep {
  step: number;
  title: string;
  content: string;
  reasoning: string;
}

export interface CoTResponse {
  problem: string;
  steps: CoTStep[];
  finalAnswer: string;
  totalSteps: number;
  reasoning_time?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: CoTRequest = await request.json();
    const {
      problem,
      systemMessage,
      temperature = 0.3, // 降低温度以获得更一致的推理
      maxTokens = 3000,
      modelName = 'gpt-3.5-turbo',
      stream = true,
      showSteps = true,
      difficulty = 'intermediate',
      domain = 'general',
    } = body;

    // 构建CoT系统消息
    const cotSystemMessage =
      systemMessage || buildCoTSystemMessage(difficulty, domain, showSteps);

    // 构建CoT提示词
    const cotPrompt = buildCoTPrompt(problem, showSteps);

    // 创建消息
    const messages = [
      new SystemMessage(cotSystemMessage),
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
      verbose: true,
    });

    if (stream) {
      // 流式响应 - 逐步展示思考过程
      const streamResponse = await chatInstance.stream(messages);

      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          try {
            let buffer = '';
            let stepCount = 0;
            let currentStep = '';
            let isInStep = false;

            for await (const chunk of streamResponse) {
              buffer += chunk.content;

              // 检测步骤标记
              if (
                buffer.includes('【步骤') ||
                buffer.includes('【Step') ||
                buffer.includes('## 步骤')
              ) {
                isInStep = true;
                stepCount++;
              }

              // 发送当前内容
              const data = `data: ${JSON.stringify({
                content: chunk.content,
                buffer: buffer,
                currentStep: stepCount,
                isInStep: isInStep,
                done: false,
              })}\n\n`;
              controller.enqueue(encoder.encode(data));

              // 模拟思考间隔
              await new Promise((resolve) => setTimeout(resolve, 50));
            }

            // 发送完成标记
            const doneData = `data: ${JSON.stringify({
              content: '',
              buffer: buffer,
              currentStep: stepCount,
              done: true,
            })}\n\n`;
            controller.enqueue(encoder.encode(doneData));
            controller.close();
          } catch (error) {
            console.error('CoT Stream Error:', error);
            controller.error(error);
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
      const response = await chatInstance.invoke(messages);
      const endTime = Date.now();

      // 解析响应为结构化步骤
      const parsedResult = parseCoTResponse(
        response.content as string,
        problem
      );

      return NextResponse.json({
        ...parsedResult,
        reasoning_time: endTime - startTime,
        model: modelName,
        difficulty,
        domain,
      });
    }
  } catch (error) {
    console.error('CoT API Error:', error);
    return NextResponse.json(
      {
        error: '链式思考处理时发生错误',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

function buildCoTSystemMessage(
  difficulty: string,
  domain: string,
  showSteps: boolean
): string {
  const difficultyInstructions = {
    basic: '请使用简单直观的推理步骤，确保每一步都容易理解。',
    intermediate: '请提供中等复杂度的推理过程，平衡详细性和简洁性。',
    advanced: '请进行深入的推理分析，可以包含复杂的逻辑链条和多层次思考。',
  };

  const domainInstructions = {
    math: '你是一个数学专家，擅长解决各种数学问题。请按照数学推理的标准步骤进行分析。',
    logic: '你是一个逻辑推理专家，擅长分析逻辑关系和推理模式。',
    reasoning: '你是一个推理专家，能够进行多步骤的逻辑推理和分析。',
    analysis: '你是一个分析专家，能够深入分析问题的各个方面和层次。',
    general: '你是一个通用问题解决专家，能够处理各种类型的问题。',
  };

  const stepFormat = showSteps
    ? `

请严格按照以下格式输出：

【问题理解】
首先分析和理解问题的核心要求

【步骤1：分析阶段】
详细分析问题的关键信息和约束条件

【步骤2：方法选择】
选择合适的解决方法并说明理由

【步骤3：具体推理】
进行具体的推理计算或逻辑分析

【步骤N：...】
（继续添加必要的推理步骤）

【最终答案】
明确给出最终结果和结论

每个步骤都要包含：
1. 这一步在做什么
2. 为什么这样做
3. 得到了什么结果或结论`
    : '';

  return `${domainInstructions[domain as keyof typeof domainInstructions]} 

使用链式思考（Chain of Thought）方法来解决问题。${difficultyInstructions[difficulty as keyof typeof difficultyInstructions]}

核心原则：
1. 将复杂问题分解为简单步骤
2. 每一步都要有清晰的推理逻辑
3. 展示完整的思考过程
4. 确保每一步都基于前一步的结果
5. 最后给出明确的答案

${stepFormat}`;
}

function buildCoTPrompt(problem: string, showSteps: boolean): string {
  const instruction = showSteps
    ? '请使用链式思考方法，逐步分析并解决以下问题。请展示你的完整思考过程：'
    : '请解决以下问题：';

  return `${instruction}

${problem}

请记住：
1. 思考要有逻辑性和连贯性
2. 每一步都要基于前面的分析
3. 保持推理的严谨性
4. 最后给出明确的答案`;
}

function parseCoTResponse(
  content: string,
  originalProblem: string
): CoTResponse {
  const steps: CoTStep[] = [];
  let finalAnswer = '';

  // 简单的步骤解析逻辑
  const stepMatches = content.match(/【步骤\d+[：:][^】]*】/g) || [];
  const stepSections = content.split(/【步骤\d+[：:][^】]*】/);

  stepMatches.forEach((stepTitle, index) => {
    if (stepSections[index + 1]) {
      const stepContent = stepSections[index + 1].trim();
      steps.push({
        step: index + 1,
        title: stepTitle.replace(/[【】]/g, ''),
        content: stepContent.split('\n')[0] || stepContent,
        reasoning: stepContent,
      });
    }
  });

  // 提取最终答案
  const finalAnswerMatch = content.match(/【最终答案】([\s\S]*?)(?=【|$)/);
  if (finalAnswerMatch) {
    finalAnswer = finalAnswerMatch[1].trim();
  } else {
    // 如果没有明确的最终答案标记，取最后一段内容
    const lastSection = stepSections[stepSections.length - 1];
    finalAnswer = lastSection ? lastSection.trim() : '处理中...';
  }

  return {
    problem: originalProblem,
    steps,
    finalAnswer,
    totalSteps: steps.length,
  };
}
