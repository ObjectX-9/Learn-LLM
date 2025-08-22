import { NextRequest } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';
import {
  ChatPromptTemplate,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
} from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';

export async function GET(request: NextRequest) {
  console.log('🚀 SSE ChatGPT流式请求开始:', new Date().toISOString());

  const searchParams = request.nextUrl.searchParams;
  const userMessage = searchParams.get('message') || 'Hello, how are you?';
  const systemPrompt =
    searchParams.get('system') ||
    'You are a helpful AI assistant. Respond in a conversational and friendly manner.';
  const temperature = parseFloat(searchParams.get('temperature') || '0.7');
  const modelName = searchParams.get('model') || 'ge-2.5-flash-thinking';

  console.log('📝 用户消息:', userMessage);
  console.log('🤖 模型:', modelName);
  console.log('🌡️ 温度:', temperature);

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      console.log('📡 ChatGPT流ReadableStream开始');

      try {
        // 发送开始状态
        console.log('📤 发送ChatGPT开始状态');
        controller.enqueue(
          encoder.encode('event: status\ndata: 开始AI对话\n\n')
        );

        controller.enqueue(encoder.encode('data: 🤖 正在思考您的问题...\n\n'));

        // 初始化 ChatOpenAI
        const llm = new ChatOpenAI({
          openAIApiKey: process.env.OPEN_API_KEY,
          modelName: modelName,
          temperature: temperature,
          maxTokens: 2000,
          streaming: true,
          configuration: {
            baseURL: process.env.OPEN_API_BASE_URL,
          },
          verbose: true,
        });

        // 创建聊天提示模板
        const chatPrompt = ChatPromptTemplate.fromMessages([
          SystemMessagePromptTemplate.fromTemplate(systemPrompt),
          HumanMessagePromptTemplate.fromTemplate('{userMessage}'),
        ]);

        // 创建处理链
        const chain = chatPrompt.pipe(llm).pipe(new StringOutputParser());

        console.log('🔗 开始流式调用LLM...');

        // 发送状态更新
        controller.enqueue(
          encoder.encode('event: status\ndata: 正在生成回答\n\n')
        );

        // 开始流式调用
        const stream = await chain.stream({
          userMessage: userMessage,
        });

        let totalTokens = 0;
        let responseText = '';
        let chunkCount = 0;

        // 发送开始回答的标记
        controller.enqueue(encoder.encode('data: \n\n'));

        console.log('📤 开始接收LLM流式响应...');

        for await (const chunk of stream) {
          chunkCount++;
          totalTokens += chunk.length;
          responseText += chunk;

          console.log(`📤 发送第${chunkCount}个chunk: "${chunk}"`);

          // 发送流式内容
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`)
          );

          // 每50个chunk发送一次进度
          if (chunkCount % 50 === 0) {
            controller.enqueue(
              encoder.encode(
                `event: progress\ndata: 已生成 ${chunkCount} 个token块\n\n`
              )
            );
          }
        }

        console.log(
          `✅ LLM响应完成，共${chunkCount}个chunks，${totalTokens}个字符`
        );

        // 发送完成状态
        controller.enqueue(
          encoder.encode('event: status\ndata: 回答生成完成\n\n')
        );

        // 发送统计信息
        await new Promise((resolve) => setTimeout(resolve, 500));
        controller.enqueue(
          encoder.encode(
            `data: \n\n📊 对话统计:\n- 生成token块: ${chunkCount}\n- 字符数: ${totalTokens}\n- 模型: ${modelName}\n- 温度: ${temperature}\n\n`
          )
        );

        // 发送完成事件
        controller.enqueue(
          encoder.encode('event: complete\ndata: AI对话完成\n\n')
        );

        console.log('🔚 ChatGPT演示完成，保持连接等待前端关闭');
        // 不主动关闭连接，让前端控制何时关闭
      } catch (error) {
        console.error('❌ SSE ChatGPT处理错误:', error);

        try {
          const errorMessage =
            error instanceof Error ? error.message : '未知错误';
          controller.enqueue(
            encoder.encode(`data: ❌ 生成回答时出错: ${errorMessage}\n\n`)
          );

          controller.enqueue(
            encoder.encode('event: status\ndata: 发生错误\n\n')
          );

          // 如果是API调用相关错误，提供更友好的提示
          if (
            errorMessage.includes('API') ||
            errorMessage.includes('401') ||
            errorMessage.includes('invalid')
          ) {
            controller.enqueue(
              encoder.encode('data: 💡 提示: 请检查API密钥配置是否正确\n\n')
            );
          }
        } catch (closeError) {
          console.error('❌ 发送错误信息时出错:', closeError);
        }
      }
    },

    cancel(reason) {
      console.log('✅ ChatGPT客户端正常关闭连接:', reason?.name || reason);
      // 这是正常的连接关闭，不需要抛出错误
    },
  });

  console.log('📡 返回ChatGPT Response');
  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Cache-Control',
    },
  });
}
