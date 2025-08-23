import { NextRequest, NextResponse } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

export interface AgentRequest {
  task: string;
  agentType: 'react' | 'plan-execute' | 'conversational';
  maxSteps: number;
  tools: string[];
  useMemory: boolean;
  temperature?: number;
  modelName?: string;
  stream?: boolean;
}

export interface AgentStep {
  stepNumber: number;
  stepType: 'observe' | 'think' | 'plan' | 'act' | 'reflect' | 'tool_use';
  content: string;
  reasoning: string;
  toolCalls?: ToolCall[];
  timestamp: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface ToolCall {
  toolName: string;
  input: any;
  output: any;
  success: boolean;
  duration: number;
}

export interface AgentMemory {
  shortTerm: {
    currentTask: string;
    context: string[];
    recentActions: AgentStep[];
  };
  longTerm: {
    experiences: string[];
    patterns: string[];
    preferences: Record<string, any>;
  };
}

export interface AgentPlan {
  taskId: string;
  mainGoal: string;
  subTasks: {
    id: string;
    description: string;
    dependencies: string[];
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    priority: number;
  }[];
  strategy: string;
  estimatedSteps: number;
}

export interface AgentResponse {
  task: string;
  agentType: string;
  plan: AgentPlan;
  steps: AgentStep[];
  memory: AgentMemory;
  finalResult: string;
  success: boolean;
  totalTime: number;
  toolsUsed: string[];
}

export interface StreamMessage {
  type: string;
  message?: string;
  step?: AgentStep;
  plan?: AgentPlan;
  memory?: AgentMemory;
  result?: AgentResponse;
  error?: string;
}

// 智能体类型配置
const AGENT_CONFIGS = {
  react: {
    name: 'ReAct智能体',
    description: '推理和行动循环，适合需要逐步分析的任务',
    systemPrompt: `你是一个ReAct智能体，使用观察-思考-行动的循环来解决问题。
每次都要明确你的观察、思考过程和下一步行动。`,
    maxIterations: 10,
    tools: ['search', 'calculator', 'code_executor'],
  },
  'plan-execute': {
    name: '计划执行智能体',
    description: '先制定详细计划，再逐步执行',
    systemPrompt: `你是一个计划-执行智能体。首先制定详细的执行计划，然后按计划逐步执行。
重视计划的完整性和执行的精确性。`,
    maxIterations: 15,
    tools: ['search', 'calculator', 'planner', 'executor'],
  },
  conversational: {
    name: '对话式智能体',
    description: '基于对话的智能体，适合交互式任务',
    systemPrompt: `你是一个对话式智能体，擅长与用户进行自然的对话交互。
保持友好、专业，并能够理解上下文和用户意图。`,
    maxIterations: 8,
    tools: ['search', 'knowledge_base', 'conversation_manager'],
  },
};

// 可用工具定义
const AVAILABLE_TOOLS = {
  search: {
    name: '搜索工具',
    description: '搜索相关信息和知识',
    function: async (query: string) => {
      // 模拟搜索结果
      await new Promise((resolve) => setTimeout(resolve, 500));
      return `搜索"${query}"的结果：找到相关信息...`;
    },
  },
  calculator: {
    name: '计算器',
    description: '执行数学计算',
    function: async (expression: string) => {
      try {
        const result = eval(expression.replace(/[^0-9+\-*/().\s]/g, ''));
        return `计算结果: ${result}`;
      } catch {
        return '计算错误，请检查表达式';
      }
    },
  },
  code_executor: {
    name: '代码执行器',
    description: '执行简单的代码片段',
    function: async (code: string) => {
      // 模拟代码执行
      await new Promise((resolve) => setTimeout(resolve, 800));
      return `代码执行完成：${code.substring(0, 50)}...`;
    },
  },
  planner: {
    name: '规划器',
    description: '制定详细的执行计划',
    function: async (task: string) => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      return `已为任务"${task}"制定详细计划`;
    },
  },
  executor: {
    name: '执行器',
    description: '执行计划中的具体步骤',
    function: async (step: string) => {
      await new Promise((resolve) => setTimeout(resolve, 400));
      return `执行步骤：${step}`;
    },
  },
  knowledge_base: {
    name: '知识库',
    description: '查询专业知识',
    function: async (query: string) => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return `知识库查询"${query}"：找到相关专业信息`;
    },
  },
  conversation_manager: {
    name: '对话管理器',
    description: '管理对话状态和上下文',
    function: async (context: string) => {
      return `对话上下文已更新：${context}`;
    },
  },
};

export async function POST(request: NextRequest) {
  try {
    const body: AgentRequest = await request.json();
    const {
      task,
      agentType,
      maxSteps,
      tools,
      useMemory,
      temperature = 0.7,
      modelName = 'gpt-3.5-turbo',
      stream = true,
    } = body;

    const startTime = Date.now();
    const agentConfig = AGENT_CONFIGS[agentType];

    if (stream) {
      // 流式响应
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          try {
            // 发送开始信号
            const startData = `data: ${JSON.stringify({
              type: 'start',
              message: `启动${agentConfig.name}...`,
              task,
              agentType,
            })}\n\n`;
            controller.enqueue(encoder.encode(startData));

            // 初始化智能体
            const memory = initializeMemory(task);
            const plan = await generatePlan(
              task,
              agentType,
              modelName,
              temperature
            );

            // 发送计划
            const planData = `data: ${JSON.stringify({
              type: 'plan_generated',
              plan,
            })}\n\n`;
            controller.enqueue(encoder.encode(planData));

            const steps: AgentStep[] = [];
            let currentStep = 1;
            let taskCompleted = false;

            // 智能体执行循环
            while (currentStep <= maxSteps && !taskCompleted) {
              // 生成下一步行动
              const step = await generateAgentStep(
                task,
                agentType,
                plan,
                steps,
                memory,
                tools,
                modelName,
                temperature
              );

              step.stepNumber = currentStep;
              steps.push(step);

              // 发送步骤
              const stepData = `data: ${JSON.stringify({
                type: 'step_generated',
                step,
              })}\n\n`;
              controller.enqueue(encoder.encode(stepData));

              // 执行工具调用（如果有）
              if (step.toolCalls && step.toolCalls.length > 0) {
                for (const toolCall of step.toolCalls) {
                  const toolResult = await executeToolCall(toolCall);
                  toolCall.output = toolResult.output;
                  toolCall.success = toolResult.success;
                  toolCall.duration = toolResult.duration;

                  // 发送工具调用结果
                  const toolData = `data: ${JSON.stringify({
                    type: 'tool_executed',
                    toolCall,
                  })}\n\n`;
                  controller.enqueue(encoder.encode(toolData));
                }
              }

              // 更新记忆
              if (useMemory) {
                updateMemory(memory, step);

                const memoryData = `data: ${JSON.stringify({
                  type: 'memory_updated',
                  memory,
                })}\n\n`;
                controller.enqueue(encoder.encode(memoryData));
              }

              // 检查任务是否完成
              if (
                step.stepType === 'reflect' &&
                step.content.includes('任务完成')
              ) {
                taskCompleted = true;
              }

              step.status = 'completed';
              currentStep++;
            }

            const finalResult = generateFinalResult(task, steps, plan);
            const toolCallNames = steps.flatMap(
              (s) => s.toolCalls?.map((tc) => tc.toolName) || []
            );
            const toolsUsedSet = new Set(toolCallNames);
            const toolsUsed = Array.from(toolsUsedSet);
            const totalTime = Date.now() - startTime;

            // 发送最终结果
            const finalData = `data: ${JSON.stringify({
              type: 'final_result',
              result: {
                task,
                agentType,
                plan,
                steps,
                memory,
                finalResult,
                success: taskCompleted,
                totalTime,
                toolsUsed,
              },
            })}\n\n`;
            controller.enqueue(encoder.encode(finalData));

            // 发送完成信号
            const doneData = `data: ${JSON.stringify({ type: 'done' })}\n\n`;
            controller.enqueue(encoder.encode(doneData));
            controller.close();
          } catch (error) {
            console.error('Agent Stream Error:', error);
            const errorData = `data: ${JSON.stringify({
              type: 'error',
              error: 'Agent处理过程发生错误',
              details: error instanceof Error ? error.message : '未知错误',
            })}\n\n`;
            controller.enqueue(encoder.encode(errorData));
            controller.close();
          }
        },
      });

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    } else {
      // 非流式响应
      const memory = initializeMemory(task);
      const plan = await generatePlan(task, agentType, modelName, temperature);
      const steps: AgentStep[] = [];
      let currentStep = 1;
      let taskCompleted = false;

      while (currentStep <= maxSteps && !taskCompleted) {
        const step = await generateAgentStep(
          task,
          agentType,
          plan,
          steps,
          memory,
          tools,
          modelName,
          temperature
        );
        step.stepNumber = currentStep;
        steps.push(step);

        if (step.toolCalls) {
          for (const toolCall of step.toolCalls) {
            const toolResult = await executeToolCall(toolCall);
            toolCall.output = toolResult.output;
            toolCall.success = toolResult.success;
            toolCall.duration = toolResult.duration;
          }
        }

        if (useMemory) {
          updateMemory(memory, step);
        }

        if (step.stepType === 'reflect' && step.content.includes('任务完成')) {
          taskCompleted = true;
        }

        step.status = 'completed';
        currentStep++;
      }

      const finalResult = generateFinalResult(task, steps, plan);
      const toolCallNames = steps.flatMap(
        (s) => s.toolCalls?.map((tc) => tc.toolName) || []
      );
      const toolsUsedSet = new Set(toolCallNames);
      const toolsUsed = Array.from(toolsUsedSet);
      const totalTime = Date.now() - startTime;

      return NextResponse.json({
        task,
        agentType,
        plan,
        steps,
        memory,
        finalResult,
        success: taskCompleted,
        totalTime,
        toolsUsed,
        model: modelName,
      });
    }
  } catch (error) {
    console.error('Agent API Error:', error);
    return NextResponse.json(
      {
        error: 'Agent处理时发生错误',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

// 初始化记忆
function initializeMemory(task: string): AgentMemory {
  return {
    shortTerm: {
      currentTask: task,
      context: [],
      recentActions: [],
    },
    longTerm: {
      experiences: [],
      patterns: [],
      preferences: {},
    },
  };
}

// 生成计划
async function generatePlan(
  task: string,
  agentType: string,
  modelName: string,
  temperature: number
): Promise<AgentPlan> {
  const chatInstance = new ChatOpenAI({
    openAIApiKey: process.env.OPEN_API_KEY,
    modelName,
    temperature,
    maxTokens: 800,
    configuration: {
      baseURL: process.env.OPEN_API_BASE_URL,
    },
  });

  const systemMessage = `你是一个智能体规划器，需要为给定任务制定详细的执行计划。

请按以下格式返回：
MAIN_GOAL: [主要目标]
STRATEGY: [执行策略]
SUBTASKS:
1. [子任务1] - 优先级: [1-5] - 依赖: [依赖的子任务]
2. [子任务2] - 优先级: [1-5] - 依赖: [依赖的子任务]
...
ESTIMATED_STEPS: [预估步骤数]`;

  const promptMessage = `任务: ${task}
智能体类型: ${agentType}

请为这个任务制定详细的执行计划：`;

  const messages = [
    new SystemMessage(systemMessage),
    new HumanMessage(promptMessage),
  ];

  const response = await chatInstance.invoke(messages);
  const content = response.content as string;

  return parsePlanResponse(content, task);
}

// 解析计划响应
function parsePlanResponse(content: string, task: string): AgentPlan {
  const mainGoalMatch = content.match(/MAIN_GOAL:\s*(.+)/);
  const strategyMatch = content.match(/STRATEGY:\s*(.+)/);
  const estimatedStepsMatch = content.match(/ESTIMATED_STEPS:\s*(\d+)/);

  const subTasksSection = content.match(
    /SUBTASKS:\s*([\s\S]*?)(?=ESTIMATED_STEPS:|$)/
  );
  const subTasks = [];

  if (subTasksSection) {
    const lines = subTasksSection[1].split('\n').filter((line) => line.trim());
    for (const line of lines) {
      const match = line.match(
        /\d+\.\s*(.+?)\s*-\s*优先级:\s*(\d+)\s*-\s*依赖:\s*(.+)/
      );
      if (match) {
        subTasks.push({
          id: `subtask_${subTasks.length + 1}`,
          description: match[1].trim(),
          priority: parseInt(match[2]),
          dependencies: match[3].trim() === '无' ? [] : [match[3].trim()],
          status: 'pending' as const,
        });
      }
    }
  }

  return {
    taskId: `task_${Date.now()}`,
    mainGoal: mainGoalMatch ? mainGoalMatch[1].trim() : task,
    subTasks,
    strategy: strategyMatch ? strategyMatch[1].trim() : '逐步执行',
    estimatedSteps: estimatedStepsMatch ? parseInt(estimatedStepsMatch[1]) : 5,
  };
}

// 生成智能体步骤
async function generateAgentStep(
  task: string,
  agentType: string,
  plan: AgentPlan,
  previousSteps: AgentStep[],
  memory: AgentMemory,
  tools: string[],
  modelName: string,
  temperature: number
): Promise<AgentStep> {
  const chatInstance = new ChatOpenAI({
    openAIApiKey: process.env.OPEN_API_KEY,
    modelName,
    temperature,
    maxTokens: 600,
    configuration: {
      baseURL: process.env.OPEN_API_BASE_URL,
    },
  });

  const agentConfig = AGENT_CONFIGS[agentType as keyof typeof AGENT_CONFIGS];
  const systemMessage = buildAgentSystemMessage(agentConfig, tools);
  const promptMessage = buildAgentPrompt(task, plan, previousSteps, memory);

  const messages = [
    new SystemMessage(systemMessage),
    new HumanMessage(promptMessage),
  ];

  const response = await chatInstance.invoke(messages);
  const content = response.content as string;

  return parseAgentStep(content, tools);
}

// 构建智能体系统消息
function buildAgentSystemMessage(agentConfig: any, tools: string[]): string {
  const toolsList = tools
    .map((tool) => {
      const toolDef = AVAILABLE_TOOLS[tool as keyof typeof AVAILABLE_TOOLS];
      return toolDef ? `${tool}: ${toolDef.description}` : tool;
    })
    .join('\n');

  return `${agentConfig.systemPrompt}

可用工具:
${toolsList}

请按以下格式返回每一步：
STEP_TYPE: [observe/think/plan/act/reflect/tool_use]
CONTENT: [步骤内容]
REASONING: [推理过程]
TOOL_CALLS: [如果需要使用工具，格式为 tool_name(input)]

保持步骤逻辑清晰，推理过程详细。`;
}

// 构建智能体提示
function buildAgentPrompt(
  task: string,
  plan: AgentPlan,
  previousSteps: AgentStep[],
  memory: AgentMemory
): string {
  let prompt = `任务: ${task}\n`;
  prompt += `计划: ${plan.strategy}\n`;
  prompt += `主要目标: ${plan.mainGoal}\n\n`;

  if (previousSteps.length > 0) {
    prompt += '之前的步骤:\n';
    previousSteps.slice(-3).forEach((step, index) => {
      prompt += `${step.stepNumber}. ${step.stepType}: ${step.content}\n`;
    });
    prompt += '\n';
  }

  if (memory.shortTerm.context.length > 0) {
    prompt += `当前上下文: ${memory.shortTerm.context.slice(-2).join(', ')}\n\n`;
  }

  prompt += `请生成下一步行动 (第 ${previousSteps.length + 1} 步):`;

  return prompt;
}

// 解析智能体步骤
function parseAgentStep(content: string, tools: string[]): AgentStep {
  const stepTypeMatch = content.match(/STEP_TYPE:\s*(.+)/);
  const contentMatch = content.match(/CONTENT:\s*(.+)/);
  const reasoningMatch = content.match(/REASONING:\s*(.+)/);
  const toolCallsMatch = content.match(/TOOL_CALLS:\s*(.+)/);

  const stepType = stepTypeMatch
    ? (stepTypeMatch[1].trim() as AgentStep['stepType'])
    : 'think';
  const stepContent = contentMatch ? contentMatch[1].trim() : '继续处理任务';
  const reasoning = reasoningMatch
    ? reasoningMatch[1].trim()
    : '基于当前情况的分析';

  const toolCalls: ToolCall[] = [];
  if (toolCallsMatch && toolCallsMatch[1].trim() !== '无') {
    const toolCallText = toolCallsMatch[1].trim();
    const toolMatch = toolCallText.match(/(\w+)\((.+)\)/);
    if (toolMatch && tools.includes(toolMatch[1])) {
      toolCalls.push({
        toolName: toolMatch[1],
        input: toolMatch[2],
        output: '',
        success: false,
        duration: 0,
      });
    }
  }

  return {
    stepNumber: 0, // 将在调用处设置
    stepType,
    content: stepContent,
    reasoning,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    timestamp: Date.now(),
    status: 'pending',
  };
}

// 执行工具调用
async function executeToolCall(toolCall: ToolCall): Promise<{
  output: string;
  success: boolean;
  duration: number;
}> {
  const startTime = Date.now();

  try {
    const tool =
      AVAILABLE_TOOLS[toolCall.toolName as keyof typeof AVAILABLE_TOOLS];
    if (!tool) {
      throw new Error(`未知工具: ${toolCall.toolName}`);
    }

    const output = await tool.function(toolCall.input);
    const duration = Date.now() - startTime;

    return {
      output,
      success: true,
      duration,
    };
  } catch (error) {
    return {
      output: `工具执行失败: ${error instanceof Error ? error.message : '未知错误'}`,
      success: false,
      duration: Date.now() - startTime,
    };
  }
}

// 更新记忆
function updateMemory(memory: AgentMemory, step: AgentStep): void {
  // 更新短期记忆
  memory.shortTerm.recentActions.push(step);
  if (memory.shortTerm.recentActions.length > 5) {
    memory.shortTerm.recentActions.shift();
  }

  memory.shortTerm.context.push(`${step.stepType}: ${step.content}`);
  if (memory.shortTerm.context.length > 10) {
    memory.shortTerm.context.shift();
  }

  // 更新长期记忆（简化实现）
  if (step.stepType === 'reflect') {
    memory.longTerm.experiences.push(step.content);
    if (memory.longTerm.experiences.length > 20) {
      memory.longTerm.experiences.shift();
    }
  }
}

// 生成最终结果
function generateFinalResult(
  task: string,
  steps: AgentStep[],
  plan: AgentPlan
): string {
  const completedSteps = steps.filter((s) => s.status === 'completed').length;
  const usedToolsSet = new Set(
    steps.flatMap((s) => s.toolCalls?.map((tc) => tc.toolName) || [])
  );
  const usedTools = Array.from(usedToolsSet);

  const lastStep = steps[steps.length - 1];
  const success =
    lastStep?.stepType === 'reflect' && lastStep.content.includes('任务完成');

  return `任务"${task}"执行${success ? '成功' : '部分'}完成！
执行了 ${completedSteps} 个步骤，使用了 ${usedTools.length} 个工具。
最终状态: ${lastStep?.content || '任务进行中'}

计划执行情况:
- 主要目标: ${plan.mainGoal}
- 策略: ${plan.strategy}
- 完成度: ${Math.round((completedSteps / plan.estimatedSteps) * 100)}%`;
}
