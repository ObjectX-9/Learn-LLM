# LangChain 测试平台

一个用于系统化测试 LangChain 各种功能的 Next.js 应用程序。

## 功能特性

### 🚀 基础功能
- **简单对话** - 测试基础的LLM对话功能
- **提示词模板** - 学习和测试各种提示词
- **流式输出** - 体验实时响应效果

### 🤖 高级功能  
- **RAG问答** - 检索增强生成技术
- **Agent代理** - 智能代理和自动化
- **工具调用** - 函数调用和外部工具
- **工作流** - 复杂的多步骤流程

### 📊 数据处理
- **向量数据库** - 向量存储和语义检索
- **文档处理** - 文档解析和分析
- **记忆管理** - 对话记忆和上下文维护

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