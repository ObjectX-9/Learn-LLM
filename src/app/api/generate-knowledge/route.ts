import { NextRequest, NextResponse } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

export interface GenerateKnowledgeRequest {
  question: string;
  domain?:
    | 'general'
    | 'science'
    | 'history'
    | 'geography'
    | 'sports'
    | 'daily-life';
  numKnowledge?: number; // 生成知识的数量，默认2个
  modelName?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface KnowledgeItem {
  id: number;
  content: string;
  confidence: number;
  tokens: number;
  duration: number;
}

export interface GenerateKnowledgeResponse {
  question: string;
  generatedKnowledge: KnowledgeItem[];
  finalAnswer: string;
  reasoning: string;
  totalTime: number;
  steps: {
    knowledgeGeneration: number;
    knowledgeIntegration: number;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateKnowledgeRequest = await request.json();
    const {
      question,
      domain = 'general',
      numKnowledge = 2,
      modelName = 'gpt-3.5-turbo',
      temperature = 0.7,
      maxTokens = 2000,
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
              message: '开始生成知识提示推理...',
              question: question,
            })}\n\n`;
            controller.enqueue(encoder.encode(startData));

            // 步骤1: 生成知识
            const stepStartData = `data: ${JSON.stringify({
              type: 'step_start',
              step: 1,
              message: '正在生成相关知识...',
            })}\n\n`;
            controller.enqueue(encoder.encode(stepStartData));

            const knowledgeStartTime = Date.now();
            const generatedKnowledge = await generateKnowledge(
              question,
              domain,
              numKnowledge,
              modelName,
              temperature,
              maxTokens
            );
            const knowledgeEndTime = Date.now();

            // 发送生成的知识
            const knowledgeData = `data: ${JSON.stringify({
              type: 'knowledge_generated',
              knowledge: generatedKnowledge,
              duration: knowledgeEndTime - knowledgeStartTime,
            })}\n\n`;
            controller.enqueue(encoder.encode(knowledgeData));

            // 步骤2: 使用知识进行推理
            const reasoningStartData = `data: ${JSON.stringify({
              type: 'step_start',
              step: 2,
              message: '正在整合知识进行推理...',
            })}\n\n`;
            controller.enqueue(encoder.encode(reasoningStartData));

            const reasoningStartTime = Date.now();
            const { answer, reasoning } = await integrateKnowledgeReasoning(
              question,
              generatedKnowledge,
              modelName,
              temperature,
              maxTokens
            );
            const reasoningEndTime = Date.now();

            const totalTime = Date.now() - startTime;

            // 发送最终结果
            const finalData = `data: ${JSON.stringify({
              type: 'final_result',
              result: {
                question,
                generatedKnowledge,
                finalAnswer: answer,
                reasoning,
                totalTime,
                steps: {
                  knowledgeGeneration: knowledgeEndTime - knowledgeStartTime,
                  knowledgeIntegration: reasoningEndTime - reasoningStartTime,
                },
              },
            })}\n\n`;
            controller.enqueue(encoder.encode(finalData));

            // 发送完成信号
            const doneData = `data: ${JSON.stringify({ type: 'done' })}\n\n`;
            controller.enqueue(encoder.encode(doneData));
            controller.close();
          } catch (error) {
            console.error('Generate Knowledge Stream Error:', error);
            const errorData = `data: ${JSON.stringify({
              type: 'error',
              error: '生成知识提示过程发生错误',
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
      const knowledgeStartTime = Date.now();
      const generatedKnowledge = await generateKnowledge(
        question,
        domain,
        numKnowledge,
        modelName,
        temperature,
        maxTokens
      );
      const knowledgeEndTime = Date.now();

      const reasoningStartTime = Date.now();
      const { answer, reasoning } = await integrateKnowledgeReasoning(
        question,
        generatedKnowledge,
        modelName,
        temperature,
        maxTokens
      );
      const reasoningEndTime = Date.now();

      const totalTime = Date.now() - startTime;

      return NextResponse.json({
        question,
        generatedKnowledge,
        finalAnswer: answer,
        reasoning,
        totalTime,
        steps: {
          knowledgeGeneration: knowledgeEndTime - knowledgeStartTime,
          knowledgeIntegration: reasoningEndTime - reasoningStartTime,
        },
        model: modelName,
        domain,
      });
    }
  } catch (error) {
    console.error('Generate Knowledge API Error:', error);
    return NextResponse.json(
      {
        error: '生成知识提示处理时发生错误',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

// 生成知识函数
async function generateKnowledge(
  question: string,
  domain: string,
  numKnowledge: number,
  modelName: string,
  temperature: number,
  maxTokens: number
): Promise<KnowledgeItem[]> {
  const knowledgePrompt = buildKnowledgeGenerationPrompt(question, domain);

  const chatInstance = new ChatOpenAI({
    openAIApiKey: process.env.OPEN_API_KEY,
    modelName,
    temperature,
    maxTokens,
    configuration: {
      baseURL: process.env.OPEN_API_BASE_URL,
    },
  });

  const knowledgeItems: KnowledgeItem[] = [];

  // 生成多个知识项
  for (let i = 0; i < numKnowledge; i++) {
    const startTime = Date.now();

    const messages = [
      new SystemMessage(
        '你是一个知识生成专家，能够为给定问题生成准确、有用的背景知识。'
      ),
      new HumanMessage(knowledgePrompt),
    ];

    try {
      const response = await chatInstance.invoke(messages);
      const endTime = Date.now();

      const knowledge = extractKnowledge(response.content as string);

      knowledgeItems.push({
        id: i + 1,
        content: knowledge,
        confidence: calculateKnowledgeConfidence(knowledge),
        tokens: response.usage_metadata?.total_tokens || 0,
        duration: endTime - startTime,
      });
    } catch (error) {
      console.error(`知识生成第${i + 1}次失败:`, error);
    }
  }

  return knowledgeItems;
}

// 知识整合推理函数
async function integrateKnowledgeReasoning(
  question: string,
  knowledgeItems: KnowledgeItem[],
  modelName: string,
  temperature: number,
  maxTokens: number
): Promise<{ answer: string; reasoning: string }> {
  const integrationPrompt = buildKnowledgeIntegrationPrompt(
    question,
    knowledgeItems
  );

  const chatInstance = new ChatOpenAI({
    openAIApiKey: process.env.OPEN_API_KEY,
    modelName,
    temperature: temperature * 0.8, // 降低温度以获得更一致的推理
    maxTokens,
    configuration: {
      baseURL: process.env.OPEN_API_BASE_URL,
    },
  });

  const messages = [
    new SystemMessage(
      '你是一个推理专家，能够整合背景知识进行准确推理和回答问题。'
    ),
    new HumanMessage(integrationPrompt),
  ];

  const response = await chatInstance.invoke(messages);
  const content = response.content as string;

  const { answer, reasoning } = parseReasoningResponse(content);

  return { answer, reasoning };
}

// 构建知识生成提示词
function buildKnowledgeGenerationPrompt(
  question: string,
  domain: string
): string {
  const domainExamples = getKnowledgeExamples(domain);

  return `${domainExamples}

输入：${question}
知识：`;
}

// 获取领域相关的知识生成示例
function getKnowledgeExamples(domain: string): string {
  const examples = {
    general: `输入：希腊比墨西哥大。
知识：希腊的面积约为131,957平方公里，而墨西哥的面积约为1,964,375平方公里，使墨西哥比希腊大了1,389%。

输入：眼镜总是会起雾。
知识：当你的汗水、呼吸和周围的湿度中的水蒸气落在冷的表面上，冷却并变成微小的液滴时，会在眼镜镜片上产生冷凝。你看到的是一层薄膜。你的镜片相对于你的呼吸会比较凉，尤其是当外面的空气很冷时。

输入：一个人一生中吸烟很多香烟的常见影响是患肺癌的几率高于正常水平。
知识：那些一生中平均每天吸烟不到一支香烟的人，患肺癌的风险是从不吸烟者的9倍。在每天吸烟1到10支香烟之间的人群中，死于肺癌的风险几乎是从不吸烟者的12倍。`,

    science: `输入：光的速度是恒定的。
知识：在真空中，光速是宇宙中的一个基本常数，约为299,792,458米每秒。根据爱因斯坦的相对论，没有任何物质或信息可以超过这个速度。光速在不同介质中会发生变化，但真空中的光速是绝对的。

输入：水的沸点是100摄氏度。
知识：在标准大气压（1个大气压或101.325千帕）下，纯水的沸点确实是100摄氏度（212华氏度）。但是沸点会随着大气压的变化而变化：在高海拔地区，由于大气压较低，水的沸点会降低；而在高压环境下，沸点会升高。

输入：植物进行光合作用需要阳光。
知识：光合作用是植物利用阳光、二氧化碳和水制造葡萄糖和氧气的过程。这个过程发生在叶绿体中，需要叶绿素吸收光能。光合作用的化学方程式是：6CO₂ + 6H₂O + 光能 → C₆H₁₂O₆ + 6O₂。没有光，大多数植物无法进行光合作用。`,

    sports: `输入：足球比赛有11个球员。
知识：在标准的足球（足球）比赛中，每队在场上有11名球员，包括1名守门员和10名场上球员。这是FIFA（国际足球联合会）规定的标准配置。在比赛过程中，每队最多可以进行3次换人。

输入：篮球比赛分为四节。
知识：NBA和FIBA篮球比赛都分为四节，每节在NBA中为12分钟，在FIBA规则中为10分钟。如果比赛打平，会进行加时赛，每个加时赛时长为5分钟。大学篮球（NCAA）则分为两个20分钟的半场。

输入：高尔夫球的一部分是试图获得比其他人更高的得分。
知识：高尔夫球的目标是以最少的杆数打完一组洞。一轮高尔夫球比赛通常包括18个洞。每个杆计为一分，总杆数用于确定比赛的获胜者。得分最低的选手赢得比赛，所以高尔夫球实际上是要获得更低的分数，而不是更高的分数。`,

    history: `输入：罗马帝国在5世纪灭亡。
知识：西罗马帝国在476年正式灭亡，当时日耳曼酋长奥多亚克废黜了最后一位西罗马皇帝罗慕路斯·奥古斯都。然而，东罗马帝国（拜占庭帝国）继续存在了近1000年，直到1453年君士坦丁堡被奥斯曼土耳其帝国攻陷。

输入：第二次世界大战始于1939年。
知识：第二次世界大战于1939年9月1日开始，当时纳粹德国入侵波兰。英国和法国随后于9月3日对德国宣战。战争在欧洲、亚洲、非洲和太平洋地区展开，直到1945年结束，是人类历史上规模最大、伤亡最惨重的战争。

输入：中国的长城是为了防御外敌入侵而建造的。
知识：中国长城主要建于明朝时期（1368-1644年），用于防御北方游牧民族的入侵，特别是蒙古族。长城全长约2.1万公里，包括墙体、关隘、烽火台等防御设施。它不是一次性建成的，而是历代王朝在不同时期修建和完善的防御体系。`,

    geography: `输入：珠穆朗玛峰是世界最高峰。
知识：珠穆朗玛峰海拔8,848.86米，位于中国和尼泊尔边境，是世界上海拔最高的山峰。它位于喜马拉雅山脉中段，藏语称"珠穆朗玛"意为"大地之母"。由于地质活动，珠穆朗玛峰的高度还在缓慢增长。

输入：亚马逊河是世界最长的河流。
知识：亚马逊河全长约6,400公里，是世界上流量最大、流域面积最广的河流，但关于最长河流的地位存在争议。尼罗河传统上被认为是最长的河流，长约6,650公里。亚马逊河流域面积约700万平方公里，约占南美洲面积的40%。

输入：撒哈拉沙漠是世界最大的沙漠。
知识：撒哈拉沙漠面积约906万平方公里，是世界第三大沙漠，但是世界最大的热带沙漠。南极洲（1400万平方公里）和北极（1370万平方公里）虽然更大，但它们是寒带沙漠。撒哈拉沙漠横跨北非多个国家，面积约等于美国或中国的国土面积。`,

    'daily-life': `输入：每天喝8杯水对健康有益。
知识：虽然"每天8杯水"是常见建议，但实际需水量因人而异，取决于体重、活动水平、气候和整体健康状况。美国国家科学院建议，成年男性每天约需3.7升（约15杯）液体，女性约需2.7升（约11杯）液体，这包括食物中的水分。

输入：睡眠不足会影响记忆力。
知识：睡眠对记忆巩固至关重要。在睡眠期间，大脑会将白天学到的信息从短期记忆转移到长期记忆中。研究表明，睡眠不足会严重影响学习能力、注意力和决策能力。成年人通常需要7-9小时的睡眠时间。

输入：维生素C可以预防感冒。
知识：虽然维生素C对免疫系统很重要，但大多数研究表明，对于普通人群，常规补充维生素C并不能显著预防感冒。然而，维生素C可能会略微缩短感冒持续时间。对于极端环境下的人群（如马拉松运动员），维生素C补充可能有预防效果。`,
  };

  return examples[domain as keyof typeof examples] || examples.general;
}

// 构建知识整合提示词
function buildKnowledgeIntegrationPrompt(
  question: string,
  knowledgeItems: KnowledgeItem[]
): string {
  const knowledgeText = knowledgeItems
    .map((item, index) => `知识${index + 1}：${item.content}`)
    .join('\n\n');

  return `问题：${question}

${knowledgeText}

请基于上述知识回答问题。首先简要说明你的推理过程，然后给出明确的答案。

推理过程：
最终答案：`;
}

// 提取生成的知识
function extractKnowledge(content: string): string {
  // 移除可能的"知识："前缀，获取实际知识内容
  const knowledge = content.replace(/^知识[：:]\s*/i, '').trim();
  return knowledge || content.trim();
}

// 计算知识置信度
function calculateKnowledgeConfidence(knowledge: string): number {
  let confidence = 0.5;

  // 基于知识长度
  const length = knowledge.length;
  if (length > 200) confidence += 0.2;
  else if (length > 100) confidence += 0.1;
  else if (length < 50) confidence -= 0.1;

  // 基于事实性指标
  const factualIndicators = [
    '约',
    '大约',
    '根据',
    '研究表明',
    '数据显示',
    '据统计',
  ];
  const vaguenessIndicators = ['可能', '也许', '大概', '估计'];

  factualIndicators.forEach((indicator) => {
    if (knowledge.includes(indicator)) confidence += 0.05;
  });

  vaguenessIndicators.forEach((indicator) => {
    if (knowledge.includes(indicator)) confidence -= 0.05;
  });

  // 基于数字和具体信息
  const numberCount = (knowledge.match(/\d+/g) || []).length;
  confidence += Math.min(numberCount * 0.02, 0.1);

  return Math.max(0.1, Math.min(0.95, confidence));
}

// 解析推理响应
function parseReasoningResponse(content: string): {
  answer: string;
  reasoning: string;
} {
  const reasoningMatch = content.match(
    /推理过程[：:]\s*([\s\S]*?)(?=最终答案|$)/i
  );
  const answerMatch = content.match(/最终答案[：:]\s*([\s\S]*?)$/i);

  const reasoning = reasoningMatch ? reasoningMatch[1].trim() : '';
  const answer = answerMatch ? answerMatch[1].trim() : content.trim();

  return { answer, reasoning };
}
