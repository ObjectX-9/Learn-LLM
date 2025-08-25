#!/bin/bash

# Next.js + WebSocket 集成服务器启动脚本
echo "🚀 启动 Next.js + WebSocket 集成服务器..."

# 检查并清理端口
PORT=${PORT:-3000}
if lsof -ti:$PORT > /dev/null 2>&1; then
    echo "⚠️ 端口 $PORT 被占用，正在清理..."
    lsof -ti:$PORT | xargs kill -9 2>/dev/null || true
    sleep 2
fi

# 清理之前的服务器进程
pkill -f "node dist/server.js" 2>/dev/null || true
sleep 1

# 检查依赖
if [ ! -d node_modules ]; then
    echo "📦 安装依赖..."
    pnpm install
fi

# 编译TypeScript服务器
echo "🔨 编译 TypeScript 服务器..."
npx tsc ./src/app/api/server/socketServer.ts --target es2020 --module commonjs --outDir ./dist --lib es2020 --moduleResolution node --esModuleInterop true --skipLibCheck true

# 检查编译结果
if [ ! -f dist/socketServer.js ]; then
    echo "❌ TypeScript 编译失败"
    exit 1
fi

echo "✅ 编译完成"

# 启动集成服务器
echo "🎯 启动集成服务器..."
echo "   🌐 HTTP + WebSocket: http://localhost:3000"
echo "   📡 WebSocket 路径: ws://localhost:3000/api/websocket"
echo ""

node dist/socketServer.js 