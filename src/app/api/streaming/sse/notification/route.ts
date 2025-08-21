export async function GET() {
  console.log('🚀 SSE通知推送请求开始:', new Date().toISOString());

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      console.log('📡 通知推送ReadableStream开始');

      try {
        // 发送状态事件
        console.log('📤 发送通知推送初始状态');
        controller.enqueue(
          encoder.encode('event: status\ndata: 开始通知推送服务\n\n')
        );

        console.log('📤 发送通知推送第一条消息');
        controller.enqueue(encoder.encode('data: 🔔 通知推送演示开始！\n\n'));

        // 模拟各种通知类型
        const notifications = [
          {
            type: 'info',
            icon: '💡',
            title: '系统提示',
            message: '欢迎使用SSE通知系统',
          },
          {
            type: 'success',
            icon: '✅',
            title: '操作成功',
            message: '用户登录成功',
          },
          {
            type: 'warning',
            icon: '⚠️',
            title: '系统警告',
            message: 'CPU使用率超过80%',
          },
          {
            type: 'message',
            icon: '💬',
            title: '新消息',
            message: '您有一条新的私信',
          },
          {
            type: 'order',
            icon: '🛒',
            title: '订单更新',
            message: '订单 #12345 已发货',
          },
          {
            type: 'security',
            icon: '🔐',
            title: '安全提醒',
            message: '检测到异地登录',
          },
          {
            type: 'system',
            icon: '⚙️',
            title: '系统维护',
            message: '系统将在2小时后维护',
          },
          {
            type: 'promotion',
            icon: '🎉',
            title: '优惠活动',
            message: '限时优惠，立减50元',
          },
          {
            type: 'friend',
            icon: '👥',
            title: '好友动态',
            message: '张三给您点了个赞',
          },
          {
            type: 'update',
            icon: '🔄',
            title: '应用更新',
            message: '发现新版本v2.1.0',
          },
          {
            type: 'backup',
            icon: '💾',
            title: '备份完成',
            message: '数据备份已完成',
          },
          {
            type: 'error',
            icon: '❌',
            title: '错误报告',
            message: '检测到3个错误需要处理',
          },
        ];

        const totalNotifications = notifications.length;

        for (let i = 0; i < totalNotifications; i++) {
          const notification = notifications[i];
          console.log(
            `📤 发送通知 ${i + 1}/${totalNotifications}: ${notification.title}`
          );

          // 发送进度更新
          const progress = Math.round(((i + 1) / totalNotifications) * 100);
          controller.enqueue(
            encoder.encode(`event: progress\ndata: ${progress}%\n\n`)
          );

          // 发送通知状态
          controller.enqueue(
            encoder.encode(
              `event: status\ndata: 推送${notification.type}类型通知\n\n`
            )
          );

          // 发送通知内容
          const notificationMessage = `${notification.icon} ${notification.title}: ${notification.message}`;
          controller.enqueue(
            encoder.encode(`data: ${notificationMessage}\n\n`)
          );

          // 根据通知类型添加额外信息
          await new Promise((resolve) => setTimeout(resolve, 300));

          switch (notification.type) {
            case 'security':
              controller.enqueue(
                encoder.encode(
                  `data: 🔍 详细信息: IP地址 192.168.1.100, 设备类型: iPhone\n\n`
                )
              );
              break;
            case 'order':
              controller.enqueue(
                encoder.encode(
                  `data: 📦 物流信息: 预计3天内送达，快递单号: SF1234567890\n\n`
                )
              );
              break;
            case 'warning':
              controller.enqueue(
                encoder.encode(
                  `data: 📊 当前CPU: 85%, 内存: 72%, 建议释放部分资源\n\n`
                )
              );
              break;
            case 'message':
              controller.enqueue(
                encoder.encode(
                  `data: 👤 发送者: 李四, 时间: ${new Date().toLocaleTimeString()}\n\n`
                )
              );
              break;
            case 'promotion':
              controller.enqueue(
                encoder.encode(
                  `data: ⏰ 活动截止: ${new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString()}\n\n`
                )
              );
              break;
          }

          // 随机延迟，模拟真实通知场景
          const delay = 800 + Math.random() * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }

        console.log('📤 发送通知推送完成消息');
        controller.enqueue(
          encoder.encode('event: complete\ndata: 所有通知推送完成\n\n')
        );

        // 发送总结
        await new Promise((resolve) => setTimeout(resolve, 500));
        controller.enqueue(
          encoder.encode(
            `data: 📝 通知推送总结 - 共发送 ${totalNotifications} 条通知\n\n`
          )
        );

        console.log('🔚 通知推送演示完成，保持连接等待前端关闭');
        // 不主动关闭连接，让前端控制何时关闭
      } catch (error) {
        console.error('❌ SSE通知推送处理错误:', error);

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
      console.log('✅ 通知推送客户端正常关闭连接:', reason?.name || reason);
      // 这是正常的连接关闭，不需要抛出错误
    },
  });

  console.log('📡 返回通知推送Response');
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
