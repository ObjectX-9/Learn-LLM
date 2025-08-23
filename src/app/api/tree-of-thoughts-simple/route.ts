import { NextRequest, NextResponse } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

export interface SimpleToTRequest {
  problem: string;
  numExperts: number;
  maxSteps: number;
  modelName?: string;
  temperature?: number;
  stream?: boolean;
}

export interface SimpleToTResponse {
  problem: string;
  numExperts: number;
  maxSteps: number;
  response: string;
  totalTime: number;
  model: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: SimpleToTRequest = await request.json();
    const {
      problem,
      numExperts = 3,
      maxSteps = 5,
      modelName = 'gpt-3.5-turbo',
      temperature = 0.8,
      stream = false,
    } = body;

    const startTime = Date.now();

    const chatInstance = new ChatOpenAI({
      openAIApiKey: process.env.OPEN_API_KEY,
      modelName,
      temperature,
      maxTokens: 2000,
      configuration: {
        baseURL: process.env.OPEN_API_BASE_URL,
      },
    });

    // 构建简化版ToT提示
    const systemMessage = buildSimpleToTSystemMessage();
    const promptMessage = buildSimpleToTPrompt(problem, numExperts, maxSteps);

    const messages = [
      new SystemMessage(systemMessage),
      new HumanMessage(promptMessage),
    ];

    if (stream) {
      // 流式响应
      const streamResponse = await chatInstance.stream(messages);

      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          try {
            // 发送开始信号
            const startData = `data: ${JSON.stringify({
              type: 'start',
              message: '开始简化版思维树推理...',
              numExperts,
              maxSteps,
            })}\n\n`;
            controller.enqueue(encoder.encode(startData));

            let fullResponse = '';

            for await (const chunk of streamResponse) {
              const content = chunk.content;
              if (content) {
                fullResponse += content;

                // 发送增量内容
                const chunkData = `data: ${JSON.stringify({
                  type: 'chunk',
                  content: content,
                })}\n\n`;
                controller.enqueue(encoder.encode(chunkData));
              }
            }

            const totalTime = Date.now() - startTime;

            // 发送最终结果
            const finalData = `data: ${JSON.stringify({
              type: 'final_result',
              result: {
                problem,
                numExperts,
                maxSteps,
                response: fullResponse,
                totalTime,
                model: modelName,
              },
            })}\n\n`;
            controller.enqueue(encoder.encode(finalData));

            // 发送完成信号
            const doneData = `data: ${JSON.stringify({ type: 'done' })}\n\n`;
            controller.enqueue(encoder.encode(doneData));
            controller.close();
          } catch (error) {
            console.error('Simple ToT Stream Error:', error);
            const errorData = `data: ${JSON.stringify({
              type: 'error',
              error: '简化版思维树推理过程发生错误',
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
      const response = await chatInstance.invoke(messages);
      const totalTime = Date.now() - startTime;

      return NextResponse.json({
        problem,
        numExperts,
        maxSteps,
        response: response.content as string,
        totalTime,
        model: modelName,
      });
    }
  } catch (error) {
    console.error('Simple ToT API Error:', error);
    return NextResponse.json(
      {
        error: '简化版思维树处理时发生错误',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

// 构建简化版ToT系统消息
function buildSimpleToTSystemMessage(): string {
  return `你是一个专业的问题解决专家，擅长运用多角度思维来解决复杂问题。

你的任务是模拟多位专家协作解决问题的过程。每位专家都会：
1. 写下他们思考问题的第一个步骤
2. 与其他专家分享并讨论
3. 基于讨论结果写下下一个步骤
4. 重复这个过程直到得出解决方案

如果发现某位专家的步骤有明显错误，该专家会被淘汰。

请用清晰的格式展示这个协作推理过程。`;
}

// 构建简化版ToT提示
function buildSimpleToTPrompt(
  problem: string,
  numExperts: number,
  maxSteps: number
): string {
  return `假设${numExperts}位不同的专家来回答这个问题：

"${problem}"

请模拟以下过程：

1. 所有专家都写下他们思考这个问题的第一个步骤，然后与大家分享
2. 专家们讨论各自的方法，识别最有前途的思路
3. 所有专家都写下他们思考的下一个步骤并分享
4. 重复步骤2-3，最多进行${maxSteps}轮
5. 只要大家发现有专家的步骤出错了，就让这位专家离开
6. 最终给出最佳解决方案

请详细展示每一轮的思考过程，包括：
- 每位专家的思维步骤
- 专家间的讨论和评估
- 错误步骤的识别和专家的淘汰
- 最终的解决方案

格式要求：
- 用"专家A"、"专家B"等标识不同专家
- 用"第X轮思考"标识每轮
- 用"讨论环节"标识专家间的交流
- 用"最终方案"标识结论`;
}

// 获取简化版ToT示例
export function getSimpleToTExamples(): Record<string, string> {
  return {
    math: '使用数字 4, 1, 8, 7 通过加减乘除运算得到 24',
    logic: '有三个开关控制三盏灯，你只能上楼一次，如何确定哪个开关控制哪盏灯？',
    creative: '设计一个能够同时解决交通拥堵和环境污染问题的城市交通方案',
    reasoning:
      '如果明天下雨，小明就不去公园。如果小明不去公园，他就在家看书。现在小明在踢球，请问明天的天气如何？',
  };
}
