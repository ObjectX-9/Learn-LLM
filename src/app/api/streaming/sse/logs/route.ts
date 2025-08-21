export async function GET() {
  console.log('🚀 SSE日志流请求开始:', new Date().toISOString());

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      console.log('📡 日志流ReadableStream开始');

      try {
        // 发送状态事件
        console.log('📤 发送日志流初始状态');
        controller.enqueue(
          encoder.encode('event: status\ndata: 开始实时日志流\n\n')
        );

        // 发送初始系统信息
        console.log('📤 发送系统启动信息');
        controller.enqueue(
          encoder.encode(
            `data: 🚀 系统启动完成 - Node.js v18.0.0, 内存: 512MB\n\n`
          )
        );

        await new Promise((resolve) => setTimeout(resolve, 500));

        controller.enqueue(
          encoder.encode(`data: 🔧 服务注册 - 已注册 5 个微服务\n\n`)
        );

        await new Promise((resolve) => setTimeout(resolve, 500));

        controller.enqueue(encoder.encode('data: 📋 日志流演示开始！\n\n'));

        // 模拟不同类型的日志
        const logLevels = ['INFO', 'WARN', 'ERROR', 'DEBUG', 'TRACE'];
        const services = [
          'auth-service',
          'user-service',
          'payment-service',
          'notification-service',
          'api-gateway',
        ];
        const operations = [
          '用户登录',
          '订单创建',
          '支付处理',
          '数据库查询',
          '缓存更新',
          '文件上传',
          '邮件发送',
          '第三方API调用',
          '数据备份',
          '系统监控',
        ];

        const maxLogs = 25;

        for (let i = 1; i <= maxLogs; i++) {
          console.log(`📤 生成日志 ${i}/${maxLogs}`);

          const level = logLevels[Math.floor(Math.random() * logLevels.length)];
          const service = services[Math.floor(Math.random() * services.length)];
          const operation =
            operations[Math.floor(Math.random() * operations.length)];
          const timestamp = new Date().toISOString();
          const requestId = Math.random().toString(36).substr(2, 9);

          let message = '';
          let icon = '';

          switch (level) {
            case 'INFO':
              message = `${operation}成功`;
              icon = '💙';
              break;
            case 'WARN':
              message = `${operation}响应时间较长`;
              icon = '⚠️';
              break;
            case 'ERROR':
              message = `${operation}失败`;
              icon = '❌';
              break;
            case 'DEBUG':
              message = `${operation}调试信息`;
              icon = '🔍';
              break;
            case 'TRACE':
              message = `${operation}追踪信息`;
              icon = '📝';
              break;
          }

          // 发送进度更新
          const progress = Math.round((i / maxLogs) * 100);
          controller.enqueue(
            encoder.encode(`event: progress\ndata: ${progress}%\n\n`)
          );

          // 格式化日志输出
          const logMessage = `${icon} [${timestamp}] [${level}] [${service}] ${message} (RequestID: ${requestId})`;

          controller.enqueue(encoder.encode(`data: ${logMessage}\n\n`));

          // 根据日志级别添加额外信息
          await new Promise((resolve) => setTimeout(resolve, 200));

          if (level === 'ERROR') {
            controller.enqueue(
              encoder.encode(
                `data: 🔧 Stack Trace: at ${service}.process(line:42) -> database.query(line:15)\n\n`
              )
            );
          } else if (level === 'WARN') {
            controller.enqueue(
              encoder.encode(
                `data: ⏱️ 响应时间: ${500 + Math.round(Math.random() * 2000)}ms (正常范围: <500ms)\n\n`
              )
            );
          } else if (level === 'INFO' && Math.random() > 0.7) {
            controller.enqueue(
              encoder.encode(
                `data: 📈 系统状态: CPU使用率 ${Math.round(Math.random() * 100)}%, 内存使用率 ${Math.round(Math.random() * 100)}%\n\n`
              )
            );
          }

          // 偶尔发送系统指标
          if (i % 5 === 0) {
            await new Promise((resolve) => setTimeout(resolve, 300));
            controller.enqueue(
              encoder.encode(
                `data: 📊 系统指标 - 活跃连接: ${Math.round(Math.random() * 1000)}, QPS: ${Math.round(Math.random() * 500)}\n\n`
              )
            );
          }

          // 随机延迟，模拟真实日志产生的时间间隔
          const delay = 300 + Math.random() * 500;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }

        console.log('📤 发送日志流完成消息');
        controller.enqueue(
          encoder.encode('event: complete\ndata: 日志流结束\n\n')
        );

        // 发送日志统计
        await new Promise((resolve) => setTimeout(resolve, 500));
        controller.enqueue(
          encoder.encode(`data: 📊 日志统计 - 共生成 ${maxLogs} 条日志记录\n\n`)
        );

        console.log('🔚 日志流演示完成，保持连接等待前端关闭');
        // 不主动关闭连接，让前端控制何时关闭
      } catch (error) {
        console.error('❌ SSE日志流处理错误:', error);

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
      console.log('✅ 日志流客户端正常关闭连接:', reason?.name || reason);
      // 这是正常的连接关闭，不需要抛出错误
    },
  });

  console.log('📡 返回日志流Response');
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
