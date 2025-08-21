# LangChain Test Platform

这是一个基于Next.js的LangChain测试平台。

## 功能特性

- 🎯 支持多种AI模型测试
- 📝 智能对话功能
- 🔧 RAG（检索增强生成）支持
- ⚙️ 灵活的配置选项

## 开发规范

### Git提交规范

项目已配置commitlint，支持以下commit类型：

- `feat`: ✨ 新功能
- `fix`: 🐛 修复bug
- `docs`: 📝 文档更新
- `style`: 💄 代码格式（不影响功能）
- `refactor`: ♻️ 重构
- `perf`: ⚡ 性能优化
- `test`: ✅ 增加测试
- `build`: 📦 构建相关
- `ci`: 🎡 CI配置
- `chore`: 🔧 其他更改
- `revert`: ⏪ 回滚
- `wip`: 🚧 开发中

### 使用交互式提交

```bash
# 使用交互式提交工具
pnpm run commit

# 重试上次失败的提交
pnpm run commit:retry
```

### 开发命令

```bash
# 开发
pnpm dev

# 构建
pnpm build

# 代码检查
pnpm lint
pnpm run lint:fix

# 代码格式化
pnpm run format
pnpm run format:check

# 类型检查
pnpm run type-check
```

## 技术栈

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **LangChain**: v0.3.5 (最新稳定版)
- **Package Manager**: pnpm
- **Icons**: Lucide React

## 快速开始

1. 安装依赖：
```bash
pnpm install
```

2. 启动开发服务器：
```bash
pnpm dev
```

3. 打开浏览器访问 [http://localhost:3000](http://localhost:3000)

## 配置说明

在使用前，请先在设置页面配置：
- API密钥
- API基础URL（支持第三方转发接口）
- 模型名称

## 项目结构

```
src/
├── app/                 # Next.js App Router页面
│   ├── chat/           # 简单对话测试
│   ├── rag/            # RAG问答测试
│   ├── agents/         # Agent代理测试
│   ├── settings/       # 系统设置
│   └── ...             # 其他功能页面
├── components/         # 共享组件
│   ├── Sidebar.tsx     # 侧边栏导航
│   └── TestPageLayout.tsx # 测试页面布局
└── lib/                # 工具函数
    └── utils.ts        # 通用工具
```

## 开发说明

每个功能模块都是独立的页面组件，方便单独测试和开发。所有页面都使用统一的布局组件，确保用户体验的一致性。

## 待实现功能

- [ ] 实际的LangChain API集成
- [ ] 配置持久化存储
- [ ] 更多测试用例和示例
- [ ] 错误处理和用户反馈
- [ ] 性能监控和日志记录 