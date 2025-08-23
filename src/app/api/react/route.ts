import { NextRequest, NextResponse } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

export interface ReActRequest {
  question: string;
  taskType: 'knowledge' | 'decision' | 'reasoning' | 'general';
  maxSteps: number;
  availableTools: string[];
  temperature?: number;
  modelName?: string;
  stream?: boolean;
}

export interface ReActStep {
  stepNumber: number;
  thought: string;
  action: string;
  actionInput: string;
  observation: string;
  timestamp: number;
}

export interface ToolCall {
  toolName: string;
  input: string;
  output: string;
  success: boolean;
  duration: number;
}

export interface ReActResponse {
  question: string;
  taskType: string;
  steps: ReActStep[];
  toolCalls: ToolCall[];
  finalAnswer: string;
  totalSteps: number;
  totalTime: number;
  usedTools: string[];
  reasoning: string;
}

export interface StreamMessage {
  type: string;
  message?: string;
  step?: ReActStep;
  toolCall?: ToolCall;
  result?: ReActResponse;
  error?: string;
}

// 可用工具定义
const AVAILABLE_TOOLS = {
  search: {
    name: '搜索',
    description: '搜索相关信息和知识',
    usage: 'search[查询内容]',
    examples: ['search[奥利维亚·王尔德的男朋友]', 'search[科罗拉多造山带]'],
  },
  calculator: {
    name: '计算器',
    description: '执行数学计算',
    usage: 'calculator[数学表达式]',
    examples: ['calculator[29^0.23]', 'calculator[sqrt(16) + 5]'],
  },
  knowledge: {
    name: '知识库',
    description: '查询专业知识和事实',
    usage: 'knowledge[知识查询]',
    examples: ['knowledge[地理高度信息]', 'knowledge[历史事件]'],
  },
  lookup: {
    name: '查找',
    description: '在文档或数据中查找特定信息',
    usage: 'lookup[查找内容]',
    examples: ['lookup[东部地区]', 'lookup[海拔高度]'],
  },
  finish: {
    name: '完成',
    description: '提供最终答案并结束',
    usage: 'finish[最终答案]',
    examples: ['finish[1800到7000英尺]', 'finish[哈里·斯泰尔斯，29岁]'],
  },
};

// 任务类型配置
const TASK_CONFIGS = {
  knowledge: {
    name: '知识密集型',
    description: '需要外部知识的问答和事实验证',
    preferredTools: ['search', 'knowledge', 'lookup', 'finish'],
    maxThoughts: 3,
  },
  decision: {
    name: '决策型',
    description: '需要规划和决策的复杂任务',
    preferredTools: ['search', 'calculator', 'lookup', 'finish'],
    maxThoughts: 2,
  },
  reasoning: {
    name: '推理型',
    description: '需要逻辑推理和计算的问题',
    preferredTools: ['calculator', 'knowledge', 'search', 'finish'],
    maxThoughts: 4,
  },
  general: {
    name: '通用型',
    description: '各种类型的综合问题',
    preferredTools: ['search', 'calculator', 'knowledge', 'lookup', 'finish'],
    maxThoughts: 3,
  },
};

export async function POST(request: NextRequest) {
  try {
    const body: ReActRequest = await request.json();
    const {
      question,
      taskType,
      maxSteps,
      availableTools,
      temperature = 0.7,
      modelName = 'gpt-3.5-turbo',
      stream = true,
    } = body;

    const startTime = Date.now();

    if (stream) {
      // 流式响应
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          try {
            // 发送开始信号
            const startData = `data: ${JSON.stringify({
              type: 'start',
              message: '开始ReAct推理...',
              question,
              taskType,
              maxSteps,
            })}\n\n`;
            controller.enqueue(encoder.encode(startData));

            const steps: ReActStep[] = [];
            const toolCalls: ToolCall[] = [];
            let stepNumber = 1;
            let finalAnswer = '';
            let isFinished = false;

            // ReAct循环：思考-行动-观察
            while (stepNumber <= maxSteps && !isFinished) {
              // 生成思考和行动
              const thoughtAction = await generateThoughtAndAction(
                question,
                taskType,
                steps,
                availableTools,
                modelName,
                temperature
              );

              // 检查是否是完成行动
              if (thoughtAction.action === 'finish') {
                finalAnswer = thoughtAction.actionInput;
                isFinished = true;
              }

              // 执行行动并获取观察
              let observation = '';
              let toolCall: ToolCall | null = null;

              if (!isFinished) {
                const actionResult = await executeAction(
                  thoughtAction.action,
                  thoughtAction.actionInput
                );
                observation = actionResult.output;
                toolCall = actionResult;
                toolCalls.push(toolCall);
              } else {
                observation = '任务完成';
              }

              const step: ReActStep = {
                stepNumber,
                thought: thoughtAction.thought,
                action: thoughtAction.action,
                actionInput: thoughtAction.actionInput,
                observation,
                timestamp: Date.now(),
              };

              steps.push(step);

              // 发送步骤结果
              const stepData = `data: ${JSON.stringify({
                type: 'step_complete',
                step,
              })}\n\n`;
              controller.enqueue(encoder.encode(stepData));

              // 如果有工具调用，发送工具调用结果
              if (toolCall) {
                const toolData = `data: ${JSON.stringify({
                  type: 'tool_call',
                  toolCall,
                })}\n\n`;
                controller.enqueue(encoder.encode(toolData));
              }

              stepNumber++;
            }

            // 如果没有完成，生成最终答案
            if (!isFinished && steps.length > 0) {
              finalAnswer = await generateFinalAnswer(
                question,
                steps,
                modelName,
                temperature
              );
            }

            const totalTime = Date.now() - startTime;
            const usedToolsSet = new Set(toolCalls.map((tc) => tc.toolName));
            const usedTools = Array.from(usedToolsSet);

            // 发送最终结果
            const finalData = `data: ${JSON.stringify({
              type: 'final_result',
              result: {
                question,
                taskType,
                steps,
                toolCalls,
                finalAnswer,
                totalSteps: steps.length,
                totalTime,
                usedTools,
                reasoning: generateReasoningSummary(steps),
              },
            })}\n\n`;
            controller.enqueue(encoder.encode(finalData));

            // 发送完成信号
            const doneData = `data: ${JSON.stringify({ type: 'done' })}\n\n`;
            controller.enqueue(encoder.encode(doneData));
            controller.close();
          } catch (error) {
            console.error('ReAct Stream Error:', error);
            const errorData = `data: ${JSON.stringify({
              type: 'error',
              error: 'ReAct处理过程发生错误',
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
      const steps: ReActStep[] = [];
      const toolCalls: ToolCall[] = [];
      let stepNumber = 1;
      let finalAnswer = '';
      let isFinished = false;

      while (stepNumber <= maxSteps && !isFinished) {
        const thoughtAction = await generateThoughtAndAction(
          question,
          taskType,
          steps,
          availableTools,
          modelName,
          temperature
        );

        if (thoughtAction.action === 'finish') {
          finalAnswer = thoughtAction.actionInput;
          isFinished = true;
        }

        let observation = '';
        let toolCall: ToolCall | null = null;

        if (!isFinished) {
          const actionResult = await executeAction(
            thoughtAction.action,
            thoughtAction.actionInput
          );
          observation = actionResult.output;
          toolCall = actionResult;
          toolCalls.push(toolCall);
        } else {
          observation = '任务完成';
        }

        steps.push({
          stepNumber,
          thought: thoughtAction.thought,
          action: thoughtAction.action,
          actionInput: thoughtAction.actionInput,
          observation,
          timestamp: Date.now(),
        });

        stepNumber++;
      }

      if (!isFinished && steps.length > 0) {
        finalAnswer = await generateFinalAnswer(
          question,
          steps,
          modelName,
          temperature
        );
      }

      const totalTime = Date.now() - startTime;
      const usedToolsSet = new Set(toolCalls.map((tc) => tc.toolName));
      const usedTools = Array.from(usedToolsSet);

      return NextResponse.json({
        question,
        taskType,
        steps,
        toolCalls,
        finalAnswer,
        totalSteps: steps.length,
        totalTime,
        usedTools,
        reasoning: generateReasoningSummary(steps),
        model: modelName,
      });
    }
  } catch (error) {
    console.error('ReAct API Error:', error);
    return NextResponse.json(
      {
        error: 'ReAct处理时发生错误',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

// 生成思考和行动
async function generateThoughtAndAction(
  question: string,
  taskType: string,
  previousSteps: ReActStep[],
  availableTools: string[],
  modelName: string,
  temperature: number
): Promise<{ thought: string; action: string; actionInput: string }> {
  const chatInstance = new ChatOpenAI({
    openAIApiKey: process.env.OPEN_API_KEY,
    modelName,
    temperature,
    maxTokens: 800,
    configuration: {
      baseURL: process.env.OPEN_API_BASE_URL,
    },
  });

  const systemMessage = buildReActSystemMessage(taskType, availableTools);
  const promptMessage = buildReActPrompt(question, previousSteps);

  const messages = [
    new SystemMessage(systemMessage),
    new HumanMessage(promptMessage),
  ];

  const response = await chatInstance.invoke(messages);
  const content = response.content as string;

  return parseThoughtAndAction(content);
}

// 构建ReAct系统消息
function buildReActSystemMessage(
  taskType: string,
  availableTools: string[]
): string {
  const taskConfig = TASK_CONFIGS[taskType as keyof typeof TASK_CONFIGS];
  const toolDescriptions = availableTools
    .map((toolName) => {
      const tool = AVAILABLE_TOOLS[toolName as keyof typeof AVAILABLE_TOOLS];
      return tool
        ? `${tool.name}: ${tool.description} (用法: ${tool.usage})`
        : '';
    })
    .filter(Boolean)
    .join('\n');

  return `你是一个ReAct代理，使用推理和行动的交错框架来解决问题。

任务类型: ${taskConfig.name}
任务描述: ${taskConfig.description}

可用工具:
${toolDescriptions}

你必须按照以下格式进行推理：

思考: [分析当前情况，制定下一步计划]
行动: [选择一个工具]
行动输入: [工具的输入参数]

重要规则:
1. 每次只能执行一个行动
2. 思考要清晰地分析问题和制定计划
3. 行动必须从可用工具中选择
4. 当你有足够信息回答问题时，使用finish行动
5. 保持推理过程逻辑清晰

请严格按照格式返回，不要添加其他内容。`;
}

// 构建ReAct提示
function buildReActPrompt(
  question: string,
  previousSteps: ReActStep[]
): string {
  let prompt = `问题: ${question}\n\n`;

  if (previousSteps.length > 0) {
    prompt += '之前的步骤:\n';
    previousSteps.forEach((step) => {
      prompt += `思考 ${step.stepNumber}: ${step.thought}\n`;
      prompt += `行动 ${step.stepNumber}: ${step.action}\n`;
      prompt += `行动输入 ${step.stepNumber}: ${step.actionInput}\n`;
      prompt += `观察 ${step.stepNumber}: ${step.observation}\n\n`;
    });
  }

  prompt += `现在进行下一步推理 (第 ${previousSteps.length + 1} 步):`;

  return prompt;
}

// 解析思考和行动
function parseThoughtAndAction(content: string): {
  thought: string;
  action: string;
  actionInput: string;
} {
  const thoughtMatch = content.match(/思考:\s*([\s\S]*?)(?=\n行动:|$)/);
  const actionMatch = content.match(/行动:\s*([\s\S]*?)(?=\n行动输入:|$)/);
  const actionInputMatch = content.match(/行动输入:\s*([\s\S]*?)$/);

  const thought = thoughtMatch ? thoughtMatch[1].trim() : '继续分析问题';
  const action = actionMatch ? actionMatch[1].trim() : 'search';
  const actionInput = actionInputMatch ? actionInputMatch[1].trim() : '';

  return { thought, action, actionInput };
}

// 执行行动
async function executeAction(
  action: string,
  actionInput: string
): Promise<ToolCall> {
  const startTime = Date.now();

  try {
    let output = '';

    switch (action) {
      case 'search':
        output = simulateSearch(actionInput);
        break;
      case 'calculator':
        output = simulateCalculator(actionInput);
        break;
      case 'knowledge':
        output = simulateKnowledge(actionInput);
        break;
      case 'lookup':
        output = simulateLookup(actionInput);
        break;
      default:
        output = `未知行动: ${action}`;
    }

    return {
      toolName: action,
      input: actionInput,
      output,
      success: true,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      toolName: action,
      input: actionInput,
      output: `工具执行失败: ${error instanceof Error ? error.message : '未知错误'}`,
      success: false,
      duration: Date.now() - startTime,
    };
  }
}

// 模拟搜索工具
function simulateSearch(query: string): string {
  const searchResults = {
    '奥利维亚·王尔德的男朋友':
      '奥利维亚·王尔德与杰森·苏代基斯在多年前订婚，在他们分手后，她开始与哈里·斯泰尔斯约会。',
    '哈里·斯泰尔斯的年龄': '29岁',
    科罗拉多造山带: '科罗拉多造山带是科罗拉多及其周边地区造山运动的一段。',
    东部地区: '东部区域延伸至高平原，称为中原造山带。',
    高平原: '高平原指的是两个截然不同的陆地区域之一。',
    '高平原（美国）':
      '高平原是大平原的一个分区。从东到西，高平原的海拔从1800到7000英尺(550到2130米)不等。',
  };

  return (
    searchResults[query as keyof typeof searchResults] ||
    `搜索"${query}"的结果：找到相关信息，但需要进一步查询具体细节。`
  );
}

// 模拟计算器工具
function simulateCalculator(expression: string): string {
  try {
    // 安全的表达式计算模拟
    if (expression.includes('^')) {
      const match = expression.match(/(\d+)\^(\d*\.?\d+)/);
      if (match) {
        const base = parseFloat(match[1]);
        const exponent = parseFloat(match[2]);
        const result = Math.pow(base, exponent);
        return `计算结果: ${result}`;
      }
    }

    // 处理其他数学表达式
    const result = eval(expression.replace(/[^0-9+\-*/().\s]/g, ''));
    return `计算结果: ${result}`;
  } catch {
    return `计算表达式"${expression}"时出错，请检查表达式格式。`;
  }
}

// 模拟知识库工具
function simulateKnowledge(query: string): string {
  const knowledgeBase = {
    地理高度信息: '地理高度通常以海拔米数表示，不同地区的海拔差异很大。',
    历史事件: '历史事件需要具体的时间、地点和人物信息才能准确查询。',
    人物信息: '查询人物信息时需要提供具体的姓名和查询内容。',
  };

  return (
    knowledgeBase[query as keyof typeof knowledgeBase] ||
    `关于"${query}"的知识库查询结果：找到相关条目，建议进一步搜索获取详细信息。`
  );
}

// 模拟查找工具
function simulateLookup(query: string): string {
  return `查找"${query}": 在当前文档中找到相关信息，请根据上下文继续分析。`;
}

// 生成最终答案
async function generateFinalAnswer(
  question: string,
  steps: ReActStep[],
  modelName: string,
  temperature: number
): Promise<string> {
  const chatInstance = new ChatOpenAI({
    openAIApiKey: process.env.OPEN_API_KEY,
    modelName,
    temperature: 0.3,
    maxTokens: 500,
    configuration: {
      baseURL: process.env.OPEN_API_BASE_URL,
    },
  });

  const systemMessage =
    '你是一个专业的助手，需要基于ReAct推理步骤生成最终答案。';

  const stepsText = steps
    .map(
      (step) =>
        `步骤${step.stepNumber}: ${step.thought}\n行动: ${step.action}(${step.actionInput})\n观察: ${step.observation}`
    )
    .join('\n\n');

  const promptMessage = `原始问题: ${question}

ReAct推理过程:
${stepsText}

请基于以上推理过程，生成一个清晰、准确的最终答案:`;

  const messages = [
    new SystemMessage(systemMessage),
    new HumanMessage(promptMessage),
  ];

  const response = await chatInstance.invoke(messages);
  return response.content as string;
}

// 生成推理总结
function generateReasoningSummary(steps: ReActStep[]): string {
  if (steps.length === 0) return '未进行推理';

  const summary = steps
    .map(
      (step) =>
        `${step.stepNumber}. ${step.thought.substring(0, 100)}${step.thought.length > 100 ? '...' : ''}`
    )
    .join(' → ');

  return `推理路径: ${summary}`;
}
