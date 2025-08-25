# 环境变量配置说明

## 快速配置

请在项目根目录创建 `.env.local` 文件，并添加以下内容：

```bash
# OpenAI API 配置
OPEN_API_KEY=your_openai_api_key_here
OPEN_API_BASE_URL=https://api.openai.com/v1
```

## 配置说明

### OPEN_API_KEY (必需)
- 您的 OpenAI API 密钥
- 获取方式：访问 [OpenAI API Keys](https://platform.openai.com/api-keys)
- 示例：`sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### OPEN_API_BASE_URL (可选)
- OpenAI API 的基础 URL
- 默认值：`https://api.openai.com/v1`
- 如果使用第三方代理服务，请修改此值

## 常见问题

### 1. 上传文件一直处理中
可能原因：
- ❌ 未配置 `OPEN_API_KEY`
- ❌ API 密钥无效或已过期
- ❌ 网络连接问题
- ❌ API 配额不足

### 2. 检查方法
1. 打开浏览器开发者工具 (F12)
2. 查看 Console 标签的日志信息
3. 查看 Network 标签的请求状态

### 3. 调试步骤
1. 确认 `.env.local` 文件存在且格式正确
2. 重启开发服务器 (`npm run dev`)
3. 查看终端和浏览器控制台的错误信息
4. 验证 API 密钥是否有效

## 测试 API 连接

您可以使用以下命令测试 OpenAI API 连接：

```bash
curl -H "Authorization: Bearer your_api_key_here" \
  https://api.openai.com/v1/models
```

如果返回模型列表，说明 API 密钥有效。 