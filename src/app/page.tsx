import Sidebar from '@/components/Sidebar'

export default function HomePage() {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          <div className="max-w-4xl mx-auto">
            <div className="text-center">
              <h1 className="text-4xl font-bold text-gray-900 mb-4">
                LangChain 功能测试平台
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                系统化掌握大模型应用开发
              </p>
              
              <div className="bg-white rounded-lg shadow-sm border p-8 text-left">
                <h2 className="text-2xl font-semibold mb-6">欢迎使用测试平台</h2>
                
                <div className="space-y-4 text-gray-700">
                  <p>
                    这个平台为你提供了全面的 LangChain 功能测试环境。你可以通过左侧导航栏访问不同的测试模块：
                  </p>
                  
                  <div className="grid md:grid-cols-2 gap-6 mt-8">
                    <div className="space-y-4">
                      <h3 className="font-semibold text-lg">🚀 基础功能</h3>
                      <ul className="space-y-2 text-sm">
                        <li>• 简单对话 - 测试基础的LLM对话功能</li>
                        <li>• 提示词模板 - 学习和测试各种提示词</li>
                        <li>• 流式输出 - 体验实时响应效果</li>
                      </ul>
                    </div>
                    
                    <div className="space-y-4">
                      <h3 className="font-semibold text-lg">🤖 高级功能</h3>
                      <ul className="space-y-2 text-sm">
                        <li>• RAG问答 - 检索增强生成技术</li>
                        <li>• Agent代理 - 智能代理和自动化</li>
                        <li>• 工具调用 - 函数调用和外部工具</li>
                        <li>• 工作流 - 复杂的多步骤流程</li>
                      </ul>
                    </div>
                    
                    <div className="space-y-4">
                      <h3 className="font-semibold text-lg">📊 数据处理</h3>
                      <ul className="space-y-2 text-sm">
                        <li>• 向量数据库 - 向量存储和语义检索</li>
                        <li>• 文档处理 - 文档解析和分析</li>
                        <li>• 记忆管理 - 对话记忆和上下文维护</li>
                      </ul>
                    </div>
                    
                    <div className="space-y-4">
                      <h3 className="font-semibold text-lg">⚙️ 配置说明</h3>
                      <ul className="space-y-2 text-sm">
                        <li>• 支持第三方API转发接口</li>
                        <li>• 使用最新稳定版本的LangChain</li>
                        <li>• 每个功能模块独立测试</li>
                        <li>• 完整的TypeScript支持</li>
                      </ul>
                    </div>
                  </div>
                  
                  <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-blue-800">
                      <strong>提示：</strong> 在开始测试之前，请先在设置页面配置你的API密钥和基础URL。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
} 