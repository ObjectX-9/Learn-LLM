# 🦜🔗 LangChain 文档处理系统

这是一个基于 LangChain 官方文档加载器和分割器的完整文档处理系统，支持多种文档格式的智能处理。

## 📋 功能概览

### ✅ 已实现功能

1. **真正的 LangChain 官方文档加载器**
   - ✅ `TextLoader`: 纯文本文件处理
   - ✅ `PDFLoader`: PDF 文档解析（需要 pdf-parse 依赖）
   - ✅ `DocxLoader`: Word 文档处理（需要 mammoth 依赖）
   - ✅ `CSVLoader`: CSV 数据文件处理
   - ✅ `JSONLoader`: JSON 数据解析
   - ✅ `CheerioWebBaseLoader`: HTML 文档解析
   - ✅ 智能降级处理机制

2. **LangChain 官方文档分割器**
   - ✅ `RecursiveCharacterTextSplitter`: 智能递归分割
   - ✅ `TokenTextSplitter`: 基于 Token 的分割
   - ✅ `MarkdownTextSplitter`: Markdown 专用分割
   - ✅ `CharacterTextSplitter`: 简单字符分割

3. **完整的用户界面**
   - ✅ 文档上传和处理配置
   - ✅ 实时处理状态显示
   - ✅ 详细的元数据展示
   - ✅ 文档片段预览
   - ✅ 警告信息提示
   - ✅ 依赖安装指南

4. **智能错误处理**
   - ✅ 动态加载器导入
   - ✅ 降级处理机制
   - ✅ 详细的错误信息
   - ✅ 开发模式调试支持

## 🏗️ 技术架构

### 后端 API (`/api/documents/process`)

```typescript
// 核心功能
- 文件上传处理
- 临时文件管理
- LangChain 加载器动态导入
- 文档分割和处理
- 元数据管理
- 智能降级机制
```

### 前端页面 (`/documents`)

```typescript
// 用户界面
- 加载器选择器
- 分割器配置
- 处理参数设置
- 文档列表管理
- 详细预览模态框
- 警告信息显示
```

## 📦 依赖管理

### 核心依赖
```bash
pnpm add @langchain/community
pnpm add langchain
```

### 可选依赖（用于特定格式）
```bash
# PDF 支持
pnpm add pdf-parse

# Word 文档支持  
pnpm add mammoth
```

### 智能降级
- 如果缺少可选依赖，系统会自动降级使用基础处理
- 提供清晰的错误信息和安装指导
- 确保系统在任何情况下都能正常工作

## 🚀 使用指南

### 1. 基本使用流程

1. **访问页面**: 导航到 `/documents`
2. **选择加载器**: 从 LangChain 官方加载器中选择
3. **配置分割器**: 选择合适的分割器和参数
4. **上传文档**: 选择要处理的文档文件
5. **查看结果**: 预览处理结果和元数据

### 2. 加载器选择指南

| 文档类型 | 推荐加载器 | 依赖要求 |
|---------|-----------|----------|
| 纯文本 (.txt) | TextLoader | 无 |
| Markdown (.md) | TextLoader + MarkdownTextSplitter | 无 |
| PDF (.pdf) | PDFLoader | pdf-parse |
| Word (.docx) | DocxLoader | mammoth |
| CSV (.csv) | CSVLoader | 无 |
| JSON (.json) | JSONLoader | 无 |
| HTML (.html) | CheerioWebBaseLoader | 无 |

### 3. 分割器参数优化

| 场景 | chunk_size | chunk_overlap | 推荐分割器 |
|------|------------|---------------|------------|
| 学术论文 | 1500 | 300 | RecursiveCharacterTextSplitter |
| 技术文档 | 1000 | 200 | MarkdownTextSplitter |
| 数据文件 | 500 | 50 | CharacterTextSplitter |
| 精确控制 | 1000 | 200 | TokenTextSplitter |

## 📁 测试文档

系统提供了完整的测试文档集合：

- `sample-documents/langchain-test.txt` - 文本加载器测试
- `sample-documents/test-data.json` - JSON 加载器测试
- `sample-documents/test-data.csv` - CSV 加载器测试  
- `sample-documents/test-document.html` - HTML 加载器测试
- `sample-documents/rag-introduction.md` - Markdown 处理测试

## 🔧 技术特点

### 1. 动态加载器导入
```typescript
const loadOptionalLoader = async (loaderName: string, modulePath: string) => {
  try {
    const importedModule = await import(modulePath);
    return importedModule[loaderName];
  } catch (error) {
    console.warn(`加载器 ${loaderName} 不可用:`, error);
    return null;
  }
};
```

### 2. 智能降级处理
- PDF/DOCX 加载失败时自动使用文本模式
- 保留原始错误信息用于调试
- 在元数据中标记降级状态

### 3. 完整的元数据管理
```typescript
{
  source: file.name,
  originalName: file.name,
  fileSize: file.size,
  loaderType: loaderType,
  loadedAt: new Date().toISOString(),
  fallback: boolean, // 是否使用了降级处理
  loader: string,    // 实际使用的加载器
  splitter: string,  // 使用的分割器
}
```

### 4. 安全的临时文件管理
- 自动创建和清理临时文件
- 防止文件泄露和磁盘空间浪费
- 错误情况下的资源清理

## 🎯 最佳实践

### 1. 性能优化
- 合理设置分块参数
- 使用缓存机制
- 异步处理大量文档
- 及时清理临时文件

### 2. 错误处理
- 完善的降级机制
- 详细的错误日志
- 用户友好的错误提示
- 开发模式下的调试信息

### 3. 用户体验
- 实时处理状态反馈
- 详细的处理信息展示
- 警告和建议提示
- 依赖安装指导

## 🔮 未来扩展

### 可能的增强功能
1. **更多加载器支持**
   - PowerPoint 文档处理
   - Excel 文件支持
   - 图片 OCR 处理

2. **高级分割策略**
   - 语义分割
   - 自适应分块
   - 多模态内容处理

3. **批量处理**
   - 多文件上传
   - 批量配置
   - 并行处理

4. **集成增强**
   - 向量化集成
   - RAG 系统直连
   - 知识库构建

## 🎉 总结

这个 LangChain 文档处理系统展示了如何：

1. ✅ **正确使用 LangChain 官方工具**：避免重复造轮子
2. ✅ **实现智能降级机制**：确保系统稳定性  
3. ✅ **提供完整的用户体验**：从配置到结果展示
4. ✅ **处理复杂的依赖关系**：动态导入和错误处理
5. ✅ **遵循最佳实践**：代码质量和性能优化

通过使用真正的 LangChain 加载器和分割器，我们获得了：
- 🔧 **专业化的处理能力**
- 🛡️ **经过验证的可靠性** 
- 🔄 **持续的社区支持**
- 🎯 **与 LLM 生态的完美集成**

这个系统为构建更复杂的 AI 文档处理应用奠定了坚实的基础！ 