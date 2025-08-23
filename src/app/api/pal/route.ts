import { NextRequest, NextResponse } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

export interface PALRequest {
  question: string;
  domain: 'math' | 'date' | 'logic' | 'physics' | 'general';
  language: 'python' | 'javascript';
  includeExecution?: boolean; // 是否模拟执行结果
  temperature?: number;
  modelName?: string;
  stream?: boolean;
}

export interface CodeStep {
  stepNumber: number;
  description: string;
  code: string;
  explanation: string;
  variables?: Record<string, any>;
}

export interface PALResponse {
  question: string;
  domain: string;
  language: string;
  reasoningSteps: CodeStep[];
  generatedCode: string;
  simulatedResult: any;
  explanation: string;
  totalTime: number;
}

export interface StreamMessage {
  type: string;
  message?: string;
  step?: CodeStep;
  code?: string;
  result?: PALResponse;
  error?: string;
}

// PAL模板定义
const PAL_TEMPLATES = {
  math: {
    name: '数学计算',
    description: '使用程序解决数学问题',
    imports: ['import math', 'from fractions import Fraction'],
    examples: [
      {
        question: '一个班级有30个学生，其中60%是女生，女生比男生多多少人？',
        code: `# 总学生数
total_students = 30
# 女生比例
female_ratio = 0.6
# 计算女生人数
female_count = total_students * female_ratio
# 计算男生人数
male_count = total_students - female_count
# 女生比男生多的人数
difference = female_count - male_count
print(f"女生比男生多 {difference} 人")`,
      },
    ],
  },
  date: {
    name: '日期计算',
    description: '处理日期和时间相关问题',
    imports: [
      'from datetime import datetime, timedelta',
      'from dateutil.relativedelta import relativedelta',
    ],
    examples: [
      {
        question:
          '今天是2023年2月27日，我出生在25年前的今天，我的生日是什么时候？',
        code: `# 今天的日期
today = datetime(2023, 2, 27)
# 25年前
birth_date = today - relativedelta(years=25)
# 格式化输出
formatted_date = birth_date.strftime('%Y年%m月%d日')
print(f"生日是: {formatted_date}")`,
      },
    ],
  },
  logic: {
    name: '逻辑推理',
    description: '使用程序解决逻辑问题',
    imports: ['from itertools import permutations, combinations'],
    examples: [
      {
        question:
          '有红、蓝、绿三种颜色的球各2个，从中取3个球，有多少种不同的取法？',
        code: `# 定义球的颜色和数量
balls = ['红', '红', '蓝', '蓝', '绿', '绿']
# 生成所有可能的3球组合
from itertools import combinations
combinations_list = list(combinations(balls, 3))
# 去重（因为同色球不区分）
unique_combinations = list(set(combinations_list))
count = len(unique_combinations)
print(f"共有 {count} 种不同的取法")`,
      },
    ],
  },
  physics: {
    name: '物理计算',
    description: '解决物理问题',
    imports: ['import math'],
    examples: [
      {
        question: '一个物体从10米高处自由落下，需要多长时间落地？（g=9.8m/s²）',
        code: `# 物理参数
height = 10  # 高度（米）
g = 9.8      # 重力加速度（m/s²）
# 自由落体公式: h = 0.5 * g * t²
# 解得: t = sqrt(2h/g)
time = math.sqrt(2 * height / g)
print(f"落地时间: {time:.2f} 秒")`,
      },
    ],
  },
};

export async function POST(request: NextRequest) {
  try {
    const body: PALRequest = await request.json();
    const {
      question,
      domain,
      language,
      includeExecution = true,
      temperature = 0.3,
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
              message: '开始PAL程序辅助推理...',
              question,
              domain,
              language,
            })}\n\n`;
            controller.enqueue(encoder.encode(startData));

            // 1. 生成程序代码
            const codeGeneration = await generateProgramCode(
              question,
              domain,
              language,
              modelName,
              temperature
            );

            // 发送代码生成结果
            const codeData = `data: ${JSON.stringify({
              type: 'code_generated',
              code: codeGeneration.code,
              explanation: codeGeneration.explanation,
            })}\n\n`;
            controller.enqueue(encoder.encode(codeData));

            // 2. 分析推理步骤
            const reasoningSteps = parseReasoningSteps(
              codeGeneration.code,
              codeGeneration.explanation
            );

            // 发送每个推理步骤
            for (let i = 0; i < reasoningSteps.length; i++) {
              const step = reasoningSteps[i];

              const stepData = `data: ${JSON.stringify({
                type: 'reasoning_step',
                step,
              })}\n\n`;
              controller.enqueue(encoder.encode(stepData));
            }

            // 3. 模拟执行结果（如果需要）
            let simulatedResult = null;
            if (includeExecution) {
              simulatedResult = simulateCodeExecution(
                codeGeneration.code,
                domain
              );

              const resultData = `data: ${JSON.stringify({
                type: 'execution_result',
                result: simulatedResult,
              })}\n\n`;
              controller.enqueue(encoder.encode(resultData));
            }

            const totalTime = Date.now() - startTime;

            // 发送最终结果
            const finalData = `data: ${JSON.stringify({
              type: 'final_result',
              result: {
                question,
                domain,
                language,
                reasoningSteps,
                generatedCode: codeGeneration.code,
                simulatedResult,
                explanation: codeGeneration.explanation,
                totalTime,
              },
            })}\n\n`;
            controller.enqueue(encoder.encode(finalData));

            // 发送完成信号
            const doneData = `data: ${JSON.stringify({ type: 'done' })}\n\n`;
            controller.enqueue(encoder.encode(doneData));
            controller.close();
          } catch (error) {
            console.error('PAL Stream Error:', error);
            const errorData = `data: ${JSON.stringify({
              type: 'error',
              error: 'PAL处理过程发生错误',
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
      const codeGeneration = await generateProgramCode(
        question,
        domain,
        language,
        modelName,
        temperature
      );
      const reasoningSteps = parseReasoningSteps(
        codeGeneration.code,
        codeGeneration.explanation
      );
      const simulatedResult = includeExecution
        ? simulateCodeExecution(codeGeneration.code, domain)
        : null;
      const totalTime = Date.now() - startTime;

      return NextResponse.json({
        question,
        domain,
        language,
        reasoningSteps,
        generatedCode: codeGeneration.code,
        simulatedResult,
        explanation: codeGeneration.explanation,
        totalTime,
        model: modelName,
      });
    }
  } catch (error) {
    console.error('PAL API Error:', error);
    return NextResponse.json(
      {
        error: 'PAL处理时发生错误',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

// 生成程序代码
async function generateProgramCode(
  question: string,
  domain: string,
  language: string,
  modelName: string,
  temperature: number
): Promise<{ code: string; explanation: string }> {
  const chatInstance = new ChatOpenAI({
    openAIApiKey: process.env.OPEN_API_KEY,
    modelName,
    temperature,
    maxTokens: 1000,
    configuration: {
      baseURL: process.env.OPEN_API_BASE_URL,
    },
  });

  const template = PAL_TEMPLATES[domain as keyof typeof PAL_TEMPLATES];
  const systemMessage = buildPALSystemMessage(domain, language, template);
  const promptMessage = buildPALPrompt(question, template, language);

  const messages = [
    new SystemMessage(systemMessage),
    new HumanMessage(promptMessage),
  ];

  const response = await chatInstance.invoke(messages);
  const content = response.content as string;

  return parsePALResponse(content);
}

// 构建PAL系统消息
function buildPALSystemMessage(
  domain: string,
  language: string,
  template: any
): string {
  return `你是一个程序辅助语言模型（PAL），专门将自然语言问题转换为${language}程序代码来解决问题。

领域: ${template.name}
特点: ${template.description}

你的任务是：
1. 理解自然语言问题
2. 将解决步骤转换为${language}代码
3. 每行代码都要有注释说明
4. 使用程序逻辑而不是自由文本来推理
5. 确保代码逻辑清晰、可执行

请按以下格式返回：
CODE:
\`\`\`${language}
[生成的代码]
\`\`\`

EXPLANATION:
[解释代码的推理过程]`;
}

// 构建PAL提示
function buildPALPrompt(
  question: string,
  template: any,
  language: string
): string {
  const exampleText =
    template.examples.length > 0
      ? `参考示例：
问题: ${template.examples[0].question}
代码:
\`\`\`${language}
${template.examples[0].code}
\`\`\`

`
      : '';

  return `${exampleText}现在请解决以下问题：

问题: ${question}

请生成${language}代码来解决这个问题：`;
}

// 解析PAL响应
function parsePALResponse(content: string): {
  code: string;
  explanation: string;
} {
  const codeMatch = content.match(
    /CODE:\s*```(?:python|javascript)?\s*([\s\S]*?)```/i
  );
  const explanationMatch = content.match(/EXPLANATION:\s*([\s\S]*?)$/i);

  // 如果没有找到CODE标记，尝试直接提取代码块
  let code = '';
  if (codeMatch) {
    code = codeMatch[1].trim();
  } else {
    const directCodeMatch = content.match(
      /```(?:python|javascript)?\s*([\s\S]*?)```/
    );
    code = directCodeMatch ? directCodeMatch[1].trim() : content;
  }

  const explanation = explanationMatch
    ? explanationMatch[1].trim()
    : '代码生成完成，通过程序逻辑解决问题';

  return { code, explanation };
}

// 解析推理步骤
function parseReasoningSteps(code: string, explanation: string): CodeStep[] {
  const lines = code.split('\n').filter((line) => line.trim());
  const steps: CodeStep[] = [];
  let stepNumber = 1;

  let currentCode = '';
  let currentDescription = '';

  for (const line of lines) {
    if (line.trim().startsWith('#')) {
      // 注释行，作为步骤描述
      if (currentCode) {
        steps.push({
          stepNumber: stepNumber++,
          description: currentDescription || '执行计算',
          code: currentCode.trim(),
          explanation: `执行: ${currentCode.trim()}`,
        });
        currentCode = '';
      }
      currentDescription = line.replace(/^#\s*/, '').trim();
    } else if (line.trim()) {
      // 代码行
      currentCode += line + '\n';
    }
  }

  // 处理最后一个步骤
  if (currentCode) {
    steps.push({
      stepNumber: stepNumber++,
      description: currentDescription || '完成计算',
      code: currentCode.trim(),
      explanation: `执行: ${currentCode.trim()}`,
    });
  }

  return steps;
}

// 模拟代码执行
function simulateCodeExecution(code: string, domain: string): any {
  // 这里是模拟执行，不实际运行代码
  const simulationResults = {
    math: '计算结果: 42',
    date: '日期结果: 1998年2月27日',
    logic: '逻辑结果: 共有10种可能',
    physics: '物理结果: 1.43秒',
    general: '执行完成',
  };

  // 尝试从代码中提取print语句或return语句的内容
  const printMatch = code.match(/print\(f?["']([^"']*?)["']\)/);
  if (printMatch) {
    return `模拟输出: ${printMatch[1]}`;
  }

  return (
    simulationResults[domain as keyof typeof simulationResults] ||
    '模拟执行完成'
  );
}
