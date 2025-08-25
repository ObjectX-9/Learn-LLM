import { NextRequest, NextResponse } from 'next/server';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';

// 生成简单的ID
const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

export async function POST(request: NextRequest) {
  console.log('📨 收到文档重新处理请求');

  try {
    const { documentId, options } = await request.json();

    if (!documentId) {
      return NextResponse.json({ error: '缺少文档ID' }, { status: 400 });
    }

    console.log('🔄 重新处理文档ID:', documentId);
    console.log('⚙️ 新的处理选项:', options);

    const startTime = Date.now();

    // 模拟重新处理过程
    const { chunkSize, chunkOverlap } = options;

    // 创建新的分割器
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: chunkSize || 1000,
      chunkOverlap: chunkOverlap || 200,
      separators: ['\n\n', '\n', ' ', ''],
    });

    // 模拟文档内容（实际项目中从存储中获取）
    const mockContent = `这是一个示例文档内容，用于演示重新处理功能。
    
    文档重新处理允许用户调整分块参数，比如分块大小、重叠字符数等，
    来优化文档的分割效果。
    
    不同的参数设置会产生不同的分块结果，用户可以根据具体需求进行调整。
    
    这个功能在处理大型文档或需要精细控制文档分割时特别有用。`;

    // 创建文档对象
    const document = {
      pageContent: mockContent,
      metadata: {
        source: `reprocessed_${documentId}`,
        type: 'text',
        reprocessed: true,
        originalId: documentId,
      },
    };

    // 重新分割文档
    const chunks = await splitter.splitDocuments([document]);

    // 为每个片段添加ID和索引
    const chunksWithIds = chunks.map((chunk, index) => ({
      id: generateId(),
      content: chunk.pageContent,
      metadata: {
        ...chunk.metadata,
        chunkIndex: index,
        chunkLength: chunk.pageContent.length,
      },
    }));

    const processTime = Date.now() - startTime;

    console.log('✅ 文档重新处理完成，共', chunks.length, '个片段');

    return NextResponse.json({
      documentId,
      chunks: chunksWithIds,
      processTime,
      reprocessedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ 文档重新处理失败:', error);

    return NextResponse.json(
      {
        error: '文档重新处理失败',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
