'use client'

import { useState } from 'react'
import TestPageLayout from '@/components/TestPageLayout'

export default function AgentsPage() {
  const [task, setTask] = useState('')
  const [agentType, setAgentType] = useState('react')
  const [logs, setLogs] = useState<Array<{step: string, content: string, timestamp: Date}>>([])
  const [isRunning, setIsRunning] = useState(false)

  const agentTypes = [
    { value: 'react', label: 'ReAct Agent', description: '推理和行动循环' },
    { value: 'plan-execute', label: 'Plan & Execute', description: '计划和执行分离' },
    { value: 'conversational', label: 'Conversational', description: '对话式代理' },
  ]

  const handleRunAgent = async () => {
    if (!task.trim()) return
    
    setIsRunning(true)
    setLogs([])
    
    try {
      // TODO: 实现真实的Agent逻辑
      // 模拟Agent执行过程
      const steps = [
        { step: '初始化', content: `启动 ${agentTypes.find(t => t.value === agentType)?.label} 代理` },
        { step: '分析任务', content: `分析任务："${task}"` },
        { step: '制定计划', content: '正在制定执行计划...' },
        { step: '执行步骤1', content: '开始执行第一个步骤' },
        { step: '执行步骤2', content: '执行中间步骤' },
        { step: '完成', content: '任务执行完成！这是模拟结果，请配置真实API进行测试。' }
      ]
      
      for (let i = 0; i < steps.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 800))
        setLogs(prev => [...prev, { ...steps[i], timestamp: new Date() }])
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <TestPageLayout 
      title="Agent 代理系统" 
      description="测试智能代理的自主推理和执行能力"
    >
      <div className="p-6 space-y-6">
        {/* 配置区域 */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              选择Agent类型：
            </label>
            <select
              value={agentType}
              onChange={(e) => setAgentType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              {agentTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label} - {type.description}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              任务描述：
            </label>
            <textarea
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="描述你希望Agent执行的任务..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              rows={3}
            />
          </div>

          <button
            onClick={handleRunAgent}
            disabled={!task.trim() || isRunning}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRunning ? '执行中...' : '运行Agent'}
          </button>
        </div>

        {/* 执行日志 */}
        {logs.length > 0 && (
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">执行日志</h3>
            <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
              <div className="space-y-3">
                {logs.map((log, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <div className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full font-medium min-w-fit">
                      {log.step}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-700">{log.content}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {log.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 实现提示 */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="font-medium text-green-900 mb-2">🤖 Agent实现要点</h4>
          <ul className="text-sm text-green-800 space-y-1">
            <li>• 配置Agent执行器和工具链</li>
            <li>• 实现思维链推理过程</li>
            <li>• 集成外部API和工具</li>
            <li>• 添加执行监控和日志记录</li>
            <li>• 处理错误和异常情况</li>
          </ul>
        </div>
      </div>
    </TestPageLayout>
  )
} 