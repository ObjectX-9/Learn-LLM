import { NextRequest, NextResponse } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

export interface ThoughtNode {
  id: string;
  thought: string;
  step: number;
  parentId?: string;
  children: ThoughtNode[];
  evaluation: 'sure' | 'maybe' | 'impossible' | 'pending';
  confidence: number;
  reasoning: string;
  isLeaf: boolean;
  isSelected: boolean;
  depth: number;
  path: string[]; // 从根到当前节点的路径
}

export interface ToTRequest {
  problem: string;
  taskType:
    | 'game-24'
    | 'creative-writing'
    | 'mathematical-reasoning'
    | 'logical-puzzle'
    | 'custom';
  searchMethod: 'bfs' | 'dfs' | 'beam';
  maxDepth: number;
  candidatesPerStep: number;
  maxNodes: number;
  temperature?: number;
  modelName?: string;
  stream?: boolean;
}

export interface ToTResponse {
  taskType: string;
  searchMethod: string;
  totalNodes: number;
  exploredNodes: number;
  bestPath: ThoughtNode[];
  finalAnswer: string;
  searchTree: ThoughtNode;
  totalTime: number;
  searchSteps: SearchStep[];
}

export interface SearchStep {
  stepIndex: number;
  action: 'generate' | 'evaluate' | 'select' | 'backtrack' | 'complete';
  nodeId: string;
  thought?: string;
  evaluation?: string;
  reasoning?: string;
  candidatesGenerated?: number;
  selectedNodes?: string[];
  message: string;
  timestamp: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: ToTRequest = await request.json();
    const {
      problem,
      taskType,
      searchMethod,
      maxDepth,
      candidatesPerStep,
      maxNodes,
      temperature = 0.8,
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
              message: '开始构建思维树...',
              taskType,
              searchMethod,
              maxDepth,
              candidatesPerStep,
            })}\n\n`;
            controller.enqueue(encoder.encode(startData));

            // 初始化思维树
            const rootNode: ThoughtNode = {
              id: 'root',
              thought: problem,
              step: 0,
              children: [],
              evaluation: 'pending',
              confidence: 1.0,
              reasoning: '问题的起始状态',
              isLeaf: false,
              isSelected: false,
              depth: 0,
              path: [],
            };

            const searchSteps: SearchStep[] = [];
            let nodeCounter = 1;
            let exploredNodes = 0;

            // 执行搜索算法
            const result = await executeSearch(
              rootNode,
              {
                problem,
                taskType,
                searchMethod,
                maxDepth,
                candidatesPerStep,
                maxNodes,
                temperature,
                modelName,
              },
              controller,
              encoder,
              searchSteps,
              nodeCounter,
              exploredNodes
            );

            const totalTime = Date.now() - startTime;

            // 发送最终结果
            const finalData = `data: ${JSON.stringify({
              type: 'final_result',
              result: {
                taskType,
                searchMethod,
                totalNodes: result.nodeCounter,
                exploredNodes: result.exploredNodes,
                bestPath: result.bestPath,
                finalAnswer: result.finalAnswer,
                searchTree: rootNode,
                totalTime,
                searchSteps,
              },
            })}\n\n`;
            controller.enqueue(encoder.encode(finalData));

            // 发送完成信号
            const doneData = `data: ${JSON.stringify({ type: 'done' })}\n\n`;
            controller.enqueue(encoder.encode(doneData));
            controller.close();
          } catch (error) {
            console.error('ToT Stream Error:', error);
            const errorData = `data: ${JSON.stringify({
              type: 'error',
              error: '思维树构建过程发生错误',
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
      const rootNode: ThoughtNode = {
        id: 'root',
        thought: problem,
        step: 0,
        children: [],
        evaluation: 'pending',
        confidence: 1.0,
        reasoning: '问题的起始状态',
        isLeaf: false,
        isSelected: false,
        depth: 0,
        path: [],
      };

      const searchSteps: SearchStep[] = [];
      let nodeCounter = 1;
      let exploredNodes = 0;

      const result = await executeSearch(
        rootNode,
        {
          problem,
          taskType,
          searchMethod,
          maxDepth,
          candidatesPerStep,
          maxNodes,
          temperature,
          modelName,
        },
        null,
        null,
        searchSteps,
        nodeCounter,
        exploredNodes
      );

      const totalTime = Date.now() - startTime;

      return NextResponse.json({
        taskType,
        searchMethod,
        totalNodes: result.nodeCounter,
        exploredNodes: result.exploredNodes,
        bestPath: result.bestPath,
        finalAnswer: result.finalAnswer,
        searchTree: rootNode,
        totalTime,
        searchSteps,
        model: modelName,
      });
    }
  } catch (error) {
    console.error('ToT API Error:', error);
    return NextResponse.json(
      {
        error: '思维树处理时发生错误',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

// 执行搜索算法
async function executeSearch(
  rootNode: ThoughtNode,
  config: any,
  controller: any,
  encoder: any,
  searchSteps: SearchStep[],
  nodeCounter: number,
  exploredNodes: number
): Promise<{
  bestPath: ThoughtNode[];
  finalAnswer: string;
  nodeCounter: number;
  exploredNodes: number;
}> {
  switch (config.searchMethod) {
    case 'bfs':
      return await breadthFirstSearch(
        rootNode,
        config,
        controller,
        encoder,
        searchSteps,
        nodeCounter,
        exploredNodes
      );
    case 'dfs':
      return await depthFirstSearch(
        rootNode,
        config,
        controller,
        encoder,
        searchSteps,
        nodeCounter,
        exploredNodes
      );
    case 'beam':
      return await beamSearch(
        rootNode,
        config,
        controller,
        encoder,
        searchSteps,
        nodeCounter,
        exploredNodes
      );
    default:
      throw new Error(`不支持的搜索方法: ${config.searchMethod}`);
  }
}

// 广度优先搜索
async function breadthFirstSearch(
  rootNode: ThoughtNode,
  config: any,
  controller: any,
  encoder: any,
  searchSteps: SearchStep[],
  nodeCounter: number,
  exploredNodes: number
): Promise<any> {
  const queue: ThoughtNode[] = [rootNode];
  let bestPath: ThoughtNode[] = [];
  let finalAnswer = '';

  while (queue.length > 0 && nodeCounter < config.maxNodes) {
    const currentNode = queue.shift()!;

    // 发送当前探索节点信息
    if (controller) {
      const exploreData = `data: ${JSON.stringify({
        type: 'explore_node',
        nodeId: currentNode.id,
        thought: currentNode.thought,
        step: currentNode.step,
        message: `探索节点: ${currentNode.thought.slice(0, 50)}...`,
      })}\n\n`;
      controller.enqueue(encoder.encode(exploreData));
    }

    exploredNodes++;

    // 检查是否达到最大深度
    if (currentNode.depth >= config.maxDepth) {
      // 评估叶子节点
      const evaluation = await evaluateThought(currentNode, config);
      currentNode.evaluation = evaluation.evaluation;
      currentNode.confidence = evaluation.confidence;
      currentNode.reasoning = evaluation.reasoning;
      currentNode.isLeaf = true;

      if (evaluation.evaluation === 'sure') {
        bestPath = getPathToNode(currentNode);
        finalAnswer = currentNode.thought;
        break;
      }
      continue;
    }

    // 生成候选思维
    const candidates = await generateCandidateThoughts(currentNode, config);

    for (const candidateThought of candidates) {
      const childNode: ThoughtNode = {
        id: `node-${nodeCounter++}`,
        thought: candidateThought,
        step: currentNode.step + 1,
        parentId: currentNode.id,
        children: [],
        evaluation: 'pending',
        confidence: 0,
        reasoning: '',
        isLeaf: false,
        isSelected: false,
        depth: currentNode.depth + 1,
        path: [...currentNode.path, currentNode.id],
      };

      // 评估候选思维
      const evaluation = await evaluateThought(childNode, config);
      childNode.evaluation = evaluation.evaluation;
      childNode.confidence = evaluation.confidence;
      childNode.reasoning = evaluation.reasoning;

      currentNode.children.push(childNode);

      // 发送生成候选思维信息
      if (controller) {
        const candidateData = `data: ${JSON.stringify({
          type: 'generate_candidate',
          parentId: currentNode.id,
          childId: childNode.id,
          thought: childNode.thought,
          evaluation: childNode.evaluation,
          confidence: childNode.confidence,
          message: `生成候选思维: ${evaluation.evaluation}`,
        })}\n\n`;
        controller.enqueue(encoder.encode(candidateData));
      }

      // 将有希望的候选加入队列
      if (
        evaluation.evaluation === 'sure' ||
        evaluation.evaluation === 'maybe'
      ) {
        queue.push(childNode);
      }
    }

    // 记录搜索步骤
    searchSteps.push({
      stepIndex: searchSteps.length,
      action: 'generate',
      nodeId: currentNode.id,
      candidatesGenerated: candidates.length,
      message: `为节点 ${currentNode.id} 生成了 ${candidates.length} 个候选思维`,
      timestamp: Date.now(),
    });
  }

  // 如果没有找到确定的答案，选择最好的路径
  if (!finalAnswer && rootNode.children.length > 0) {
    const bestNode = findBestLeafNode(rootNode);
    if (bestNode) {
      bestPath = getPathToNode(bestNode);
      finalAnswer = bestNode.thought;
    }
  }

  return { bestPath, finalAnswer, nodeCounter, exploredNodes };
}

// 深度优先搜索
async function depthFirstSearch(
  rootNode: ThoughtNode,
  config: any,
  controller: any,
  encoder: any,
  searchSteps: SearchStep[],
  nodeCounter: number,
  exploredNodes: number
): Promise<any> {
  const stack: ThoughtNode[] = [rootNode];
  let bestPath: ThoughtNode[] = [];
  let finalAnswer = '';

  while (stack.length > 0 && nodeCounter < config.maxNodes) {
    const currentNode = stack.pop()!;

    if (controller) {
      const exploreData = `data: ${JSON.stringify({
        type: 'explore_node',
        nodeId: currentNode.id,
        thought: currentNode.thought,
        step: currentNode.step,
        message: `DFS探索: ${currentNode.thought.slice(0, 50)}...`,
      })}\n\n`;
      controller.enqueue(encoder.encode(exploreData));
    }

    exploredNodes++;

    if (currentNode.depth >= config.maxDepth) {
      const evaluation = await evaluateThought(currentNode, config);
      currentNode.evaluation = evaluation.evaluation;
      currentNode.confidence = evaluation.confidence;
      currentNode.reasoning = evaluation.reasoning;
      currentNode.isLeaf = true;

      if (evaluation.evaluation === 'sure') {
        bestPath = getPathToNode(currentNode);
        finalAnswer = currentNode.thought;
        break;
      }
      continue;
    }

    const candidates = await generateCandidateThoughts(currentNode, config);

    for (const candidateThought of candidates.reverse()) {
      // 逆序保证先入后出
      const childNode: ThoughtNode = {
        id: `node-${nodeCounter++}`,
        thought: candidateThought,
        step: currentNode.step + 1,
        parentId: currentNode.id,
        children: [],
        evaluation: 'pending',
        confidence: 0,
        reasoning: '',
        isLeaf: false,
        isSelected: false,
        depth: currentNode.depth + 1,
        path: [...currentNode.path, currentNode.id],
      };

      const evaluation = await evaluateThought(childNode, config);
      childNode.evaluation = evaluation.evaluation;
      childNode.confidence = evaluation.confidence;
      childNode.reasoning = evaluation.reasoning;

      currentNode.children.push(childNode);

      if (
        evaluation.evaluation === 'sure' ||
        evaluation.evaluation === 'maybe'
      ) {
        stack.push(childNode);
      }
    }
  }

  if (!finalAnswer && rootNode.children.length > 0) {
    const bestNode = findBestLeafNode(rootNode);
    if (bestNode) {
      bestPath = getPathToNode(bestNode);
      finalAnswer = bestNode.thought;
    }
  }

  return { bestPath, finalAnswer, nodeCounter, exploredNodes };
}

// 束搜索
async function beamSearch(
  rootNode: ThoughtNode,
  config: any,
  controller: any,
  encoder: any,
  searchSteps: SearchStep[],
  nodeCounter: number,
  exploredNodes: number
): Promise<any> {
  let currentLevel: ThoughtNode[] = [rootNode];
  let bestPath: ThoughtNode[] = [];
  let finalAnswer = '';

  for (
    let depth = 0;
    depth < config.maxDepth && currentLevel.length > 0;
    depth++
  ) {
    const nextLevel: ThoughtNode[] = [];

    for (const node of currentLevel) {
      if (nodeCounter >= config.maxNodes) break;

      exploredNodes++;

      const candidates = await generateCandidateThoughts(node, config);

      for (const candidateThought of candidates) {
        const childNode: ThoughtNode = {
          id: `node-${nodeCounter++}`,
          thought: candidateThought,
          step: node.step + 1,
          parentId: node.id,
          children: [],
          evaluation: 'pending',
          confidence: 0,
          reasoning: '',
          isLeaf: false,
          isSelected: false,
          depth: node.depth + 1,
          path: [...node.path, node.id],
        };

        const evaluation = await evaluateThought(childNode, config);
        childNode.evaluation = evaluation.evaluation;
        childNode.confidence = evaluation.confidence;
        childNode.reasoning = evaluation.reasoning;

        node.children.push(childNode);

        if (evaluation.evaluation === 'sure') {
          bestPath = getPathToNode(childNode);
          finalAnswer = childNode.thought;
          return { bestPath, finalAnswer, nodeCounter, exploredNodes };
        } else if (evaluation.evaluation === 'maybe') {
          nextLevel.push(childNode);
        }
      }
    }

    // 保留最好的候选（束宽度）
    currentLevel = nextLevel
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, config.candidatesPerStep);
  }

  if (!finalAnswer && rootNode.children.length > 0) {
    const bestNode = findBestLeafNode(rootNode);
    if (bestNode) {
      bestPath = getPathToNode(bestNode);
      finalAnswer = bestNode.thought;
    }
  }

  return { bestPath, finalAnswer, nodeCounter, exploredNodes };
}

// 生成候选思维
async function generateCandidateThoughts(
  node: ThoughtNode,
  config: any
): Promise<string[]> {
  const chatInstance = new ChatOpenAI({
    openAIApiKey: process.env.OPEN_API_KEY,
    modelName: config.modelName,
    temperature: config.temperature,
    maxTokens: 200,
    configuration: {
      baseURL: process.env.OPEN_API_BASE_URL,
    },
  });

  const systemMessage = buildSystemMessage(config.taskType);
  const promptMessage = buildGenerationPrompt(node, config);

  const messages = [
    new SystemMessage(systemMessage),
    new HumanMessage(promptMessage),
  ];

  const response = await chatInstance.invoke(messages);
  const responseText = response.content as string;

  // 解析候选思维
  return parseGeneratedThoughts(responseText, config.candidatesPerStep);
}

// 评估思维
async function evaluateThought(
  node: ThoughtNode,
  config: any
): Promise<{
  evaluation: 'sure' | 'maybe' | 'impossible';
  confidence: number;
  reasoning: string;
}> {
  const chatInstance = new ChatOpenAI({
    openAIApiKey: process.env.OPEN_API_KEY,
    modelName: config.modelName,
    temperature: 0.3, // 评估时使用较低温度
    maxTokens: 300,
    configuration: {
      baseURL: process.env.OPEN_API_BASE_URL,
    },
  });

  const systemMessage = buildEvaluationSystemMessage(config.taskType);
  const promptMessage = buildEvaluationPrompt(node, config);

  const messages = [
    new SystemMessage(systemMessage),
    new HumanMessage(promptMessage),
  ];

  const response = await chatInstance.invoke(messages);
  const responseText = response.content as string;

  return parseEvaluation(responseText);
}

// 构建系统消息
function buildSystemMessage(taskType: string): string {
  const baseMessage = '你是一个专业的问题解决专家，擅长分步骤思考和推理。';

  switch (taskType) {
    case 'game-24':
      return `${baseMessage} 你正在帮助解决算24游戏。需要使用四个数字和基本运算符（+、-、*、/）来得到24。每个数字只能使用一次。`;
    case 'creative-writing':
      return `${baseMessage} 你正在帮助进行创意写作。需要逐步构建有趣、连贯且引人入胜的故事情节。`;
    case 'mathematical-reasoning':
      return `${baseMessage} 你正在帮助解决数学推理问题。需要运用逻辑推理和数学知识，一步步得出正确答案。`;
    case 'logical-puzzle':
      return `${baseMessage} 你正在帮助解决逻辑谜题。需要仔细分析条件，运用逻辑推理来找到解决方案。`;
    default:
      return `${baseMessage} 请帮助解决这个问题，采用分步骤的思考方式。`;
  }
}

// 构建生成提示
function buildGenerationPrompt(node: ThoughtNode, config: any): string {
  const pathContext =
    node.path.length > 0
      ? `当前思维路径: ${node.path.join(' → ')} → ${node.thought}`
      : `起始问题: ${node.thought}`;

  return `${pathContext}

请生成 ${config.candidatesPerStep} 个可能的下一步思维。每个思维应该是解决问题的一个具体步骤或想法。

问题类型: ${config.taskType}
当前步骤: ${node.step + 1}
最大深度: ${config.maxDepth}

请以编号列表形式返回候选思维：
1. [第一个候选思维]
2. [第二个候选思维]
...`;
}

// 构建评估系统消息
function buildEvaluationSystemMessage(taskType: string): string {
  return `你是一个专业的思维评估专家。你需要评估一个中间思维步骤的质量和可行性。

评估标准：
- sure: 这个思维肯定能帮助解决问题，非常有前途
- maybe: 这个思维可能有用，值得继续探索
- impossible: 这个思维不可行或会导致错误的方向

请提供评估结果、置信度(0-1)和详细的推理过程。`;
}

// 构建评估提示
function buildEvaluationPrompt(node: ThoughtNode, config: any): string {
  return `请评估以下思维步骤：

原始问题: ${config.problem}
当前思维: ${node.thought}
步骤编号: ${node.step}

请按以下格式返回评估结果：
评估: [sure/maybe/impossible]
置信度: [0-1之间的数值]
推理: [详细的评估理由]`;
}

// 解析生成的思维
function parseGeneratedThoughts(
  responseText: string,
  maxCandidates: number
): string[] {
  const lines = responseText.split('\n').filter((line) => line.trim());
  const thoughts: string[] = [];

  for (const line of lines) {
    const match = line.match(/^\d+\.\s*(.+)$/);
    if (match && thoughts.length < maxCandidates) {
      thoughts.push(match[1].trim());
    }
  }

  return thoughts.slice(0, maxCandidates);
}

// 解析评估结果
function parseEvaluation(responseText: string): {
  evaluation: 'sure' | 'maybe' | 'impossible';
  confidence: number;
  reasoning: string;
} {
  const lines = responseText.split('\n');
  let evaluation: 'sure' | 'maybe' | 'impossible' = 'maybe';
  let confidence = 0.5;
  let reasoning = '';

  for (const line of lines) {
    if (line.includes('评估:') || line.includes('Evaluation:')) {
      const evalMatch = line.match(/(sure|maybe|impossible)/i);
      if (evalMatch) {
        evaluation = evalMatch[1].toLowerCase() as
          | 'sure'
          | 'maybe'
          | 'impossible';
      }
    } else if (line.includes('置信度:') || line.includes('Confidence:')) {
      const confMatch = line.match(/(\d+\.?\d*)/);
      if (confMatch) {
        confidence = Math.min(1, Math.max(0, parseFloat(confMatch[1])));
      }
    } else if (line.includes('推理:') || line.includes('Reasoning:')) {
      reasoning = line.split(':')[1]?.trim() || '';
    }
  }

  // 如果没有找到详细推理，使用整个响应
  if (!reasoning) {
    reasoning = responseText.trim();
  }

  return { evaluation, confidence, reasoning };
}

// 找到最佳叶子节点
function findBestLeafNode(root: ThoughtNode): ThoughtNode | null {
  let bestNode: ThoughtNode | null = null;
  let bestScore = -1;

  function traverse(node: ThoughtNode) {
    if (node.isLeaf || node.children.length === 0) {
      const score = calculateNodeScore(node);
      if (score > bestScore) {
        bestScore = score;
        bestNode = node;
      }
    } else {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  traverse(root);
  return bestNode;
}

// 计算节点分数
function calculateNodeScore(node: ThoughtNode): number {
  let score = node.confidence;

  // 评估类型权重
  if (node.evaluation === 'sure') score += 0.5;
  else if (node.evaluation === 'impossible') score -= 0.5;

  // 深度奖励（更深的节点可能更接近解决方案）
  score += node.depth * 0.1;

  return score;
}

// 获取到节点的路径
function getPathToNode(node: ThoughtNode): ThoughtNode[] {
  const path: ThoughtNode[] = [];
  let current: ThoughtNode | undefined = node;

  while (current) {
    path.unshift(current);
    // 需要通过parent关系构建路径（简化实现）
    break; // 这里简化处理，实际需要维护parent引用
  }

  return path;
}
