import { NextRequest, NextResponse } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';

// CoT 请求接口
export interface CoTRequest {
  question: string;
  context?: string;
  complexity?: 'simple' | 'medium' | 'complex';
  domain?: string;
  temperature?: number;
  maxTokens?: number;
  modelName?: string;
  stream?: boolean;
  showSteps?: boolean;
}

// CoT 响应接口
export interface CoTResponse {
  question: string;
  analysis: string;
  reasoning_steps: string[];
  conclusion: string;
  confidence: number;
  total_steps: number;
  execution_time?: number;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();

    // 兼容PromptTestBase的请求格式
    const question = body.question || body.prompt;
    const context = body.context || '';
    const complexity = body.complexity || 'medium';
    const domain = body.domain || '通用';
    const temperature = body.temperature || 0.3;
    const maxTokens = body.maxTokens || 2000;
    const modelName = body.modelName || 'gpt-4';
    const stream = body.stream || false;

    // 验证输入
    if (!question || question.trim().length === 0) {
      return NextResponse.json({ error: '问题不能为空' }, { status: 400 });
    }

    // 创建 ChatOpenAI 实例
    const llm = new ChatOpenAI({
      openAIApiKey: process.env.OPEN_API_KEY,
      modelName,
      temperature,
      maxTokens,
      configuration: {
        baseURL: process.env.OPEN_API_BASE_URL,
      },
      timeout: 30000,
    });

    if (stream) {
      // 真正的流式响应处理
      return await createStreamingResponse(
        llm,
        question,
        context,
        complexity,
        domain
      );
    } else {
      // 非流式响应
      const result = await performCoTReasoning(
        llm,
        question,
        context,
        complexity,
        domain
      );
      const executionTime = Date.now() - startTime;

      return NextResponse.json({
        ...result,
        execution_time: executionTime,
      });
    }
  } catch (error) {
    console.error('CoT API Error:', error);
    return NextResponse.json(
      {
        error: '处理链式思考请求时发生错误',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

// 创建真正的流式响应
async function createStreamingResponse(
  llm: ChatOpenAI,
  question: string,
  context: string,
  complexity: string,
  domain: string
) {
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        console.log('=== 开始链式思考推理流程 ===');
        console.log('参数:', { question, context, complexity, domain });

        // 发送开始信息
        const startMsg = {
          content: `# 🧠 链式思考推理\n\n## 📋 原问题\n${question}\n\n`,
          done: false,
        };
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(startMsg)}\n\n`)
        );

        // 步骤1：问题分析
        console.log('=== 步骤1: 问题分析 ===');
        await streamAnalysis(
          controller,
          encoder,
          llm,
          question,
          context,
          complexity,
          domain
        );
        console.log('问题分析步骤完成');

        // 步骤2：逐步推理
        console.log('=== 步骤2: 逐步推理 ===');
        const analysisResult = await streamReasoning(
          controller,
          encoder,
          llm,
          question,
          complexity,
          domain
        );
        console.log('逐步推理步骤完成');

        // 步骤3：结论总结
        console.log('=== 步骤3: 结论总结 ===');
        await streamConclusion(
          controller,
          encoder,
          llm,
          question,
          analysisResult
        );
        console.log('结论总结步骤完成');

        // 发送完成信息
        const completionMsg = {
          content: `\n\n✅ **推理完成**`,
          done: true,
        };
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(completionMsg)}\n\n`)
        );

        console.log('=== 链式思考推理流程全部完成 ===');
        controller.close();
      } catch (error) {
        console.error('=== 链式思考推理流程出现错误 ===', error);

        const errorMsg = {
          content: `\n\n❌ **处理过程中出现错误**: ${error instanceof Error ? error.message : '未知错误'}\n\n请检查网络连接和API配置，或稍后重试。`,
          done: true,
        };
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(errorMsg)}\n\n`)
        );
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
}

// 流式问题分析
async function streamAnalysis(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  llm: ChatOpenAI,
  question: string,
  context: string,
  complexity: string,
  domain: string
) {
  controller.enqueue(
    encoder.encode(
      `data: ${JSON.stringify({
        content: '## 🔍 问题分析\n',
        done: false,
      })}\n\n`
    )
  );

  try {
    console.log('开始问题分析...', { question, domain, complexity });

    const analysisPrompt = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(`
你是一个专业的{domain}领域分析师。请简洁地分析这个问题：

要求：
1. 识别问题的核心要素（1-2句话）
2. 确定推理方法（1句话）
3. 预估步骤数量（根据{complexity}级别）

请用中文回答，简洁明了。
      `),
      HumanMessagePromptTemplate.fromTemplate(`
上下文：{context}
问题：{question}

请分析这个问题。
      `),
    ]);

    const chain = analysisPrompt.pipe(llm).pipe(new StringOutputParser());

    console.log('正在调用LLM进行问题分析...');

    // 添加超时处理
    const streamPromise = chain.stream({
      question,
      context: context || '无特定上下文',
      complexity,
      domain,
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('问题分析超时')), 15000); // 15秒超时
    });

    const stream = await Promise.race([streamPromise, timeoutPromise]);

    console.log('LLM响应成功，开始处理流式数据...');

    let chunkCount = 0;
    for await (const chunk of stream) {
      chunkCount++;
      console.log(`收到第${chunkCount}个chunk:`, chunk);

      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            content: chunk,
            done: false,
          })}\n\n`
        )
      );
    }

    console.log(`问题分析完成，共处理${chunkCount}个chunks`);

    controller.enqueue(
      encoder.encode(
        `data: ${JSON.stringify({
          content: '\n\n',
          done: false,
        })}\n\n`
      )
    );
  } catch (error) {
    console.error('问题分析出错:', error);

    // 发送错误信息
    controller.enqueue(
      encoder.encode(
        `data: ${JSON.stringify({
          content: `❌ 问题分析失败: ${error instanceof Error ? error.message : '未知错误'}\n\n`,
          done: false,
        })}\n\n`
      )
    );

    throw error; // 重新抛出错误让上层处理
  }
}

// 流式逐步推理
async function streamReasoning(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  llm: ChatOpenAI,
  question: string,
  complexity: string,
  domain: string
): Promise<string> {
  controller.enqueue(
    encoder.encode(
      `data: ${JSON.stringify({
        content: '## 🧠 推理过程\n',
        done: false,
      })}\n\n`
    )
  );

  try {
    const stepCount =
      complexity === 'simple' ? 2 : complexity === 'medium' ? 4 : 6;

    console.log('开始逐步推理...', { question, domain, complexity, stepCount });

    const reasoningPrompt = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(`
你是一个逻辑推理专家。请对这个{domain}问题进行{stepCount}步逐步推理。

格式要求：
**步骤1**: [第一步分析]
**步骤2**: [第二步分析]
...

每步要简洁有力，逻辑清晰。
      `),
      HumanMessagePromptTemplate.fromTemplate(`
问题：{question}

请进行逐步推理。
      `),
    ]);

    const chain = reasoningPrompt.pipe(llm).pipe(new StringOutputParser());

    console.log('正在调用LLM进行逐步推理...');

    // 添加超时处理
    const streamPromise = chain.stream({
      question,
      domain,
      stepCount,
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('逐步推理超时')), 45000); // 45秒超时
    });

    const stream = await Promise.race([streamPromise, timeoutPromise]);

    console.log('推理LLM响应成功，开始处理流式数据...');

    let fullReasoning = '';
    let chunkCount = 0;
    for await (const chunk of stream) {
      chunkCount++;
      console.log(`推理第${chunkCount}个chunk:`, chunk);

      fullReasoning += chunk;
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            content: chunk,
            done: false,
          })}\n\n`
        )
      );
    }

    console.log(`逐步推理完成，共处理${chunkCount}个chunks`);

    controller.enqueue(
      encoder.encode(
        `data: ${JSON.stringify({
          content: '\n\n',
          done: false,
        })}\n\n`
      )
    );

    return fullReasoning;
  } catch (error) {
    console.error('逐步推理出错:', error);

    // 发送错误信息
    controller.enqueue(
      encoder.encode(
        `data: ${JSON.stringify({
          content: `❌ 推理过程失败: ${error instanceof Error ? error.message : '未知错误'}\n\n`,
          done: false,
        })}\n\n`
      )
    );

    throw error;
  }
}

// 流式结论总结
async function streamConclusion(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  llm: ChatOpenAI,
  question: string,
  reasoning: string
) {
  controller.enqueue(
    encoder.encode(
      `data: ${JSON.stringify({
        content: '## 🎯 最终结论\n',
        done: false,
      })}\n\n`
    )
  );

  try {
    console.log('开始结论总结...', { question });

    const conclusionPrompt = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(`
基于推理过程，请给出简洁的最终结论。

要求：
1. 明确的答案
2. 简要总结推理要点
3. 可信度评估(1-10分)

请用中文回答，格式清晰。
      `),
      HumanMessagePromptTemplate.fromTemplate(`
问题：{question}
推理过程：{reasoning}

请给出最终结论。
      `),
    ]);

    const chain = conclusionPrompt.pipe(llm).pipe(new StringOutputParser());

    console.log('正在调用LLM进行结论总结...');

    // 添加超时处理
    const streamPromise = chain.stream({
      question,
      reasoning,
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('结论总结超时')), 15000); // 15秒超时
    });

    const stream = await Promise.race([streamPromise, timeoutPromise]);

    console.log('结论LLM响应成功，开始处理流式数据...');

    let chunkCount = 0;
    for await (const chunk of stream) {
      chunkCount++;
      console.log(`结论第${chunkCount}个chunk:`, chunk);

      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            content: chunk,
            done: false,
          })}\n\n`
        )
      );
    }

    console.log(`结论总结完成，共处理${chunkCount}个chunks`);
  } catch (error) {
    console.error('结论总结出错:', error);

    // 发送错误信息
    controller.enqueue(
      encoder.encode(
        `data: ${JSON.stringify({
          content: `❌ 结论总结失败: ${error instanceof Error ? error.message : '未知错误'}\n\n`,
          done: false,
        })}\n\n`
      )
    );

    throw error;
  }
}

// 非流式推理处理（简化版本）
async function performCoTReasoning(
  llm: ChatOpenAI,
  question: string,
  context: string,
  complexity: string,
  domain: string
): Promise<CoTResponse> {
  // 简化的单步推理
  const prompt = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(`
你是一个{domain}领域的专家。请对以下问题进行链式思考推理：

1. 首先分析问题的核心要素
2. 然后逐步推理，每个步骤要有清晰的逻辑
3. 最后得出结论并评估可信度(1-10分)

请用中文回答，使用以下格式：
**问题分析**: [分析问题类型和关键要素]
**推理步骤**: 
**步骤1**: [第一步推理]
**步骤2**: [第二步推理]
...
**最终结论**: [明确的答案]
**可信度评估**: [1-10分及理由]
    `),
    HumanMessagePromptTemplate.fromTemplate(`
上下文：{context}
复杂度：{complexity}
问题：{question}

请进行链式思考推理。
    `),
  ]);

  const chain = prompt.pipe(llm).pipe(new StringOutputParser());
  const fullResponse = await chain.invoke({
    question,
    context: context || '无特定上下文',
    complexity,
    domain,
  });

  // 简单解析
  const analysisMatch = fullResponse.match(
    /\*\*问题分析\*\*:\s*([\s\S]*?)(?=\*\*推理步骤\*\*|$)/
  );
  const analysis = analysisMatch ? analysisMatch[1].trim() : '分析结果';

  const reasoning_steps = extractReasoningSteps(fullResponse);
  const confidence = extractConfidence(fullResponse);

  return {
    question,
    analysis,
    reasoning_steps,
    conclusion: fullResponse,
    confidence,
    total_steps: reasoning_steps.length,
  };
}

// 提取推理步骤
function extractReasoningSteps(reasoning: string): string[] {
  const steps: string[] = [];
  const stepPattern = /\*\*步骤 \d+\*\*:[\s\S]*?(?=\*\*步骤 \d+\*\*:|$)/g;
  const stepMatches = reasoning.match(stepPattern);

  if (stepMatches) {
    stepMatches.forEach((step) => {
      steps.push(step.trim());
    });
  } else {
    // 如果没有匹配到标准格式，按段落分割
    const paragraphs = reasoning.split('\n\n').filter((p) => p.trim());
    steps.push(...paragraphs);
  }

  return steps;
}

// 提取可信度分数
function extractConfidence(conclusion: string): number {
  const confidenceMatch = conclusion.match(/可信度评估.*?(\d+)/);
  return confidenceMatch ? parseInt(confidenceMatch[1]) : 7;
}
