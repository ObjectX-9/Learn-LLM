import { NextRequest, NextResponse } from 'next/server';
import { OpenAIEmbeddings } from '@langchain/openai';

// 测试API端点，用于调试OpenAI连接问题
export async function POST(request: NextRequest) {
  console.log('🧪 开始测试 OpenAI 连接');

  try {
    const { testText = '这是一个测试文本' } = await request.json();

    console.log('🔧 检查环境变量...');
    console.log('API Key:', process.env.OPEN_API_KEY ? '已配置' : '❌ 未配置');
    console.log('Base URL:', process.env.OPEN_API_BASE_URL || '使用默认URL');

    if (!process.env.OPEN_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: '未配置 OPEN_API_KEY',
        },
        { status: 400 }
      );
    }

    console.log('🔄 创建 Embeddings 实例...');
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPEN_API_KEY,
      configuration: {
        baseURL: process.env.OPEN_API_BASE_URL,
      },
    });

    console.log('🚀 测试向量化单个文本...');
    const startTime = Date.now();

    // 设置超时
    const embeddingPromise = embeddings.embedQuery(testText);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('请求超时（15秒）')), 15000)
    );

    const vector = await Promise.race([embeddingPromise, timeoutPromise]);
    const endTime = Date.now();

    console.log('✅ 向量化成功！');
    console.log('📊 向量维度:', Array.isArray(vector) ? vector.length : '未知');
    console.log('⏱️ 耗时:', endTime - startTime, 'ms');

    return NextResponse.json({
      success: true,
      message: '向量化测试成功',
      vectorDimension: Array.isArray(vector) ? vector.length : 0,
      responseTime: endTime - startTime,
      testText,
    });
  } catch (error) {
    console.error('❌ 测试失败:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        details: error instanceof Error ? error.stack : '无详细信息',
      },
      { status: 500 }
    );
  }
}
