import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  console.log('🚀 SSE请求开始:', new Date().toISOString());

  const searchParams = request.nextUrl.searchParams;
  const customMessage = searchParams.get('message') || '默认的流式文本输出演示';

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      console.log('📡 ReadableStream开始');

      try {
        // 立即发送第一条消息
        console.log('📤 发送初始状态消息');
        controller.enqueue(
          encoder.encode('event: status\ndata: 开始文本流式输出\n\n')
        );

        console.log('📤 发送第一条数据消息');
        controller.enqueue(encoder.encode('data: 🎉 SSE连接建立成功！\n\n'));

        // 简单的计数器演示
        for (let i = 1; i <= 10; i++) {
          console.log(`📤 发送第${i}条消息`);

          // 发送进度
          controller.enqueue(
            encoder.encode(`event: progress\ndata: ${i * 10}%\n\n`)
          );

          // 发送数据
          controller.enqueue(
            encoder.encode(
              `data: 消息 ${i}: ${customMessage} - 计数器: ${i}\n\n`
            )
          );

          // 延迟500ms
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        console.log('📤 发送完成消息');
        controller.enqueue(
          encoder.encode('event: complete\ndata: 演示完成\n\n')
        );

        console.log('🔚 演示完成，保持连接等待前端关闭');
        // 不主动关闭连接，让前端控制何时关闭
        // 这样可以避免EventSource的自动重连机制
      } catch (error) {
        console.error('❌ SSE处理错误:', error);

        try {
          controller.enqueue(
            encoder.encode(
              `data: 错误: ${error instanceof Error ? error.message : '未知错误'}\n\n`
            )
          );
          controller.close();
        } catch (closeError) {
          console.error('❌ 关闭Controller时出错:', closeError);
        }
      }
    },

    cancel(reason) {
      console.log('✅ 客户端正常关闭连接:', reason?.name || reason);
      // 这是正常的连接关闭，不需要抛出错误
    },
  });

  console.log('📡 返回Response');
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
