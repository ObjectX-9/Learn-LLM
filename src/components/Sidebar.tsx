'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { 
  MessageSquare, 
  FileText, 
  Bot, 
  Database, 
  Search,
  Workflow,
  Code,
  Brain,
  Zap,
  Settings
} from 'lucide-react'

const navigationItems = [
  {
    title: '基础功能',
    items: [
      { name: '简单对话', href: '/chat', icon: MessageSquare, description: '基础的LLM对话功能' },
      { name: '提示词模板', href: '/prompts', icon: FileText, description: '测试各种提示词模板' },
      { name: '流式输出', href: '/streaming', icon: Zap, description: '测试流式响应' },
    ]
  },
  {
    title: '高级功能',
    items: [
      { name: 'RAG问答', href: '/rag', icon: Search, description: '检索增强生成' },
      { name: 'Agent代理', href: '/agents', icon: Bot, description: '智能代理功能' },
      { name: '工具调用', href: '/tools', icon: Code, description: '函数调用和工具使用' },
      { name: '工作流', href: '/workflows', icon: Workflow, description: '复杂的工作流程' },
    ]
  },
  {
    title: '数据处理',
    items: [
      { name: '向量数据库', href: '/vectors', icon: Database, description: '向量存储和检索' },
      { name: '文档处理', href: '/documents', icon: FileText, description: '文档解析和处理' },
      { name: '记忆管理', href: '/memory', icon: Brain, description: '对话记忆和上下文' },
    ]
  }
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-screen overflow-y-auto">
      <div className="p-6">
        <h1 className="text-xl font-bold text-gray-900">LangChain 测试</h1>
        <p className="text-sm text-gray-500 mt-1">功能测试平台</p>
      </div>
      
      <nav className="px-4 pb-6">
        {navigationItems.map((section) => (
          <div key={section.title} className="mb-6">
            <h3 className="px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              {section.title}
            </h3>
            <ul className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center px-2 py-2 text-sm rounded-md transition-colors group",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                      )}
                    >
                      <Icon className="mr-3 h-4 w-4 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{item.name}</div>
                        <div className={cn(
                          "text-xs truncate",
                          isActive ? "text-primary-foreground/70" : "text-gray-500"
                        )}>
                          {item.description}
                        </div>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
        
        <div className="mt-8 pt-6 border-t border-gray-200">
          <Link
            href="/settings"
            className={cn(
              "flex items-center px-2 py-2 text-sm rounded-md transition-colors",
              pathname === '/settings'
                ? "bg-primary text-primary-foreground"
                : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
            )}
          >
            <Settings className="mr-3 h-4 w-4" />
            <span>设置</span>
          </Link>
        </div>
      </nav>
    </div>
  )
} 