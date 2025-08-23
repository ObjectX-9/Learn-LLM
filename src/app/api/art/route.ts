import { NextRequest, NextResponse } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

export interface ARTRequest {
  task: string;
  domain:
    | 'math'
    | 'search'
    | 'reasoning'
    | 'data-analysis'
    | 'coding'
    | 'general';
  maxSteps: number;
  availableTools: string[];
  temperature?: number;
  modelName?: string;
  stream?: boolean;
}

export interface ToolCall {
  toolName: string;
  input: string;
  output: string;
  reasoning: string;
  success: boolean;
  duration: number;
}

export interface ReasoningStep {
  stepIndex: number;
  action: 'reasoning' | 'tool_call' | 'synthesis' | 'final_answer';
  content: string;
  toolCall?: ToolCall;
  timestamp: number;
}

export interface ARTResponse {
  task: string;
  domain: string;
  steps: ReasoningStep[];
  toolCalls: ToolCall[];
  finalAnswer: string;
  totalTime: number;
  selectedDemonstrations: string[];
  usedTools: string[];
}

export interface StreamMessage {
  type: string;
  message?: string;
  step?: ReasoningStep;
  toolCall?: ToolCall;
  result?: ARTResponse;
  error?: string;
}

// 工具定义
const AVAILABLE_TOOLS = {
  calculator: {
    name: 'calculator',
    description: '执行数学计算',
    usage: 'calculator(expression)',
    examples: [
      'calculator("2 + 2")',
      'calculator("sqrt(16)")',
      'calculator("sin(pi/2)")',
    ],
  },
  search: {
    name: 'search',
    description: '搜索信息和知识',
    usage: 'search(query)',
    examples: [
      'search("Python list methods")',
      'search("climate change effects")',
    ],
  },
  code_executor: {
    name: 'code_executor',
    description: '执行Python代码',
    usage: 'code_executor(code)',
    examples: ['code_executor("print([x**2 for x in range(5)])")'],
  },
  data_analyzer: {
    name: 'data_analyzer',
    description: '分析数据和统计',
    usage: 'data_analyzer(data, analysis_type)',
    examples: [
      'data_analyzer("[1,2,3,4,5]", "mean")',
      'data_analyzer("data.csv", "correlation")',
    ],
  },
  text_processor: {
    name: 'text_processor',
    description: '处理和分析文本',
    usage: 'text_processor(text, operation)',
    examples: [
      'text_processor("Hello World", "word_count")',
      'text_processor("text", "sentiment")',
    ],
  },
};

// 任务库 - 包含不同领域的多步推理示范
const TASK_DEMONSTRATIONS = {
  math: [
    {
      task: '计算一个圆形花园的面积，半径为5米，然后计算需要多少袋种子（每袋覆盖10平方米）',
      steps: [
        'STEP 1: calculator("pi * 5**2") - 计算圆形花园面积',
        'STEP 2: calculator("78.54 / 10") - 将面积除以每袋覆盖面积',
        'STEP 3: calculator("ceil(7.854)") - 向上取整得到袋数',
        'FINAL: 需要8袋种子',
      ],
      tools: ['calculator'],
    },
    {
      task: '解方程 2x + 5 = 15，并验证答案',
      steps: [
        'STEP 1: [reasoning] - 移项得到 2x = 15 - 5',
        'STEP 2: calculator("15 - 5") - 计算右边的值',
        'STEP 3: calculator("10 / 2") - 除以2得到x的值',
        'STEP 4: calculator("2 * 5 + 5") - 验证答案是否正确',
        'FINAL: x = 5，验证通过',
      ],
      tools: ['calculator'],
    },
  ],

  search: [
    {
      task: '研究Python中列表和元组的区别，并提供代码示例',
      steps: [
        'STEP 1: search("Python list characteristics mutable") - 搜索Python列表特性',
        'STEP 2: search("Python tuple characteristics immutable") - 搜索Python元组特性',
        'STEP 3: code_executor("list_ex = [1,2,3]; tuple_ex = (1,2,3); print(type(list_ex), type(tuple_ex))") - 生成对比代码',
        'FINAL: 整合搜索结果和代码示例',
      ],
      tools: ['search', 'code_executor'],
    },
  ],

  reasoning: [
    {
      task: '分析一个逻辑谜题：三个盒子，一个装金币，标签都贴错了，最少开几个盒子能确定？',
      steps: [
        '1. 理解问题：所有标签都贴错，需要找到最优策略',
        "2. 推理：由于所有标签都错，标记'金币'的盒子一定不是金币",
        "3. 分析：开标记'金币'的盒子，看到什么都能确定所有盒子",
        '4. 验证推理：text_processor("逻辑推理验证", "logic_check")',
        '最终答案：只需开1个盒子',
      ],
      tools: ['text_processor'],
    },
  ],

  'data-analysis': [
    {
      task: '分析销售数据[100, 120, 90, 150, 200]，计算趋势和预测',
      steps: [
        '1. 计算基本统计：data_analyzer("[100, 120, 90, 150, 200]", "basic_stats")',
        '2. 分析趋势：data_analyzer("[100, 120, 90, 150, 200]", "trend")',
        '3. 计算增长率：calculator("(200 - 100) / 100 * 100")',
        '最终答案：提供完整的数据分析报告',
      ],
      tools: ['data_analyzer', 'calculator'],
    },
  ],

  coding: [
    {
      task: '编写函数计算斐波那契数列第n项，并测试性能',
      steps: [
        '1. 搜索斐波那契算法：search("fibonacci algorithm implementations Python")',
        '2. 实现递归版本：code_executor("def fib_recursive(n):\\n    if n <= 1: return n\\n    return fib_recursive(n-1) + fib_recursive(n-2)")',
        '3. 实现迭代版本：code_executor("def fib_iterative(n):\\n    a, b = 0, 1\\n    for _ in range(n): a, b = b, a + b\\n    return a")',
        '4. 性能测试：code_executor("import time; # 测试两种方法的性能")',
        '最终答案：提供优化的斐波那契实现',
      ],
      tools: ['search', 'code_executor'],
    },
  ],
};

export async function POST(request: NextRequest) {
  try {
    const body: ARTRequest = await request.json();
    const {
      task,
      domain,
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
              message: '开始ART自动推理...',
              domain,
              availableTools,
            })}\n\n`;
            controller.enqueue(encoder.encode(startData));

            const steps: ReasoningStep[] = [];
            const toolCalls: ToolCall[] = [];
            let stepIndex = 0;

            // 1. 选择相关示范
            const demonstrations = selectDemonstrations(task, domain);

            const demoData = `data: ${JSON.stringify({
              type: 'demonstrations_selected',
              message: `选择了 ${demonstrations.length} 个相关示范`,
              demonstrations: demonstrations.map((d) => d.task),
            })}\n\n`;
            controller.enqueue(encoder.encode(demoData));

            // 2. 生成推理计划
            const plan = await generateReasoningPlan(
              task,
              domain,
              demonstrations,
              availableTools,
              modelName,
              temperature
            );

            const planData = `data: ${JSON.stringify({
              type: 'plan_generated',
              message: '生成推理计划完成',
              plan: plan,
            })}\n\n`;
            controller.enqueue(encoder.encode(planData));

            // 3. 执行推理步骤
            const planSteps = parsePlan(plan);

            for (const planStep of planSteps) {
              if (stepIndex >= maxSteps) break;

              const reasoningStep: ReasoningStep = {
                stepIndex: stepIndex++,
                action: planStep.action,
                content: planStep.content,
                timestamp: Date.now(),
              };

              // 发送步骤开始信号
              const stepStartData = `data: ${JSON.stringify({
                type: 'step_start',
                step: reasoningStep,
              })}\n\n`;
              controller.enqueue(encoder.encode(stepStartData));

              if (
                planStep.action === 'tool_call' &&
                planStep.toolName &&
                planStep.toolInput
              ) {
                // 执行工具调用
                const toolResult = await executeToolCall(
                  planStep.toolName,
                  planStep.toolInput
                );

                reasoningStep.toolCall = toolResult;
                toolCalls.push(toolResult);

                // 发送工具调用结果
                const toolData = `data: ${JSON.stringify({
                  type: 'tool_call_complete',
                  toolCall: toolResult,
                })}\n\n`;
                controller.enqueue(encoder.encode(toolData));

                // 更新步骤内容，包含工具结果
                reasoningStep.content += `\n工具输出: ${toolResult.output}`;
              }

              steps.push(reasoningStep);

              // 发送步骤完成信号
              const stepCompleteData = `data: ${JSON.stringify({
                type: 'step_complete',
                step: reasoningStep,
              })}\n\n`;
              controller.enqueue(encoder.encode(stepCompleteData));
            }

            // 4. 生成最终答案
            const finalAnswer = await generateFinalAnswer(
              task,
              steps,
              toolCalls,
              modelName,
              temperature
            );

            const totalTime = Date.now() - startTime;
            const usedToolsSet = new Set(toolCalls.map((tc) => tc.toolName));
            const usedTools = Array.from(usedToolsSet);

            // 发送最终结果
            const finalData = `data: ${JSON.stringify({
              type: 'final_result',
              result: {
                task,
                domain,
                steps,
                toolCalls,
                finalAnswer,
                totalTime,
                selectedDemonstrations: demonstrations.map((d) => d.task),
                usedTools,
              },
            })}\n\n`;
            controller.enqueue(encoder.encode(finalData));

            // 发送完成信号
            const doneData = `data: ${JSON.stringify({ type: 'done' })}\n\n`;
            controller.enqueue(encoder.encode(doneData));
            controller.close();
          } catch (error) {
            console.error('ART Stream Error:', error);
            const errorData = `data: ${JSON.stringify({
              type: 'error',
              error: 'ART处理过程发生错误',
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
      const steps: ReasoningStep[] = [];
      const toolCalls: ToolCall[] = [];

      const demonstrations = selectDemonstrations(task, domain);
      const plan = await generateReasoningPlan(
        task,
        domain,
        demonstrations,
        availableTools,
        modelName,
        temperature
      );
      const planSteps = parsePlan(plan);

      let stepIndex = 0;
      for (const planStep of planSteps) {
        if (stepIndex >= maxSteps) break;

        const reasoningStep: ReasoningStep = {
          stepIndex: stepIndex++,
          action: planStep.action,
          content: planStep.content,
          timestamp: Date.now(),
        };

        if (
          planStep.action === 'tool_call' &&
          planStep.toolName &&
          planStep.toolInput
        ) {
          const toolResult = await executeToolCall(
            planStep.toolName,
            planStep.toolInput
          );
          reasoningStep.toolCall = toolResult;
          toolCalls.push(toolResult);
          reasoningStep.content += `\n工具输出: ${toolResult.output}`;
        }

        steps.push(reasoningStep);
      }

      const finalAnswer = await generateFinalAnswer(
        task,
        steps,
        toolCalls,
        modelName,
        temperature
      );
      const totalTime = Date.now() - startTime;
      const usedToolsSet = new Set(toolCalls.map((tc) => tc.toolName));
      const usedTools = Array.from(usedToolsSet);

      return NextResponse.json({
        task,
        domain,
        steps,
        toolCalls,
        finalAnswer,
        totalTime,
        selectedDemonstrations: demonstrations.map((d) => d.task),
        usedTools,
        model: modelName,
      });
    }
  } catch (error) {
    console.error('ART API Error:', error);
    return NextResponse.json(
      {
        error: 'ART处理时发生错误',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

// 选择相关示范
function selectDemonstrations(task: string, domain: string) {
  const domainDemos =
    TASK_DEMONSTRATIONS[domain as keyof typeof TASK_DEMONSTRATIONS] || [];

  // 简化版：返回该领域的所有示范（实际应该基于任务相似度选择）
  return domainDemos.slice(0, 2); // 限制为最多2个示范
}

// 生成推理计划
async function generateReasoningPlan(
  task: string,
  domain: string,
  demonstrations: any[],
  availableTools: string[],
  modelName: string,
  temperature: number
): Promise<string> {
  const chatInstance = new ChatOpenAI({
    openAIApiKey: process.env.OPEN_API_KEY,
    modelName,
    temperature,
    maxTokens: 1500,
    configuration: {
      baseURL: process.env.OPEN_API_BASE_URL,
    },
  });

  const systemMessage = buildARTSystemMessage(domain, availableTools);
  const promptMessage = buildARTPlanPrompt(task, demonstrations);

  const messages = [
    new SystemMessage(systemMessage),
    new HumanMessage(promptMessage),
  ];

  const response = await chatInstance.invoke(messages);
  return response.content as string;
}

// 构建ART系统消息
function buildARTSystemMessage(
  domain: string,
  availableTools: string[]
): string {
  const toolDescriptions = availableTools
    .map((toolName) => {
      const tool = AVAILABLE_TOOLS[toolName as keyof typeof AVAILABLE_TOOLS];
      return tool
        ? `- ${tool.name}: ${tool.description} (用法: ${tool.usage})`
        : '';
    })
    .filter(Boolean)
    .join('\n');

  return `你是一个ART (Automatic Reasoning and Tool-use) 系统，专门从事自动推理和工具使用。

你的任务是分析给定的任务，并生成一个详细的推理计划，该计划应该：
1. 将复杂任务分解为可管理的步骤
2. 在适当的地方识别并调用相关工具
3. 确保推理过程逻辑清晰且高效

领域: ${domain}

可用工具:
${toolDescriptions}

请按以下格式生成计划：
STEP 1: calculator("expression") - 计算描述 (如需调用工具)
STEP 2: [reasoning] - 推理描述 (如为纯推理)
STEP 3: search("query") - 搜索描述 (如需搜索)
...
FINAL: 最终答案

工具调用格式：直接写工具名(参数)，如calculator("pi * 5**2")、search("Python list")等。
推理步骤格式：[reasoning] - 描述推理过程。`;
}

// 构建ART计划提示
function buildARTPlanPrompt(task: string, demonstrations: any[]): string {
  const demoText = demonstrations
    .map((demo) => {
      return `示范任务: ${demo.task}\n步骤:\n${demo.steps.join('\n')}\n使用工具: ${demo.tools.join(', ')}\n`;
    })
    .join('\n---\n');

  return `基于以下示范，为新任务生成推理计划：

相关示范:
${demoText}

新任务: ${task}

请生成详细的推理计划：`;
}

// 解析计划步骤
function parsePlan(plan: string): Array<{
  action: 'reasoning' | 'tool_call' | 'final_answer';
  content: string;
  toolName?: string;
  toolInput?: string;
}> {
  const lines = plan.split('\n').filter((line) => line.trim());
  const steps: Array<any> = [];

  for (const line of lines) {
    if (line.match(/^STEP \d+:/)) {
      // 支持两种格式：
      // 1. STEP 1: [tool_call] - content
      // 2. STEP 1: calculator("pi * 5**2") - content
      const bracketMatch = line.match(/^STEP \d+: \[(.*?)\] - (.*)$/);
      const directMatch = line.match(/^STEP \d+: (.*)$/);

      if (bracketMatch) {
        const [, actionType, content] = bracketMatch;
        if (actionType === 'tool_call') {
          const toolMatch = content.match(/(\w+)\((.*?)\)/);
          if (toolMatch) {
            const [, toolName, toolInput] = toolMatch;
            steps.push({
              action: 'tool_call',
              content,
              toolName,
              toolInput: toolInput.replace(/"/g, ''),
            });
          } else {
            steps.push({ action: 'reasoning', content });
          }
        } else {
          steps.push({ action: 'reasoning', content });
        }
      } else if (directMatch) {
        const [, fullContent] = directMatch;
        // 检查是否包含工具调用
        const toolMatch = fullContent.match(/(\w+)\((.*?)\)/);
        if (toolMatch) {
          const [, toolName, toolInput] = toolMatch;
          steps.push({
            action: 'tool_call',
            content: fullContent,
            toolName,
            toolInput: toolInput.replace(/"/g, ''),
          });
        } else {
          steps.push({ action: 'reasoning', content: fullContent });
        }
      }
    } else if (line.match(/^FINAL:/)) {
      const content = line.replace(/^FINAL: (\[.*?\] - )?/, '');
      steps.push({ action: 'final_answer', content });
    }
  }

  return steps;
}

// 执行工具调用
async function executeToolCall(
  toolName: string,
  input: string
): Promise<ToolCall> {
  const startTime = Date.now();

  try {
    let output = '';

    switch (toolName) {
      case 'calculator':
        output = simulateCalculator(input);
        break;
      case 'search':
        output = simulateSearch(input);
        break;
      case 'code_executor':
        output = simulateCodeExecution(input);
        break;
      case 'data_analyzer':
        output = simulateDataAnalysis(input);
        break;
      case 'text_processor':
        output = simulateTextProcessing(input);
        break;
      default:
        output = `工具 ${toolName} 未实现`;
    }

    return {
      toolName,
      input,
      output,
      reasoning: `调用 ${toolName} 处理输入: ${input}`,
      success: true,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      toolName,
      input,
      output: `工具执行失败: ${error instanceof Error ? error.message : '未知错误'}`,
      reasoning: `工具 ${toolName} 执行出错`,
      success: false,
      duration: Date.now() - startTime,
    };
  }
}

// 模拟工具实现
function simulateCalculator(expression: string): string {
  try {
    // 安全的数学表达式计算（实际应用中需要更安全的实现）
    const result = eval(expression.replace(/[^0-9+\-*/().\s]/g, ''));
    return `计算结果: ${result}`;
  } catch {
    return '计算表达式无效';
  }
}

function simulateSearch(query: string): string {
  // 模拟搜索结果
  const mockResults = [
    `关于 "${query}" 的搜索结果：`,
    '- 相关定义和概念解释',
    '- 实际应用场景和示例',
    '- 最佳实践和注意事项',
  ];
  return mockResults.join('\n');
}

function simulateCodeExecution(code: string): string {
  // 模拟代码执行（实际应用中需要安全的沙箱环境）
  return `代码执行结果：\n${code}\n输出: [模拟执行结果]`;
}

function simulateDataAnalysis(input: string): string {
  return `数据分析结果：\n输入: ${input}\n- 基本统计信息\n- 趋势分析\n- 关键洞察`;
}

function simulateTextProcessing(input: string): string {
  return `文本处理结果：\n输入: ${input}\n- 处理完成\n- 提取的关键信息`;
}

// 生成最终答案
async function generateFinalAnswer(
  task: string,
  steps: ReasoningStep[],
  toolCalls: ToolCall[],
  modelName: string,
  temperature: number
): Promise<string> {
  const chatInstance = new ChatOpenAI({
    openAIApiKey: process.env.OPEN_API_KEY,
    modelName,
    temperature: 0.3, // 较低温度确保一致性
    maxTokens: 800,
    configuration: {
      baseURL: process.env.OPEN_API_BASE_URL,
    },
  });

  const systemMessage =
    '你是一个专业的助手，需要基于推理步骤和工具调用结果生成最终答案。';

  const stepsText = steps
    .map(
      (step) =>
        `步骤 ${step.stepIndex + 1}: ${step.content}${step.toolCall ? `\n工具结果: ${step.toolCall.output}` : ''}`
    )
    .join('\n\n');

  const promptMessage = `原始任务: ${task}

推理过程:
${stepsText}

请基于以上推理过程和工具调用结果，生成一个清晰、完整的最终答案。答案应该：
1. 直接回答原始任务
2. 总结关键步骤和发现
3. 如果适用，提供具体的数值或结论

最终答案:`;

  const messages = [
    new SystemMessage(systemMessage),
    new HumanMessage(promptMessage),
  ];

  const response = await chatInstance.invoke(messages);
  return response.content as string;
}
