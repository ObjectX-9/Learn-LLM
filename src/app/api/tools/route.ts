import { NextRequest, NextResponse } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  BaseMessage,
} from '@langchain/core/messages';
import { z } from 'zod';

// 工具调用日志
interface ToolCallLog {
  id: string;
  toolName: string;
  input: any;
  output: any;
  success: boolean;
  timestamp: number;
  duration: number;
  error?: string;
}

// 工具定义接口
interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodSchema;
  category: string;
  implementation: (input: any) => Promise<any> | any;
  examples: Array<{
    input: any;
    description: string;
  }>;
}

// 内存存储工具调用日志
let toolCallLogs: ToolCallLog[] = [];

// 生成工具调用ID
const generateToolCallId = (): string => {
  return `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// ===== 工具实现 =====

// 1. 数学计算工具
const mathTool: ToolDefinition = {
  name: 'calculate',
  description: '执行数学计算，支持基本运算、函数计算等',
  category: '数学计算',
  inputSchema: z.object({
    expression: z
      .string()
      .describe('数学表达式，如 "2 + 3 * 4" 或 "Math.sin(Math.PI/2)"'),
  }),
  implementation: (input: { expression: string }) => {
    try {
      // 安全的数学表达式求值
      const allowedFunctions = [
        'Math.sin',
        'Math.cos',
        'Math.tan',
        'Math.log',
        'Math.exp',
        'Math.sqrt',
        'Math.pow',
        'Math.abs',
        'Math.floor',
        'Math.ceil',
        'Math.round',
        'Math.PI',
        'Math.E',
      ];

      let expr = input.expression;

      // 将常见的数学符号转换为JavaScript语法
      expr = expr.replace(/\^/g, '**'); // 将^转换为幂运算符**
      expr = expr.replace(/×/g, '*'); // 将×转换为*
      expr = expr.replace(/÷/g, '/'); // 将÷转换为/

      // 基本安全检查
      if (
        /[a-zA-Z]/.test(expr) &&
        !allowedFunctions.some((fn) => expr.includes(fn))
      ) {
        throw new Error('只允许数字、基本运算符和Math函数');
      }

      // 防止潜在危险操作
      if (
        expr.includes('eval') ||
        expr.includes('Function') ||
        expr.includes('require')
      ) {
        throw new Error('不允许使用eval、Function或require');
      }

      const result = Function(`"use strict"; return (${expr})`)();

      return {
        result: result,
        expression: input.expression,
        type: typeof result === 'number' ? 'number' : 'unknown',
      };
    } catch (error) {
      throw new Error(
        `计算错误: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  },
  examples: [
    { input: { expression: '2 + 3 * 4' }, description: '基本四则运算' },
    {
      input: { expression: 'Math.sin(Math.PI/2)' },
      description: '三角函数计算',
    },
    {
      input: { expression: 'Math.sqrt(16) + Math.pow(2, 3)' },
      description: '开方和幂运算',
    },
  ],
};

// 2. 文本处理工具
const textTool: ToolDefinition = {
  name: 'process_text',
  description: '文本处理工具，支持统计、转换、格式化等操作',
  category: '文本处理',
  inputSchema: z.object({
    text: z.string().describe('要处理的文本'),
    operation: z
      .enum(['count', 'uppercase', 'lowercase', 'reverse', 'words', 'analyze'])
      .describe('操作类型'),
  }),
  implementation: (input: { text: string; operation: string }) => {
    const { text, operation } = input;

    switch (operation) {
      case 'count':
        return {
          characters: text.length,
          charactersNoSpaces: text.replace(/\s/g, '').length,
          words: text
            .trim()
            .split(/\s+/)
            .filter((w) => w.length > 0).length,
          lines: text.split('\n').length,
          paragraphs: text.split(/\n\s*\n/).filter((p) => p.trim().length > 0)
            .length,
        };

      case 'uppercase':
        return { result: text.toUpperCase() };

      case 'lowercase':
        return { result: text.toLowerCase() };

      case 'reverse':
        return { result: text.split('').reverse().join('') };

      case 'words':
        const words = text
          .trim()
          .split(/\s+/)
          .filter((w) => w.length > 0);
        const wordCount: Record<string, number> = {};
        words.forEach((word) => {
          const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
          wordCount[cleanWord] = (wordCount[cleanWord] || 0) + 1;
        });
        return {
          words: words,
          uniqueWords: Object.keys(wordCount).length,
          wordFrequency: Object.entries(wordCount)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10),
        };

      case 'analyze':
        const sentences = text
          .split(/[.!?]+/)
          .filter((s) => s.trim().length > 0);
        const avgWordsPerSentence =
          sentences.length > 0
            ? text.trim().split(/\s+/).length / sentences.length
            : 0;

        return {
          readabilityScore: Math.max(
            0,
            Math.min(100, 100 - (avgWordsPerSentence - 15) * 2)
          ),
          sentences: sentences.length,
          avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
          complexity:
            avgWordsPerSentence > 20
              ? 'high'
              : avgWordsPerSentence > 15
                ? 'medium'
                : 'low',
        };

      default:
        throw new Error(`不支持的操作: ${operation}`);
    }
  },
  examples: [
    {
      input: { text: 'Hello World!', operation: 'count' },
      description: '统计文本信息',
    },
    {
      input: { text: 'Hello World!', operation: 'uppercase' },
      description: '转换为大写',
    },
    {
      input: {
        text: 'This is a sample text for analysis.',
        operation: 'analyze',
      },
      description: '文本可读性分析',
    },
  ],
};

// 3. 时间日期工具
const dateTool: ToolDefinition = {
  name: 'date_time',
  description: '时间日期处理工具，支持格式化、计算、时区转换等',
  category: '时间日期',
  inputSchema: z.object({
    operation: z
      .enum(['now', 'format', 'add', 'diff', 'timezone'])
      .describe('操作类型'),
    date: z.string().optional().describe('日期字符串（可选）'),
    format: z.string().optional().describe('日期格式（可选）'),
    amount: z.number().optional().describe('数量（用于add操作）'),
    unit: z
      .enum(['days', 'hours', 'minutes', 'months', 'years'])
      .optional()
      .describe('单位（用于add操作）'),
    timezone: z.string().optional().describe('时区（可选）'),
  }),
  implementation: (input: any) => {
    const { operation, date, format, amount, unit, timezone } = input;

    switch (operation) {
      case 'now':
        const now = new Date();
        return {
          timestamp: now.getTime(),
          iso: now.toISOString(),
          local: now.toLocaleString('zh-CN'),
          utc: now.toUTCString(),
        };

      case 'format':
        if (!date) throw new Error('format操作需要提供date参数');
        const d = new Date(date);
        if (isNaN(d.getTime())) throw new Error('无效的日期格式');

        const formats: Record<string, string> = {
          iso: d.toISOString(),
          local: d.toLocaleString('zh-CN'),
          date: d.toLocaleDateString('zh-CN'),
          time: d.toLocaleTimeString('zh-CN'),
          year: d.getFullYear().toString(),
          month: (d.getMonth() + 1).toString(),
          day: d.getDate().toString(),
        };

        return {
          original: date,
          formatted:
            format && formats[format]
              ? formats[format]
              : d.toLocaleString('zh-CN'),
          available_formats: Object.keys(formats),
        };

      case 'add':
        if (!date || amount === undefined || !unit) {
          throw new Error('add操作需要提供date、amount和unit参数');
        }

        const baseDate = new Date(date);
        if (isNaN(baseDate.getTime())) throw new Error('无效的日期格式');

        const newDate = new Date(baseDate);
        switch (unit) {
          case 'days':
            newDate.setDate(newDate.getDate() + amount);
            break;
          case 'hours':
            newDate.setHours(newDate.getHours() + amount);
            break;
          case 'minutes':
            newDate.setMinutes(newDate.getMinutes() + amount);
            break;
          case 'months':
            newDate.setMonth(newDate.getMonth() + amount);
            break;
          case 'years':
            newDate.setFullYear(newDate.getFullYear() + amount);
            break;
        }

        return {
          original: date,
          result: newDate.toISOString(),
          operation: `${amount > 0 ? '+' : ''}${amount} ${unit}`,
        };

      case 'diff':
        if (!date) throw new Error('diff操作需要提供date参数');
        const targetDate = new Date(date);
        const currentDate = new Date();

        if (isNaN(targetDate.getTime())) throw new Error('无效的日期格式');

        const diffMs = targetDate.getTime() - currentDate.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor(
          (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
        );
        const diffMinutes = Math.floor(
          (diffMs % (1000 * 60 * 60)) / (1000 * 60)
        );

        return {
          from: currentDate.toISOString(),
          to: date,
          difference: {
            milliseconds: diffMs,
            days: diffDays,
            hours: diffHours,
            minutes: diffMinutes,
            total_hours: Math.floor(diffMs / (1000 * 60 * 60)),
            human_readable: `${Math.abs(diffDays)}天${Math.abs(diffHours)}小时${Math.abs(diffMinutes)}分钟`,
          },
          is_future: diffMs > 0,
        };

      default:
        throw new Error(`不支持的操作: ${operation}`);
    }
  },
  examples: [
    { input: { operation: 'now' }, description: '获取当前时间' },
    {
      input: { operation: 'format', date: '2024-01-01', format: 'local' },
      description: '格式化日期',
    },
    {
      input: { operation: 'add', date: '2024-01-01', amount: 7, unit: 'days' },
      description: '日期加减',
    },
  ],
};

// 4. 编码转换工具
const encodingTool: ToolDefinition = {
  name: 'encoding',
  description: '编码转换工具，支持Base64、URL编码、JSON等',
  category: '编码转换',
  inputSchema: z.object({
    operation: z
      .enum([
        'base64_encode',
        'base64_decode',
        'url_encode',
        'url_decode',
        'json_parse',
        'json_stringify',
      ])
      .describe('操作类型'),
    input: z.string().describe('输入内容'),
  }),
  implementation: (input: { operation: string; input: string }) => {
    const { operation, input: inputStr } = input;

    try {
      switch (operation) {
        case 'base64_encode':
          return {
            result: Buffer.from(inputStr, 'utf8').toString('base64'),
            operation: 'Base64 编码',
          };

        case 'base64_decode':
          return {
            result: Buffer.from(inputStr, 'base64').toString('utf8'),
            operation: 'Base64 解码',
          };

        case 'url_encode':
          return {
            result: encodeURIComponent(inputStr),
            operation: 'URL 编码',
          };

        case 'url_decode':
          return {
            result: decodeURIComponent(inputStr),
            operation: 'URL 解码',
          };

        case 'json_parse':
          const parsed = JSON.parse(inputStr);
          return {
            result: parsed,
            type: Array.isArray(parsed) ? 'array' : typeof parsed,
            operation: 'JSON 解析',
          };

        case 'json_stringify':
          let obj;
          try {
            obj = JSON.parse(inputStr);
          } catch {
            obj = inputStr;
          }
          return {
            result: JSON.stringify(obj, null, 2),
            operation: 'JSON 格式化',
          };

        default:
          throw new Error(`不支持的操作: ${operation}`);
      }
    } catch (error) {
      throw new Error(
        `编码转换失败: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  },
  examples: [
    {
      input: { operation: 'base64_encode', input: 'Hello World!' },
      description: 'Base64编码',
    },
    {
      input: { operation: 'url_encode', input: 'hello world!' },
      description: 'URL编码',
    },
    {
      input: { operation: 'json_parse', input: '{"name": "test"}' },
      description: 'JSON解析',
    },
  ],
};

// 5. 随机生成工具
const randomTool: ToolDefinition = {
  name: 'random_generator',
  description: '随机生成工具，支持数字、字符串、UUID等',
  category: '随机生成',
  inputSchema: z.object({
    type: z
      .enum(['number', 'string', 'uuid', 'password', 'color'])
      .describe('生成类型'),
    min: z.number().optional().describe('最小值（用于number类型）'),
    max: z.number().optional().describe('最大值（用于number类型）'),
    length: z.number().optional().describe('长度（用于string、password类型）'),
    charset: z.string().optional().describe('字符集（用于string类型）'),
  }),
  implementation: (input: any) => {
    const {
      type,
      min = 0,
      max = 100,
      length = 8,
      charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    } = input;

    switch (type) {
      case 'number':
        const num = Math.floor(Math.random() * (max - min + 1)) + min;
        return {
          result: num,
          range: `${min} - ${max}`,
          type: 'integer',
        };

      case 'string':
        let result = '';
        for (let i = 0; i < length; i++) {
          result += charset.charAt(Math.floor(Math.random() * charset.length));
        }
        return {
          result: result,
          length: length,
          charset_used:
            charset.length > 20 ? `${charset.substring(0, 20)}...` : charset,
        };

      case 'uuid':
        const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
          /[xy]/g,
          (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          }
        );
        return {
          result: uuid,
          version: 'UUID v4',
          format: 'standard',
        };

      case 'password':
        const passwordCharset =
          'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
        let password = '';

        // 确保至少包含一个小写字母、大写字母、数字和特殊字符
        const lowercase = 'abcdefghijklmnopqrstuvwxyz';
        const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const numbers = '0123456789';
        const special = '!@#$%^&*';

        password += lowercase[Math.floor(Math.random() * lowercase.length)];
        password += uppercase[Math.floor(Math.random() * uppercase.length)];
        password += numbers[Math.floor(Math.random() * numbers.length)];
        password += special[Math.floor(Math.random() * special.length)];

        // 填充剩余长度
        for (let i = 4; i < length; i++) {
          password +=
            passwordCharset[Math.floor(Math.random() * passwordCharset.length)];
        }

        // 打乱顺序
        password = password
          .split('')
          .sort(() => Math.random() - 0.5)
          .join('');

        return {
          result: password,
          length: length,
          strength: length >= 12 ? 'strong' : length >= 8 ? 'medium' : 'weak',
          contains: {
            lowercase: /[a-z]/.test(password),
            uppercase: /[A-Z]/.test(password),
            numbers: /[0-9]/.test(password),
            special: /[!@#$%^&*]/.test(password),
          },
        };

      case 'color':
        const hue = Math.floor(Math.random() * 360);
        const saturation = Math.floor(Math.random() * 50) + 50; // 50-100%
        const lightness = Math.floor(Math.random() * 40) + 30; // 30-70%

        const hex = hslToHex(hue, saturation, lightness);

        return {
          result: hex,
          hsl: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
          rgb: hexToRgb(hex),
          name: getColorName(hue),
        };

      default:
        throw new Error(`不支持的生成类型: ${type}`);
    }
  },
  examples: [
    {
      input: { type: 'number', min: 1, max: 100 },
      description: '生成随机数字',
    },
    { input: { type: 'string', length: 10 }, description: '生成随机字符串' },
    { input: { type: 'password', length: 12 }, description: '生成强密码' },
  ],
};

// 辅助函数
function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

function getColorName(hue: number): string {
  if (hue < 15 || hue >= 345) return '红色';
  if (hue < 45) return '橙色';
  if (hue < 75) return '黄色';
  if (hue < 165) return '绿色';
  if (hue < 195) return '青色';
  if (hue < 255) return '蓝色';
  if (hue < 285) return '紫色';
  return '品红';
}

// 工具注册表
const tools: Record<string, ToolDefinition> = {
  calculate: mathTool,
  process_text: textTool,
  date_time: dateTool,
  encoding: encodingTool,
  random_generator: randomTool,
};

// 执行工具调用
async function executeToolCall(
  toolName: string,
  input: any
): Promise<ToolCallLog> {
  const startTime = Date.now();
  const callId = generateToolCallId();

  try {
    const tool = tools[toolName];
    if (!tool) {
      throw new Error(`未知工具: ${toolName}`);
    }

    // 验证输入
    const validatedInput = tool.inputSchema.parse(input);

    // 执行工具
    const output = await tool.implementation(validatedInput);

    const duration = Date.now() - startTime;
    const log: ToolCallLog = {
      id: callId,
      toolName,
      input: validatedInput,
      output,
      success: true,
      timestamp: startTime,
      duration,
    };

    toolCallLogs.unshift(log); // 添加到开头
    if (toolCallLogs.length > 100) {
      // 限制日志数量
      toolCallLogs = toolCallLogs.slice(0, 100);
    }

    return log;
  } catch (error) {
    const duration = Date.now() - startTime;
    const log: ToolCallLog = {
      id: callId,
      toolName,
      input,
      output: null,
      success: false,
      timestamp: startTime,
      duration,
      error: error instanceof Error ? error.message : '未知错误',
    };

    toolCallLogs.unshift(log);
    if (toolCallLogs.length > 100) {
      toolCallLogs = toolCallLogs.slice(0, 100);
    }

    throw error;
  }
}

// 将工具转换为OpenAI函数格式
function toolToOpenAIFunction(tool: ToolDefinition) {
  // 将Zod schema转换为JSON schema
  const jsonSchema = zodToJsonSchema(tool.inputSchema);

  return {
    name: tool.name,
    description: tool.description,
    parameters: jsonSchema,
  };
}

// 简化的Zod到JSON Schema转换
function zodToJsonSchema(schema: z.ZodSchema): any {
  if (schema instanceof z.ZodObject) {
    const properties: any = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(schema.shape)) {
      properties[key] = zodToJsonSchema(value as z.ZodSchema);

      if (!(value as any).isOptional()) {
        required.push(key);
      }
    }

    return {
      type: 'object',
      properties,
      required,
    };
  }

  if (schema instanceof z.ZodString) {
    return { type: 'string', description: schema.description };
  }

  if (schema instanceof z.ZodNumber) {
    return { type: 'number', description: schema.description };
  }

  if (schema instanceof z.ZodEnum) {
    return {
      type: 'string',
      enum: schema.options,
      description: schema.description,
    };
  }

  if (schema instanceof z.ZodOptional) {
    return { type: 'string' };
  }

  return { type: 'string' };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, toolName, input, message, useAI } = body;

    console.log('🔧 工具调用请求:', { action, toolName, useAI });

    switch (action) {
      case 'list_tools':
        return NextResponse.json({
          tools: Object.values(tools).map((tool) => ({
            name: tool.name,
            description: tool.description,
            category: tool.category,
            examples: tool.examples,
          })),
          categories: Array.from(
            new Set(Object.values(tools).map((t) => t.category))
          ),
        });

      case 'execute_tool':
        const result = await executeToolCall(toolName, input);
        return NextResponse.json(result);

      case 'get_logs':
        return NextResponse.json({
          logs: toolCallLogs.slice(0, 50), // 返回最近50条日志
          total: toolCallLogs.length,
        });

      case 'clear_logs':
        toolCallLogs = [];
        return NextResponse.json({ success: true });

      case 'chat_with_tools':
        if (!message) {
          return NextResponse.json({ error: '缺少消息内容' }, { status: 400 });
        }

        // 初始化OpenAI客户端
        const chat = new ChatOpenAI({
          openAIApiKey: process.env.OPEN_API_KEY,
          modelName: 'gpt-3.5-turbo',
          temperature: 0.1,
          configuration: {
            baseURL: process.env.OPEN_API_BASE_URL,
          },
        });

        // 构建函数定义
        const functions = Object.values(tools).map(toolToOpenAIFunction);

        const messages: BaseMessage[] = [
          new SystemMessage(`你是一个智能助手，能够自动判断用户需求并调用合适的工具。

🛠️ 可用工具列表：
${Object.values(tools)
  .map((t) => `• ${t.name}: ${t.description}`)
  .join('\n')}

📋 智能判断规则：
• 数学计算/公式/运算 → 使用 calculate 工具
• 文本统计/转换/分析 → 使用 process_text 工具  
• 时间日期/格式化/计算 → 使用 date_time 工具
• 编码转换/Base64/URL/JSON → 使用 encoding 工具
• 生成随机数/密码/UUID/颜色 → 使用 random_generator 工具

🎯 处理流程：
1. 自动分析用户意图和需求类型
2. 智能选择最合适的工具
3. 根据工具要求准备参数
4. 调用工具获取结果
5. 用通俗语言解释结果

请根据用户输入自动判断是否需要调用工具，如果需要就直接调用，不需要询问用户。`),
          new HumanMessage(message),
        ];

        try {
          console.log('🤖 AI分析用户请求:', message);
          console.log('🛠️ 可用工具数量:', functions.length);

          const response = await chat.invoke(messages, {
            functions,
            function_call: 'auto' as any,
          });

          let finalResponse = (response.content as string) || '';
          const toolCalls: ToolCallLog[] = [];

          // 分析AI的决策过程
          const decisionProcess = {
            userMessage: message,
            aiThinking: response.content || '无AI思考内容',
            hasToolCall: !!response.additional_kwargs?.function_call,
            selectedTool: null as string | null,
            toolInput: null as any,
            reasoning: '无工具调用',
          };

          // 检查是否有函数调用
          if (response.additional_kwargs?.function_call) {
            const functionCall = response.additional_kwargs.function_call;
            const toolName = functionCall.name;
            const toolInput = JSON.parse(functionCall.arguments || '{}');

            // 记录AI的选择过程
            decisionProcess.selectedTool = toolName;
            decisionProcess.toolInput = toolInput;
            decisionProcess.reasoning = `AI选择了${toolName}工具来处理请求`;

            console.log('🎯 AI决策分析:');
            console.log('  用户请求:', message);
            console.log('  AI初始响应:', response.content || '(无内容)');
            console.log('  选择的工具:', toolName);
            console.log('  工具参数:', JSON.stringify(toolInput, null, 2));
            console.log('  决策推理:', decisionProcess.reasoning);

            try {
              console.log('⚡ 开始执行工具调用...');
              const toolResult = await executeToolCall(toolName, toolInput);
              toolCalls.push(toolResult);
              console.log('✅ 工具执行完成:', toolResult.output);

              // 将工具结果反馈给AI
              const followUpMessages = [
                ...messages,
                new AIMessage(
                  (response.content as string) || `我调用了${toolName}工具`
                ),
                new HumanMessage(
                  `工具调用结果：${JSON.stringify(toolResult.output, null, 2)}\n\n请根据这个结果回答用户的问题。`
                ),
              ];

              console.log('🔄 将工具结果反馈给AI生成最终回答...');
              const finalAIResponse = await chat.invoke(followUpMessages);
              finalResponse =
                (finalAIResponse.content as string) ||
                '处理完成，但AI未返回有效回复。';
              console.log('📝 AI最终回答:', finalResponse);
            } catch (error) {
              console.error('❌ 工具执行失败:', error);
              finalResponse = `工具调用失败：${error instanceof Error ? error.message : '未知错误'}`;
            }
          } else {
            console.log('💭 AI决定不使用任何工具');
            console.log('  AI回答:', finalResponse);
            decisionProcess.reasoning = 'AI判断不需要调用工具，直接回答';
          }

          return NextResponse.json({
            response: finalResponse,
            toolCalls,
            hasToolCalls: toolCalls.length > 0,
            decisionProcess, // 新增：AI决策过程
          });
        } catch (error) {
          console.error('AI对话失败:', error);
          return NextResponse.json(
            {
              error: 'AI对话失败',
              details: error instanceof Error ? error.message : '未知错误',
            },
            { status: 500 }
          );
        }

      default:
        return NextResponse.json({ error: '未知操作' }, { status: 400 });
    }
  } catch (error) {
    console.error('❌ 工具调用错误:', error);
    return NextResponse.json(
      {
        error: '工具调用失败',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'tools') {
    return NextResponse.json({
      tools: Object.values(tools).map((tool) => ({
        name: tool.name,
        description: tool.description,
        category: tool.category,
        examples: tool.examples,
      })),
    });
  }

  if (action === 'logs') {
    return NextResponse.json({
      logs: toolCallLogs.slice(0, 20),
      total: toolCallLogs.length,
    });
  }

  return NextResponse.json({ error: '未知操作' }, { status: 400 });
}
