# RAG 系统使用指南

## 🎯 功能概述

本项目实现了一个完整的检索增强生成（RAG）系统，基于LangChain框架构建，支持文档上传、向量化存储、语义检索和智能问答。

## 🚀 快速开始

### 1. 环境配置

确保在 `.env.local` 文件中配置了OpenAI API密钥：

```bash
OPEN_API_KEY=your_openai_api_key
OPEN_API_BASE_URL=https://api.openai.com/v1  # 可选，自定义API端点
```

### 2. 启动应用

```bash
npm run dev
```

访问 `http://localhost:3000/rag` 进入RAG问答页面。

### 3. 使用流程

1. **上传文档**：点击文件选择按钮，上传支持的文档格式
2. **等待处理**：文档会自动分块并转换为向量存储
3. **提出问题**：在问题框中输入您的问题
4. **获取答案**：系统会基于文档内容生成准确回答

## 📁 支持的文档格式

当前支持的文档格式：
- ✅ `.txt` - 纯文本文件
- ✅ `.md` - Markdown文件
- ⏳ `.pdf` - PDF文件（需要配置pdf-parse库）
- ⏳ `.docx` - Word文档（需要配置mammoth库）

## 🔧 技术架构

### 核心组件

1. **文档处理器** (`src/lib/documentParser.ts`)
   - 文件类型验证
   - 文档内容解析
   - 文本预处理

2. **RAG API** (`src/app/api/rag/route.ts`)
   - 文档上传和向量化
   - 语义检索
   - 问答生成
   - 状态管理

3. **前端界面** (`src/app/rag/page.tsx`)
   - 文档管理
   - 问答交互
   - 结果展示

### 技术栈

- **框架**: Next.js 14 + TypeScript
- **AI框架**: LangChain + OpenAI
- **向量存储**: MemoryVectorStore（内存存储）
- **文档分割**: RecursiveCharacterTextSplitter
- **向量化**: OpenAI Embeddings
- **语言模型**: GPT-3.5-turbo

## 🎨 功能特性

### 文档管理
- 拖拽上传文档
- 实时上传进度显示
- 文档信息展示（文件名、大小、分块数量）
- 向量数据库状态监控

### 智能问答
- 基于语义相似度的文档检索
- 上下文感知的答案生成
- 来源引用和可追溯性
- 错误处理和用户反馈

### 用户体验
- 响应式设计
- 加载状态提示
- 错误信息展示
- 清空数据库功能

## 📊 配置参数

### 文档分块参数
```typescript
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,        // 分块大小
  chunkOverlap: 200,      // 重叠字符数
});
```

### 检索参数
```typescript
const relevantDocs = await vectorStore.similaritySearch(question, 4);
// 检索Top-4最相关的文档片段
```

### 生成参数
```typescript
const llm = new ChatOpenAI({
  modelName: 'gpt-3.5-turbo',
  temperature: 0.1,      // 低温度确保答案准确性
});
```

## 🔍 使用示例

### 示例问题

基于提供的RAG技术介绍文档，您可以尝试以下问题：

1. **基础概念**
   - "什么是RAG技术？"
   - "RAG的主要优势是什么？"
   - "RAG系统包含哪些核心组件？"

2. **技术细节**
   - "RAG的工作流程是怎样的？"
   - "文档分割器有哪些类型？"
   - "常用的向量数据库有哪些？"

3. **应用场景**
   - "RAG技术有哪些应用场景？"
   - "企业如何使用RAG构建知识问答系统？"
   - "RAG实现过程中会遇到哪些挑战？"

### 测试文档

项目包含了一个示例文档 `sample-documents/rag-introduction.md`，您可以直接上传这个文档进行测试。

## 🛠️ 扩展功能

### 添加新的文档格式

1. 在 `documentParser.ts` 中添加新的解析器：
```typescript
case 'pdf':
  return await parsePDFFile(file);
```

2. 安装相应的解析库：
```bash
npm install pdf-parse
```

### 使用持久化向量数据库

替换MemoryVectorStore为持久化存储：

```typescript
// 使用Chroma
import { Chroma } from "langchain/vectorstores/chroma";

// 使用Pinecone
import { PineconeStore } from "langchain/vectorstores/pinecone";
```

### 优化检索策略

1. **混合检索**：结合关键词和语义检索
2. **重排序**：对检索结果进行二次排序
3. **多轮检索**：基于对话历史的上下文检索

## ❗ 注意事项

### 限制说明

1. **内存存储**：当前使用内存向量存储，重启服务会丢失数据
2. **文件大小**：单个文件限制5MB
3. **并发处理**：同时只能处理一个上传请求
4. **API费用**：使用OpenAI API会产生费用

### 最佳实践

1. **文档质量**：确保上传的文档内容清晰、结构化
2. **问题描述**：提出具体、明确的问题获得更好的答案
3. **分块策略**：根据文档类型调整分块参数
4. **模型选择**：根据需要选择合适的语言模型

## 🔧 故障排除

### 常见问题

1. **上传失败**
   - 检查文件格式是否支持
   - 确认文件大小是否超过限制
   - 验证API密钥配置

2. **检索无结果**
   - 确认已上传相关文档
   - 尝试使用不同的问题表述
   - 检查文档内容是否与问题相关

3. **API错误**
   - 验证OpenAI API密钥
   - 检查网络连接
   - 确认API配额是否充足

### 调试技巧

1. 查看浏览器控制台的错误信息
2. 检查服务器日志输出
3. 使用简单问题测试系统功能
4. 逐步增加文档复杂度

## 🚀 后续改进

### 计划中的功能

1. **多模态支持**：图片、音频文档处理
2. **实时更新**：增量索引和文档更新
3. **用户管理**：多用户隔离和权限控制
4. **高级检索**：图检索、时间感知检索
5. **评估指标**：检索质量和生成质量评估

### 贡献指南

欢迎提交Issue和Pull Request来改进这个RAG系统。请遵循项目的编码规范和提交规范。

---

*更多详细信息请参考项目文档和源代码注释。* 