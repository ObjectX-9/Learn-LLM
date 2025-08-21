export async function GET() {
  console.log('🚀 SSE数据流请求开始:', new Date().toISOString());

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      console.log('📡 数据流ReadableStream开始');

      try {
        // 发送状态事件
        console.log('📤 发送数据流初始状态');
        controller.enqueue(
          encoder.encode('event: status\ndata: 开始实时数据推送\n\n')
        );

        console.log('📤 发送数据流第一条消息');
        controller.enqueue(encoder.encode('data: 📊 数据流演示开始！\n\n'));

        // 模拟实时数据推送
        const maxUpdates = 20;

        for (let i = 1; i <= maxUpdates; i++) {
          console.log(`📤 发送数据更新 ${i}/${maxUpdates}`);

          // 生成模拟数据
          const cpuUsage = Math.round(Math.random() * 100);
          const memoryUsage = Math.round(Math.random() * 100);
          const networkSpeed = Math.round(Math.random() * 1000);
          const stockPrice = 100 + Math.sin(i * 0.1) * 20 + Math.random() * 5;
          const userCount = 1000 + Math.round(Math.random() * 500);

          // 发送进度
          const progress = Math.round((i / maxUpdates) * 100);
          controller.enqueue(
            encoder.encode(`event: progress\ndata: ${progress}%\n\n`)
          );

          // 发送系统监控数据
          controller.enqueue(
            encoder.encode(
              `data: 📊 系统监控 - CPU: ${cpuUsage}%, 内存: ${memoryUsage}%, 网络: ${networkSpeed}KB/s\n\n`
            )
          );

          await new Promise((resolve) => setTimeout(resolve, 200));

          // 发送股票数据
          const stockChange = (Math.random() - 0.5) * 2;
          controller.enqueue(
            encoder.encode(
              `data: 💹 股票价格 - DEMO: $${stockPrice.toFixed(2)} ${stockChange > 0 ? '📈' : '📉'}\n\n`
            )
          );

          await new Promise((resolve) => setTimeout(resolve, 200));

          // 发送用户统计
          controller.enqueue(
            encoder.encode(
              `data: 👥 在线用户: ${userCount} 人 ${userCount > 1200 ? '🔥' : ''}\n\n`
            )
          );

          // 每5次发送摘要数据
          if (i % 5 === 0) {
            controller.enqueue(
              encoder.encode(
                `data: 📈 数据摘要 - 更新次数: ${i}, 平均CPU: ${Math.round(Math.random() * 100)}%\n\n`
              )
            );
          }

          await new Promise((resolve) => setTimeout(resolve, 300));
        }

        console.log('📤 发送数据流完成消息');
        controller.enqueue(
          encoder.encode('event: complete\ndata: 数据推送完成\n\n')
        );

        console.log('🔚 数据流演示完成，保持连接等待前端关闭');
        // 不主动关闭连接，让前端控制何时关闭
      } catch (error) {
        console.error('❌ SSE数据流处理错误:', error);

        try {
          controller.enqueue(
            encoder.encode(
              `data: 错误: ${error instanceof Error ? error.message : '未知错误'}\n\n`
            )
          );
        } catch (closeError) {
          console.error('❌ 发送错误信息时出错:', closeError);
        }
      }
    },

    cancel(reason) {
      console.log('✅ 数据流客户端正常关闭连接:', reason?.name || reason);
      // 这是正常的连接关闭，不需要抛出错误
    },
  });

  console.log('📡 返回数据流Response');
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
