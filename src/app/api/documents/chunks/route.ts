import { NextRequest, NextResponse } from 'next/server';

// 这里应该与process/route.ts共享存储，实际项目中建议使用数据库
// 为了简化，我们创建一个简单的存储获取函数
let processedDocuments: Map<string, any> = new Map();

export async function POST(request: NextRequest) {
  try {
    const { documentId } = await request.json();

    if (!documentId) {
      return NextResponse.json({ error: '缺少文档ID' }, { status: 400 });
    }

    // 由于这是演示，我们返回模拟的文档块
    // 实际项目中这里会从数据库或文件系统获取
    const mockChunks = [
      {
        id: 'chunk_1',
        content: '这是第一个文档片段的内容。包含了文档开头的重要信息...',
        metadata: {
          chunkIndex: 0,
          chunkLength: 89,
          pageNumber: 1,
        },
      },
      {
        id: 'chunk_2',
        content: '这是第二个文档片段的内容。继续描述文档的主要内容和细节...',
        metadata: {
          chunkIndex: 1,
          chunkLength: 92,
          pageNumber: 1,
        },
      },
      {
        id: 'chunk_3',
        content: '这是第三个文档片段的内容。包含了文档的结论和总结部分...',
        metadata: {
          chunkIndex: 2,
          chunkLength: 88,
          pageNumber: 2,
        },
      },
    ];

    return NextResponse.json(mockChunks);
  } catch (error) {
    console.error('❌ 获取文档块失败:', error);

    return NextResponse.json(
      {
        error: '获取文档块失败',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
