# WebSocket 部署方式对比

本项目提供了两种 WebSocket 部署方式，您可以根据需求选择最适合的方案。

## 🏗️ 部署方式对比

### 方式1：集成部署（推荐）

**架构：** Next.js + WebSocket 在同一进程中
```
端口 3000: Next.js 前端 + API + WebSocket
```

**优点：**
- ✅ 统一管理和部署
- ✅ 共享环境变量和配置
- ✅ 无跨域问题
- ✅ 单一端口，便于部署
- ✅ 资源共享，内存效率更高

**缺点：**
- ❌ WebSocket 和 HTTP 服务耦合
- ❌ 扩展性相对较低

**适用场景：**
- 中小型项目
- 开发和测试环境
- 简单的实时功能
- 单机部署

### 方式2：分离部署

**架构：** Next.js 和 WebSocket 分别运行
```
端口 3000: Next.js 前端 + API
端口 3001: 独立 WebSocket 服务器
```

**优点：**
- ✅ 服务解耦，独立扩展
- ✅ 可以使用不同技术栈
- ✅ 资源隔离
- ✅ 更好的容错性

**缺点：**
- ❌ 需要管理多个服务
- ❌ 可能存在跨域问题
- ❌ 配置相对复杂

**适用场景：**
- 大型项目
- 生产环境
- 高并发场景
- 微服务架构

## 🚀 快速开始

### 集成部署使用方法

1. **启动集成服务器**
   ```bash
   # 方法1：使用启动脚本（推荐）
   ./start-integrated.sh
   
   # 方法2：使用 npm 脚本
   npm run start:integrated
   
   # 方法3：开发模式
   npm run dev:integrated
   ```

2. **访问应用**
   - 前端：http://localhost:3000
   - WebSocket页面：http://localhost:3000/streaming/socket
   - WebSocket连接：ws://localhost:3000/api/websocket

3. **配置环境变量**
   ```env
   OPEN_API_KEY=your_openai_api_key_here
   OPEN_API_BASE_URL=https://api.openai.com/v1
   PORT=3000
   ```

### 分离部署使用方法

1. **启动 WebSocket 服务器**
   ```bash
   cd src/app/api/streaming/socket
   ./start-server.sh
   ```

2. **启动 Next.js 应用**
   ```bash
   # 在项目根目录
   npm run dev
   ```

3. **访问应用**
   - 前端：http://localhost:3000
   - WebSocket页面：http://localhost:3000/streaming/socket
   - WebSocket服务器：ws://localhost:3001

4. **修改前端连接地址**
   
   编辑 `src/app/streaming/socket/page.tsx`：
   ```typescript
   // 改为分离模式的连接地址
   const wsUrl = 'ws://localhost:3001';
   ```

## 📊 功能特性对比

| 特性 | 集成部署 | 分离部署 |
|------|----------|----------|
| 部署复杂度 | 低 | 中 |
| 运维复杂度 | 低 | 中 |
| 资源利用率 | 高 | 中 |
| 扩展性 | 中 | 高 |
| 容错性 | 中 | 高 |
| 开发效率 | 高 | 中 |
| 生产就绪 | 中 | 高 |

## 🔧 技术实现细节

### 集成部署架构

```typescript
// server.ts - 自定义 Next.js 服务器
import { createServer } from 'http';
import next from 'next';
import WebSocket from 'ws';

const app = next({ dev });
const server = createServer(/* Next.js handler */);
const wss = new WebSocket.Server({ 
  server, 
  path: '/api/websocket' 
});

// 同一个服务器同时处理 HTTP 和 WebSocket
server.listen(3000);
```

### 分离部署架构

```typescript
// 独立的 WebSocket 服务器
const wss = new WebSocket.Server({ port: 3001 });

// Next.js 运行在 3000 端口
// WebSocket 运行在 3001 端口
```

## 🎯 选择建议

### 推荐集成部署的情况：
- 🏢 中小型项目（< 10万用户）
- 🛠️ 开发和测试环境
- 💰 资源受限的环境
- ⚡ 快速原型开发
- 📱 简单的实时功能

### 推荐分离部署的情况：
- 🏭 大型项目（> 10万用户）
- 🚀 生产环境
- 📈 高并发场景（> 1000 同时连接）
- 🔄 需要独立扩展WebSocket服务
- 🏗️ 微服务架构

## 📝 注意事项

### 集成部署注意事项：
- 确保 WebSocket 路径正确：`/api/websocket`
- 使用相对路径连接：`ws://${window.location.host}/api/websocket`
- 共享进程资源，注意内存使用

### 分离部署注意事项：
- 配置正确的 WebSocket 服务器地址
- 处理可能的跨域问题
- 确保两个服务都正常运行
- 负载均衡时需要配置 WebSocket 会话粘性

## 🔄 迁移指南

### 从分离部署迁移到集成部署：
1. 停止独立的 WebSocket 服务器
2. 使用 `./start-integrated.sh` 启动集成服务器
3. 前端会自动连接到集成的 WebSocket

### 从集成部署迁移到分离部署：
1. 启动独立的 WebSocket 服务器
2. 修改前端连接地址为 `ws://localhost:3001`
3. 使用标准的 `npm run dev` 启动 Next.js

## 🛠️ 故障排除

### 常见问题：

**1. WebSocket 连接失败**
- 检查服务器是否正常启动
- 确认 WebSocket 路径正确
- 检查防火墙设置

**2. TypeScript 编译错误**
- 确保安装了 `ws` 和 `@types/ws`
- 检查 TypeScript 版本兼容性

**3. 端口冲突**
- 修改 `.env` 中的 `PORT` 配置
- 确保端口未被其他服务占用

**4. 环境变量问题**
- 检查 `.env` 文件是否存在
- 确认 `OPEN_API_KEY` 已正确配置

## 📞 技术支持

如果遇到问题，请检查：
1. 控制台日志输出
2. 网络连接状态
3. 环境变量配置
4. 依赖包版本

---

选择最适合您项目需求的部署方式，开始构建强大的实时应用！🚀 