'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
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
  Settings,
  ChevronDown,
  ChevronRight,
  PenTool,
  Users,
  FileJson,
  Languages,
  Terminal,
  HelpCircle,
  BarChart3,
  Target,
} from 'lucide-react';
import { useState } from 'react';

const navigationItems = [
  {
    title: '基础功能',
    items: [
      {
        name: '简单对话',
        href: '/chat',
        icon: MessageSquare,
        description: '基础的LLM对话功能',
      },
      {
        name: 'Prompt测试',
        icon: FileText,
        description: '测试各种提示词模板',
        isExpandable: true,
        children: [
          {
            name: '文本生成',
            href: '/prompts/text-generation',
            icon: PenTool,
            description: '创意写作和内容生成',
          },
          {
            name: '角色扮演',
            href: '/prompts/role-play',
            icon: Users,
            description: 'AI角色扮演对话',
          },
          {
            name: '数据格式化',
            href: '/prompts/data-format',
            icon: FileJson,
            description: '结构化数据转换',
          },
          {
            name: '翻译',
            href: '/prompts/translation',
            icon: Languages,
            description: '多语言翻译',
          },
          {
            name: '代码生成',
            href: '/prompts/code-generation',
            icon: Terminal,
            description: '编程代码生成',
          },
          {
            name: '问答对话',
            href: '/prompts/qa',
            icon: HelpCircle,
            description: '知识问答',
          },
          {
            name: '文本分析',
            href: '/prompts/text-analysis',
            icon: BarChart3,
            description: '文本情感和内容分析',
          },
          {
            name: 'Prompt评测',
            href: '/prompts/prompt-evaluation',
            icon: Target,
            description: 'Prompt质量评估',
          },
          {
            name: '链式思考',
            href: '/prompts/cot',
            icon: Brain,
            description: '逐步推理解决复杂问题',
          },
        ],
      },
      {
        name: '流式输出',
        icon: Zap,
        description: '各种流式数据传输技术',
        isExpandable: true,
        children: [
          {
            name: '技术概览',
            href: '/streaming',
            icon: Zap,
            description: '流式输出技术对比',
          },
          {
            name: 'Server-Sent Events',
            href: '/streaming/sse',
            icon: Zap,
            description: 'SSE实时推送演示',
          },
        ],
      },
    ],
  },
  {
    title: '高级功能',
    items: [
      {
        name: 'RAG问答',
        href: '/rag',
        icon: Search,
        description: '检索增强生成',
      },
      {
        name: 'Agent代理',
        href: '/agents',
        icon: Bot,
        description: '智能代理功能',
      },
      {
        name: '工具调用',
        href: '/tools',
        icon: Code,
        description: '函数调用和工具使用',
      },
      {
        name: '工作流',
        href: '/workflows',
        icon: Workflow,
        description: '复杂的工作流程',
      },
    ],
  },
  {
    title: '数据处理',
    items: [
      {
        name: '向量数据库',
        href: '/vectors',
        icon: Database,
        description: '向量存储和检索',
      },
      {
        name: '文档处理',
        href: '/documents',
        icon: FileText,
        description: '文档解析和处理',
      },
      {
        name: '记忆管理',
        href: '/memory',
        icon: Brain,
        description: '对话记忆和上下文',
      },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = useState<string[]>(['Prompt测试']); // 默认展开

  const toggleExpanded = (itemName: string) => {
    setExpandedItems((prev) =>
      prev.includes(itemName)
        ? prev.filter((name) => name !== itemName)
        : [...prev, itemName]
    );
  };

  const isItemActive = (item: any) => {
    if (item.href) {
      return pathname === item.href;
    }
    if (item.children) {
      return item.children.some((child: any) => pathname === child.href);
    }
    return false;
  };

  const isChildActive = (href: string) => {
    return pathname === href;
  };

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
                const Icon = item.icon;
                const isActive = isItemActive(item);
                const isExpanded = expandedItems.includes(item.name);

                return (
                  <li key={item.name}>
                    {item.isExpandable ? (
                      <>
                        {/* 可展开项 */}
                        <button
                          onClick={() => toggleExpanded(item.name)}
                          className={cn(
                            'w-full flex items-center px-2 py-2 text-sm rounded-md transition-colors group',
                            isActive
                              ? 'bg-primary text-primary-foreground'
                              : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                          )}
                        >
                          <Icon className="mr-3 h-4 w-4 flex-shrink-0" />
                          <div className="flex-1 min-w-0 text-left">
                            <div className="font-medium">{item.name}</div>
                            <div
                              className={cn(
                                'text-xs truncate',
                                isActive
                                  ? 'text-primary-foreground/70'
                                  : 'text-gray-500'
                              )}
                            >
                              {item.description}
                            </div>
                          </div>
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 flex-shrink-0" />
                          ) : (
                            <ChevronRight className="h-4 w-4 flex-shrink-0" />
                          )}
                        </button>

                        {/* 子菜单 */}
                        {isExpanded && item.children && (
                          <ul className="ml-6 mt-1 space-y-1">
                            {item.children.map((child) => {
                              const ChildIcon = child.icon;
                              const isChildActiveState = isChildActive(
                                child.href
                              );

                              return (
                                <li key={child.name}>
                                  <Link
                                    href={child.href}
                                    className={cn(
                                      'flex items-center px-2 py-2 text-sm rounded-md transition-colors group',
                                      isChildActiveState
                                        ? 'bg-primary text-primary-foreground'
                                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                                    )}
                                  >
                                    <ChildIcon className="mr-3 h-3.5 w-3.5 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                      <div className="font-medium text-xs">
                                        {child.name}
                                      </div>
                                      <div
                                        className={cn(
                                          'text-xs truncate',
                                          isChildActiveState
                                            ? 'text-primary-foreground/70'
                                            : 'text-gray-500'
                                        )}
                                      >
                                        {child.description}
                                      </div>
                                    </div>
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </>
                    ) : (
                      /* 普通链接项 */
                      <Link
                        href={item.href!}
                        className={cn(
                          'flex items-center px-2 py-2 text-sm rounded-md transition-colors group',
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                        )}
                      >
                        <Icon className="mr-3 h-4 w-4 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{item.name}</div>
                          <div
                            className={cn(
                              'text-xs truncate',
                              isActive
                                ? 'text-primary-foreground/70'
                                : 'text-gray-500'
                            )}
                          >
                            {item.description}
                          </div>
                        </div>
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        <div className="mt-8 pt-6 border-t border-gray-200">
          <Link
            href="/settings"
            className={cn(
              'flex items-center px-2 py-2 text-sm rounded-md transition-colors',
              pathname === '/settings'
                ? 'bg-primary text-primary-foreground'
                : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
            )}
          >
            <Settings className="mr-3 h-4 w-4" />
            <span>设置</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
