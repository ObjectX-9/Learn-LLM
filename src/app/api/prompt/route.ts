import { NextRequest, NextResponse } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

export interface PromptTestRequest {
  prompt: string;
  systemMessage?: string;
  temperature?: number;
  maxTokens?: number;
  modelName?: string;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stream?: boolean;
  responseFormat?:
    | 'text'
    | 'json'
    | 'markdown'
    | 'html'
    | 'table'
    | 'code'
    | 'score';
  testType?:
    | 'text-generation'
    | 'role-play'
    | 'data-format'
    | 'translation'
    | 'code-generation'
    | 'qa'
    | 'text-analysis'
    | 'prompt-evaluation';
}

export async function POST(request: NextRequest) {
  try {
    const body: PromptTestRequest = await request.json();
    const {
      prompt,
      systemMessage = '',
      temperature = 0.7,
      maxTokens = 2000,
      modelName = 'gpt-3.5-turbo',
      topP = 1,
      frequencyPenalty = 0,
      presencePenalty = 0,
      stream = true,
      responseFormat = 'text',
      testType = 'text-generation',
    } = body;

    // 根据测试类型和返回格式调整系统消息
    let finalSystemMessage = systemMessage;
    if (!finalSystemMessage) {
      finalSystemMessage = getDefaultSystemMessage(testType, responseFormat);
    }

    // 创建消息
    const messages = [];
    if (finalSystemMessage) {
      messages.push(new SystemMessage(finalSystemMessage));
    }
    messages.push(new HumanMessage(prompt));

    // 配置模型参数
    const chatInstance = new ChatOpenAI({
      openAIApiKey: process.env.OPEN_API_KEY,
      modelName,
      temperature,
      maxTokens,
      topP,
      frequencyPenalty,
      presencePenalty,
      configuration: {
        baseURL: process.env.OPEN_API_BASE_URL,
      },
      verbose: true,
    });

    if (stream) {
      // 流式响应
      const stream = await chatInstance.stream(messages);

      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of stream) {
              const data = `data: ${JSON.stringify({ content: chunk.content, done: false })}\n\n`;
              controller.enqueue(encoder.encode(data));
            }
            const doneData = `data: ${JSON.stringify({ content: '', done: true })}\n\n`;
            controller.enqueue(encoder.encode(doneData));
            controller.close();
          } catch (error) {
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
      const response = await chatInstance.invoke(messages);
      return NextResponse.json({
        content: response.content,
        usage: response.usage_metadata,
        model: modelName,
        testType,
        responseFormat,
      });
    }
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      {
        error: '处理请求时发生错误',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

function getDefaultSystemMessage(
  testType: string,
  responseFormat: string
): string {
  const formatInstructions = {
    json: '请以有效的 JSON 格式返回结果。',
    markdown: '请使用 Markdown 格式返回结果。',
    html: '请使用 HTML 格式返回结果。',
    table: '请以表格格式返回结果。',
    code: '请返回代码，并使用适当的代码块格式。',
    score: '请提供1-10分的评分，并说明评分理由。',
    text: '',
  };

  const typeInstructions = {
    'text-generation':
      '你是一个专业的文本创作助手，擅长生成各种类型的文本内容。',
    'role-play':
      '你将扮演指定的角色，请完全沉浸在角色中，用符合角色身份的语言和行为方式回应。',
    'data-format': '你是一个数据格式化专家，擅长将信息转换为结构化格式。',
    translation:
      '你是一个专业翻译，能够准确翻译各种语言，保持原文的语气和含义。',
    'code-generation':
      '你是一个编程专家，能够生成高质量、可执行的代码，并提供清晰的注释。',
    qa: '你是一个知识渊博的问答助手，能够准确回答各种问题，提供详细的解释。',
    'text-analysis':
      '你是一个文本分析专家，能够深入分析文本的各个方面，包括情感、主题、结构等。',
    'prompt-evaluation':
      '你是一个 Prompt 工程专家，能够评估 Prompt 的质量、有效性和改进建议。',
  };

  const baseInstruction =
    typeInstructions[testType as keyof typeof typeInstructions] || '';
  const formatInstruction =
    formatInstructions[responseFormat as keyof typeof formatInstructions] || '';

  return `${baseInstruction} ${formatInstruction}`.trim();
}
