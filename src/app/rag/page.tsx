'use client'

import { useState } from 'react'
import TestPageLayout from '@/components/TestPageLayout'

export default function RAGPage() {
  const [documents, setDocuments] = useState<string[]>([])
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleAddDocument = () => {
    // TODO: 实现文档上传和处理
    console.log('添加文档功能待实现')
  }

  const handleAskQuestion = async () => {
    if (!question.trim()) return
    
    setIsLoading(true)
    try {
      // TODO: 实现RAG问答
      setTimeout(() => {
        setAnswer(`这是一个模拟的RAG回答。你的问题是："${question}"。请配置向量数据库和API后测试真实功能。`)
        setIsLoading(false)
      }, 1500)
    } catch (error) {
      console.error('Error:', error)
      setIsLoading(false)
    }
  }

  return (
    <TestPageLayout 
      title="RAG 问答系统" 
      description="检索增强生成 - 基于文档内容回答问题"
    >
      <div className="p-6 space-y-6">
        {/* 文档管理区域 */}
        <div className="border-b pb-6">
          <h3 className="text-lg font-semibold mb-4">文档管理</h3>
          <div className="space-y-4">
            <div className="flex space-x-4">
              <input
                type="file"
                accept=".txt,.pdf,.docx,.md"
                className="flex-1 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
              />
              <button
                onClick={handleAddDocument}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
              >
                添加文档
              </button>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">已加载文档：</p>
              {documents.length === 0 ? (
                <p className="text-sm text-gray-500">暂无文档，请上传文档进行测试</p>
              ) : (
                <ul className="text-sm space-y-1">
                  {documents.map((doc, index) => (
                    <li key={index} className="text-gray-700">• {doc}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* 问答区域 */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">基于文档问答</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                你的问题：
              </label>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="请输入你想问的问题..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                rows={3}
              />
            </div>
            
            <button
              onClick={handleAskQuestion}
              disabled={!question.trim() || isLoading}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '分析中...' : '提问'}
            </button>
            
            {answer && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">回答：</h4>
                <p className="text-blue-800 whitespace-pre-wrap">{answer}</p>
              </div>
            )}
          </div>
        </div>

        {/* 配置提示 */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="font-medium text-yellow-900 mb-2">💡 实现提示</h4>
          <ul className="text-sm text-yellow-800 space-y-1">
            <li>• 集成向量数据库（如 Pinecone、Chroma 等）</li>
            <li>• 实现文档分割和向量化</li>
            <li>• 配置相似性搜索</li>
            <li>• 实现检索增强的问答流程</li>
          </ul>
        </div>
      </div>
    </TestPageLayout>
  )
} 