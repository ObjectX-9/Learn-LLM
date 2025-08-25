import { NextRequest, NextResponse } from 'next/server';
import { OpenAIEmbeddings } from '@langchain/openai';

// 简单的UUID生成函数
const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// 向量数据存储接口
interface VectorData {
  id: string;
  text: string;
  vector: number[];
  metadata: Record<string, any>;
  timestamp: string;
}

// 内存向量存储
let vectorDatabase: VectorData[] = [];

// 初始化OpenAI Embeddings
const initializeEmbeddings = () => {
  console.log('🔧 初始化Embeddings模型...');
  console.log('API Key:', process.env.OPEN_API_KEY ? '已配置' : '❌ 未配置');

  if (!process.env.OPEN_API_KEY) {
    throw new Error('❌ 请在 .env.local 中配置 OPEN_API_KEY');
  }

  return new OpenAIEmbeddings({
    openAIApiKey: process.env.OPEN_API_KEY,
    configuration: {
      baseURL: process.env.OPEN_API_BASE_URL,
    },
  });
};

// 计算向量相似度（余弦相似度）
const calculateCosineSimilarity = (vec1: number[], vec2: number[]): number => {
  if (vec1.length !== vec2.length) return 0;

  const dotProduct = vec1.reduce((sum, a, i) => sum + a * vec2[i], 0);
  const magnitude1 = Math.sqrt(vec1.reduce((sum, a) => sum + a * a, 0));
  const magnitude2 = Math.sqrt(vec2.reduce((sum, a) => sum + a * a, 0));

  if (magnitude1 === 0 || magnitude2 === 0) return 0;
  return dotProduct / (magnitude1 * magnitude2);
};

// 计算向量统计信息
const calculateVectorStats = () => {
  if (vectorDatabase.length === 0) {
    return { totalVectors: 0, dimensions: 0, avgMagnitude: 0 };
  }

  const dimensions = vectorDatabase[0].vector.length;
  const magnitudes = vectorDatabase.map((item) =>
    Math.sqrt(item.vector.reduce((sum, v) => sum + v * v, 0))
  );
  const avgMagnitude =
    magnitudes.reduce((sum, mag) => sum + mag, 0) / magnitudes.length;

  return {
    totalVectors: vectorDatabase.length,
    dimensions,
    avgMagnitude,
  };
};

export async function POST(request: NextRequest) {
  console.log('📨 收到向量数据库API请求');

  try {
    const body = await request.json();
    const { action, text, query, topK = 5 } = body;
    console.log('🔍 请求操作:', action);

    // 向量化文本
    if (action === 'vectorize') {
      console.log('🔮 开始向量化文本:', text?.substring(0, 50));

      if (!text || text.trim().length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: '文本内容不能为空',
          },
          { status: 400 }
        );
      }

      const embeddings = initializeEmbeddings();

      console.log('🚀 调用OpenAI Embeddings API...');
      const startTime = Date.now();

      // 设置15秒超时
      const embeddingPromise = embeddings.embedQuery(text.trim());
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('向量化超时（15秒）')), 15000)
      );

      const vector = (await Promise.race([
        embeddingPromise,
        timeoutPromise,
      ])) as number[];
      const endTime = Date.now();

      console.log('✅ 向量化完成，耗时:', endTime - startTime, 'ms');
      console.log('📊 向量维度:', vector.length);

      // 生成唯一ID并存储
      const id = generateId();
      const vectorData: VectorData = {
        id,
        text: text.trim(),
        vector,
        metadata: {
          length: text.trim().length,
          createdAt: new Date().toISOString(),
          responseTime: endTime - startTime,
        },
        timestamp: new Date().toISOString(),
      };

      vectorDatabase.push(vectorData);
      console.log('💾 向量已存储到数据库，总数:', vectorDatabase.length);

      return NextResponse.json({
        success: true,
        id,
        vector,
        metadata: vectorData.metadata,
        message: '向量化成功',
      });
    }

    // 向量相似性搜索
    if (action === 'search') {
      console.log('🔍 开始向量搜索:', query?.substring(0, 50));

      if (!query || query.trim().length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: '搜索查询不能为空',
          },
          { status: 400 }
        );
      }

      if (vectorDatabase.length === 0) {
        return NextResponse.json({
          success: true,
          results: [],
          message: '向量数据库为空',
        });
      }

      const embeddings = initializeEmbeddings();

      console.log('🚀 向量化搜索查询...');
      const queryVector = await embeddings.embedQuery(query.trim());

      console.log('📊 计算相似度...');
      // 计算所有向量的相似度
      const similarities = vectorDatabase.map((item) => ({
        ...item,
        similarity: calculateCosineSimilarity(queryVector, item.vector),
      }));

      // 按相似度排序并取Top-K
      const results = similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK)
        .map((item) => ({
          id: item.id,
          text: item.text,
          vector: item.vector,
          metadata: item.metadata,
          similarity: item.similarity,
        }));

      console.log('✅ 搜索完成，返回', results.length, '个结果');

      return NextResponse.json({
        success: true,
        results,
        totalSearched: vectorDatabase.length,
      });
    }

    // 获取向量数据库统计信息
    if (action === 'getStats') {
      console.log('📊 获取向量数据库统计信息');

      const stats = calculateVectorStats();

      return NextResponse.json({
        success: true,
        stats,
        vectors: vectorDatabase.map((item) => ({
          id: item.id,
          text: item.text,
          vector: item.vector,
          metadata: item.metadata,
        })),
      });
    }

    // 清空向量数据库
    if (action === 'clear') {
      console.log('🗑️ 清空向量数据库');
      const previousCount = vectorDatabase.length;
      vectorDatabase = [];

      return NextResponse.json({
        success: true,
        message: `已清空 ${previousCount} 个向量`,
      });
    }

    // 删除特定向量
    if (action === 'delete') {
      const { id } = body;
      console.log('🗑️ 删除向量:', id);

      const initialLength = vectorDatabase.length;
      vectorDatabase = vectorDatabase.filter((item) => item.id !== id);

      if (vectorDatabase.length < initialLength) {
        return NextResponse.json({
          success: true,
          message: '向量删除成功',
        });
      } else {
        return NextResponse.json(
          {
            success: false,
            error: '未找到指定向量',
          },
          { status: 404 }
        );
      }
    }

    // 获取向量详情
    if (action === 'getVector') {
      const { id } = body;
      console.log('📋 获取向量详情:', id);

      const vector = vectorDatabase.find((item) => item.id === id);

      if (vector) {
        return NextResponse.json({
          success: true,
          vector,
        });
      } else {
        return NextResponse.json(
          {
            success: false,
            error: '未找到指定向量',
          },
          { status: 404 }
        );
      }
    }

    // 向量相似度比较
    if (action === 'compare') {
      const { id1, id2 } = body;
      console.log('⚖️ 比较向量相似度:', id1, 'vs', id2);

      const vector1 = vectorDatabase.find((item) => item.id === id1);
      const vector2 = vectorDatabase.find((item) => item.id === id2);

      if (!vector1 || !vector2) {
        return NextResponse.json(
          {
            success: false,
            error: '未找到指定向量',
          },
          { status: 404 }
        );
      }

      const similarity = calculateCosineSimilarity(
        vector1.vector,
        vector2.vector
      );

      return NextResponse.json({
        success: true,
        similarity,
        vector1: { id: vector1.id, text: vector1.text },
        vector2: { id: vector2.id, text: vector2.text },
      });
    }

    console.log('❌ 无效的操作类型:', action);
    return NextResponse.json(
      {
        success: false,
        error: '无效的操作类型',
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('❌ 向量数据库API错误:', error);

    return NextResponse.json(
      {
        success: false,
        error: '处理请求时发生错误',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
