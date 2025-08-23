import { NextRequest, NextResponse } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

export interface PromptStep {
  id: string;
  name: string;
  systemMessage: string;
  promptTemplate: string;
  outputVariable: string; // 此步骤输出存储的变量名
  inputVariables?: string[]; // 此步骤需要的输入变量
}

export interface PromptChainRequest {
  chainType:
    | 'document-qa'
    | 'text-analysis'
    | 'code-explanation'
    | 'data-processing'
    | 'custom';
  steps: PromptStep[];
  initialInputs: Record<string, string>; // 初始输入变量
  modelName?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface StepResult {
  stepId: string;
  stepName: string;
  input: string;
  output: string;
  variables: Record<string, string>;
  duration: number;
  tokens: number;
}

export interface PromptChainResponse {
  chainType: string;
  steps: StepResult[];
  finalResult: string;
  allVariables: Record<string, string>;
  totalTime: number;
  totalTokens: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: PromptChainRequest = await request.json();
    const {
      chainType,
      steps: requestSteps,
      initialInputs,
      modelName = 'gpt-3.5-turbo',
      temperature = 0.7,
      maxTokens = 2000,
      stream = true,
    } = body;

    // 如果没有提供步骤，从模板自动获取
    const steps =
      requestSteps.length > 0 ? requestSteps : getChainTemplate(chainType);

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
              message: '开始执行链式提示...',
              chainType: chainType,
              totalSteps: steps.length,
            })}\n\n`;
            controller.enqueue(encoder.encode(startData));

            const stepResults: StepResult[] = [];
            let currentVariables = { ...initialInputs };

            // 执行每个步骤
            for (let i = 0; i < steps.length; i++) {
              const step = steps[i];

              // 发送步骤开始信号
              const stepStartData = `data: ${JSON.stringify({
                type: 'step_start',
                stepIndex: i + 1,
                stepId: step.id,
                stepName: step.name,
                message: `正在执行步骤 ${i + 1}: ${step.name}...`,
              })}\n\n`;
              controller.enqueue(encoder.encode(stepStartData));

              const stepStartTime = Date.now();

              try {
                // 构建当前步骤的提示
                const processedPrompt = replaceVariables(
                  step.promptTemplate,
                  currentVariables
                );

                // 执行步骤
                const stepOutput = await executeStep(
                  step,
                  processedPrompt,
                  modelName,
                  temperature,
                  maxTokens
                );

                const stepDuration = Date.now() - stepStartTime;

                // 更新变量
                currentVariables[step.outputVariable] = stepOutput.output;

                const stepResult: StepResult = {
                  stepId: step.id,
                  stepName: step.name,
                  input: processedPrompt,
                  output: stepOutput.output,
                  variables: { ...currentVariables },
                  duration: stepDuration,
                  tokens: stepOutput.tokens,
                };

                stepResults.push(stepResult);

                // 发送步骤完成信号
                const stepCompleteData = `data: ${JSON.stringify({
                  type: 'step_complete',
                  stepIndex: i + 1,
                  stepResult: stepResult,
                  progress: (((i + 1) / steps.length) * 100).toFixed(0),
                })}\n\n`;
                controller.enqueue(encoder.encode(stepCompleteData));
              } catch (error) {
                console.error(`步骤 ${step.name} 执行失败:`, error);

                const errorData = `data: ${JSON.stringify({
                  type: 'step_error',
                  stepIndex: i + 1,
                  stepId: step.id,
                  error: `步骤执行失败: ${error instanceof Error ? error.message : '未知错误'}`,
                })}\n\n`;
                controller.enqueue(encoder.encode(errorData));
              }
            }

            const totalTime = Date.now() - startTime;
            const totalTokens = stepResults.reduce(
              (sum, step) => sum + step.tokens,
              0
            );

            // 获取最终结果
            const finalResult =
              stepResults.length > 0
                ? stepResults[stepResults.length - 1].output
                : '处理失败';

            // 发送最终结果
            const finalData = `data: ${JSON.stringify({
              type: 'final_result',
              result: {
                chainType,
                steps: stepResults,
                finalResult,
                allVariables: currentVariables,
                totalTime,
                totalTokens,
              },
            })}\n\n`;
            controller.enqueue(encoder.encode(finalData));

            // 发送完成信号
            const doneData = `data: ${JSON.stringify({ type: 'done' })}\n\n`;
            controller.enqueue(encoder.encode(doneData));
            controller.close();
          } catch (error) {
            console.error('Prompt Chaining Stream Error:', error);
            const errorData = `data: ${JSON.stringify({
              type: 'error',
              error: '链式提示执行过程发生错误',
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
      const stepResults: StepResult[] = [];
      let currentVariables = { ...initialInputs };

      for (const step of steps) {
        const stepStartTime = Date.now();

        const processedPrompt = replaceVariables(
          step.promptTemplate,
          currentVariables
        );
        const stepOutput = await executeStep(
          step,
          processedPrompt,
          modelName,
          temperature,
          maxTokens
        );

        const stepDuration = Date.now() - stepStartTime;
        currentVariables[step.outputVariable] = stepOutput.output;

        stepResults.push({
          stepId: step.id,
          stepName: step.name,
          input: processedPrompt,
          output: stepOutput.output,
          variables: { ...currentVariables },
          duration: stepDuration,
          tokens: stepOutput.tokens,
        });
      }

      const totalTime = Date.now() - startTime;
      const totalTokens = stepResults.reduce(
        (sum, step) => sum + step.tokens,
        0
      );
      const finalResult =
        stepResults.length > 0
          ? stepResults[stepResults.length - 1].output
          : '处理失败';

      return NextResponse.json({
        chainType,
        steps: stepResults,
        finalResult,
        allVariables: currentVariables,
        totalTime,
        totalTokens,
        model: modelName,
      });
    }
  } catch (error) {
    console.error('Prompt Chaining API Error:', error);
    return NextResponse.json(
      {
        error: '链式提示处理时发生错误',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

// 执行单个步骤
async function executeStep(
  step: PromptStep,
  processedPrompt: string,
  modelName: string,
  temperature: number,
  maxTokens: number
): Promise<{ output: string; tokens: number }> {
  const chatInstance = new ChatOpenAI({
    openAIApiKey: process.env.OPEN_API_KEY,
    modelName,
    temperature,
    maxTokens,
    configuration: {
      baseURL: process.env.OPEN_API_BASE_URL,
    },
  });

  const messages = [
    new SystemMessage(step.systemMessage),
    new HumanMessage(processedPrompt),
  ];

  const response = await chatInstance.invoke(messages);

  return {
    output: response.content as string,
    tokens: response.usage_metadata?.total_tokens || 0,
  };
}

// 替换模板中的变量
function replaceVariables(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;

  // 替换 {{variable}} 格式的变量
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, value);
  }

  return result;
}

// 获取预定义的提示链模板
export function getChainTemplate(chainType: string): PromptStep[] {
  const templates = {
    'document-qa': [
      {
        id: 'extract-quotes',
        name: '提取相关引文',
        systemMessage: '你是一个很有帮助的助手。你的任务是根据文档回答问题。',
        promptTemplate: `你的任务是从文档中提取与问题相关的引文，由####分隔。请使用<quotes></quotes>输出引文列表。如果没有找到相关引文，请回应"未找到相关引文！"。

####
{{document}}
####

问题：{{question}}`,
        outputVariable: 'quotes',
        inputVariables: ['document', 'question'],
      },
      {
        id: 'answer-question',
        name: '基于引文回答问题',
        systemMessage:
          '你是一个知识渊博的助手，能够基于提供的引文和文档准确回答问题。',
        promptTemplate: `根据从文档中提取的相关引文（由<quotes></quotes>分隔）和原始文档（由####分隔），请构建对问题的回答。请确保答案准确、语气友好且有帮助。

####
{{document}}
####

{{quotes}}

问题：{{question}}`,
        outputVariable: 'final_answer',
        inputVariables: ['document', 'quotes', 'question'],
      },
    ],

    'text-analysis': [
      {
        id: 'extract-topics',
        name: '提取主要主题',
        systemMessage:
          '你是一个文本分析专家，擅长识别文本的主要主题和关键概念。',
        promptTemplate: `请分析以下文本，提取出3-5个主要主题。请以简洁的关键词形式列出，每行一个主题。

文本：
{{text}}

主要主题：`,
        outputVariable: 'topics',
        inputVariables: ['text'],
      },
      {
        id: 'detailed-analysis',
        name: '详细主题分析',
        systemMessage:
          '你是一个深度分析专家，能够对文本主题进行详细的分析和解释。',
        promptTemplate: `基于已识别的主题，请对原文本进行详细分析。解释每个主题在文本中的体现，以及它们之间的关系。

原文本：
{{text}}

识别的主题：
{{topics}}

详细分析：`,
        outputVariable: 'detailed_analysis',
        inputVariables: ['text', 'topics'],
      },
    ],

    'code-explanation': [
      {
        id: 'extract-key-parts',
        name: '提取关键代码部分',
        systemMessage:
          '你是一个代码分析专家，能够识别代码的关键部分和核心逻辑。',
        promptTemplate: `请分析以下代码，提取出最重要的部分（函数、类、关键逻辑等）。请简要说明每个部分的作用。

代码：
{{code}}

关键部分：`,
        outputVariable: 'key_parts',
        inputVariables: ['code'],
      },
      {
        id: 'explain-code',
        name: '详细解释代码',
        systemMessage:
          '你是一个编程导师，能够用通俗易懂的语言解释复杂的代码逻辑。',
        promptTemplate: `基于已识别的关键部分，请详细解释这段代码的工作原理。用通俗的语言解释，适合初学者理解。

完整代码：
{{code}}

关键部分：
{{key_parts}}

详细解释：`,
        outputVariable: 'explanation',
        inputVariables: ['code', 'key_parts'],
      },
    ],

    'data-processing': [
      {
        id: 'data-cleaning',
        name: '数据清洗',
        systemMessage: '你是一个数据处理专家，擅长识别和清理数据中的问题。',
        promptTemplate: `请分析以下数据，识别可能存在的问题（如缺失值、异常值、格式错误等）并提出清洗建议。

数据：
{{data}}

数据质量分析和清洗建议：`,
        outputVariable: 'cleaning_suggestions',
        inputVariables: ['data'],
      },
      {
        id: 'data-analysis',
        name: '数据分析',
        systemMessage: '你是一个数据分析师，能够从数据中提取有价值的洞察。',
        promptTemplate: `基于数据清洗建议，请分析以下数据并提供有价值的洞察和发现。

原始数据：
{{data}}

清洗建议：
{{cleaning_suggestions}}

数据分析结果：`,
        outputVariable: 'analysis_results',
        inputVariables: ['data', 'cleaning_suggestions'],
      },
    ],
  };

  return templates[chainType as keyof typeof templates] || [];
}
