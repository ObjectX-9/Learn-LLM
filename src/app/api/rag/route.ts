import { NextRequest, NextResponse } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';
import { Document } from '@langchain/core/documents';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIEmbeddings } from '@langchain/openai';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';

// 内存向量存储实例（生产环境建议使用持久化存储）
let vectorStore: MemoryVectorStore | null = null;

// 初始化模型和嵌入
const initializeModels = () => {
  console.log('🔧 初始化模型和嵌入...');
  console.log('API Key:', process.env.OPEN_API_KEY ? '已配置' : '❌ 未配置');
  console.log('Base URL:', process.env.OPEN_API_BASE_URL || '使用默认URL');

  if (!process.env.OPEN_API_KEY) {
    throw new Error('❌ 请在 .env.local 中配置 OPEN_API_KEY');
  }

  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPEN_API_KEY,
    configuration: {
      baseURL: process.env.OPEN_API_BASE_URL,
    },
  });

  const llm = new ChatOpenAI({
    openAIApiKey: process.env.OPEN_API_KEY,
    modelName: 'gpt-3.5-turbo',
    temperature: 0.1,
    configuration: {
      baseURL: process.env.OPEN_API_BASE_URL,
    },
  });

  console.log('✅ 模型初始化完成');
  return { embeddings, llm };
};

// 文档分块
const splitDocuments = async (
  text: string,
  metadata: Record<string, any> = {}
) => {
  console.log('📄 开始文档分块，文本长度:', text.length);

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 2000, // 增加分块大小，减少分块数量
    chunkOverlap: 100, // 减少重叠，进一步减少分块数量
  });

  const docs = await splitter.createDocuments([text], [metadata]);
  console.log('✅ 文档分块完成，共', docs.length, '个片段');

  // 如果分块太多，限制数量以避免API调用超时
  if (docs.length > 10) {
    console.log('⚠️ 分块数量较多，限制为前10个片段');
    return docs.slice(0, 10);
  }

  return docs;
};

// RAG提示模板
const createRAGPrompt = () => {
  const template = `你是一个基于提供文档的智能助手。请根据以下相关文档内容回答用户的问题。

相关文档:
{context}

用户问题: {question}

请注意:
1. 仅基于提供的文档内容回答问题
2. 如果文档中没有相关信息，请明确说明
3. 回答要准确、详细且有帮助
4. 可以引用文档中的具体内容

回答:`;

  return PromptTemplate.fromTemplate(template);
};

// 处理文档上传和向量化
export async function POST(request: NextRequest) {
  console.log('📨 收到RAG API请求');

  try {
    const body = await request.json();
    const { action, content, filename, question } = body;
    console.log('🔍 请求操作:', action);

    if (action === 'upload') {
      console.log('📁 处理文档上传:', filename);

      // 处理文档上传
      if (!content || !filename) {
        console.log('❌ 文档内容或文件名为空');
        return NextResponse.json(
          { error: '文档内容和文件名不能为空' },
          { status: 400 }
        );
      }

      console.log('🔧 初始化模型...');
      const { embeddings } = initializeModels();

      console.log('📄 开始文档分块...');
      // 创建文档并分块
      const documents = await splitDocuments(content, { filename });

      console.log('🔮 开始向量化存储...');
      if (!vectorStore) {
        console.log('🆕 创建新的向量存储');
        try {
          // 添加超时处理的向量存储创建
          console.log('🔄 正在调用 OpenAI Embeddings API...');

          // 创建新的向量存储，添加超时控制
          const vectorStorePromise = MemoryVectorStore.fromDocuments(
            documents,
            embeddings
          );

          // 设置30秒超时
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(
              () =>
                reject(
                  new Error('向量化超时（30秒），请检查网络连接和API配置')
                ),
              30000
            )
          );

          vectorStore = (await Promise.race([
            vectorStorePromise,
            timeoutPromise,
          ])) as MemoryVectorStore;
          console.log('✅ 向量存储创建完成');
        } catch (embeddingError) {
          console.error('❌ 向量化失败:', embeddingError);
          throw new Error(
            `向量化过程失败: ${embeddingError instanceof Error ? embeddingError.message : '未知错误'}`
          );
        }
      } else {
        console.log('➕ 添加到现有向量存储');
        try {
          console.log('🔄 正在向量化新文档...');

          // 为现有向量存储添加文档也加上超时控制
          const addDocsPromise = vectorStore.addDocuments(documents);
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('添加文档超时（30秒）')), 30000)
          );

          await Promise.race([addDocsPromise, timeoutPromise]);
          console.log('✅ 文档添加完成');
        } catch (addError) {
          console.error('❌ 添加文档失败:', addError);
          throw new Error(
            `添加文档失败: ${addError instanceof Error ? addError.message : '未知错误'}`
          );
        }
      }

      console.log('🎉 文档上传和向量化成功');
      return NextResponse.json({
        message: '文档上传并向量化成功',
        filename,
        chunks: documents.length,
      });
    }

    if (action === 'query') {
      console.log('❓ 处理问答查询:', question);

      // 处理问答查询
      if (!question) {
        console.log('❌ 问题为空');
        return NextResponse.json({ error: '问题不能为空' }, { status: 400 });
      }

      if (!vectorStore) {
        console.log('❌ 向量存储不存在');
        return NextResponse.json({ error: '请先上传文档' }, { status: 400 });
      }

      console.log('🔧 初始化LLM...');
      const { llm } = initializeModels();

      console.log('🔍 开始检索相关文档...');
      // 检索相关文档
      const relevantDocs = await vectorStore.similaritySearch(question, 4);
      console.log('✅ 检索到', relevantDocs.length, '个相关文档');

      if (relevantDocs.length === 0) {
        console.log('⚠️ 未找到相关文档');
        return NextResponse.json({
          answer: '抱歉，我在已上传的文档中没有找到与您问题相关的信息。',
          sources: [],
        });
      }

      // 构建上下文
      const context = relevantDocs
        .map(
          (doc) => `文档: ${doc.metadata.filename}\n内容: ${doc.pageContent}`
        )
        .join('\n\n');

      console.log('🤖 开始生成回答...');
      // 创建RAG链
      const prompt = createRAGPrompt();
      const chain = RunnableSequence.from([
        {
          context: () => context,
          question: (input: { question: string }) => input.question,
        },
        prompt,
        llm,
      ]);

      // 生成回答
      const result = await chain.invoke({ question });
      console.log('✅ 回答生成完成');

      return NextResponse.json({
        answer: result.content,
        sources: relevantDocs.map((doc) => ({
          filename: doc.metadata.filename,
          content: doc.pageContent.substring(0, 200) + '...',
        })),
      });
    }

    if (action === 'getStoredDocuments') {
      console.log('📋 获取存储的文档内容');
      // 获取存储的文档内容
      if (!vectorStore) {
        return NextResponse.json({
          documents: [],
          message: '向量数据库为空',
        });
      }

      try {
        // 通过搜索获取所有存储的文档片段
        const allDocs = await vectorStore.similaritySearch('', 100); // 获取最多100个片段

        const documentsInfo = allDocs.map((doc, index) => ({
          id: index + 1,
          filename: doc.metadata.filename || '未知文件',
          content: doc.pageContent,
          contentLength: doc.pageContent.length,
          metadata: doc.metadata,
        }));

        // 按文件名分组统计
        const fileStats = documentsInfo.reduce(
          (stats, doc) => {
            const filename = doc.filename;
            if (!stats[filename]) {
              stats[filename] = {
                filename,
                chunkCount: 0,
                totalLength: 0,
                chunks: [],
              };
            }
            stats[filename].chunkCount++;
            stats[filename].totalLength += doc.contentLength;
            stats[filename].chunks.push({
              id: doc.id,
              content:
                doc.content.substring(0, 200) +
                (doc.content.length > 200 ? '...' : ''),
              fullContent: doc.content,
              length: doc.contentLength,
            });
            return stats;
          },
          {} as Record<string, any>
        );

        return NextResponse.json({
          totalChunks: documentsInfo.length,
          files: Object.values(fileStats),
          allChunks: documentsInfo,
        });
      } catch (error) {
        console.error('❌ 获取存储内容失败:', error);
        return NextResponse.json(
          { error: '获取存储内容失败' },
          { status: 500 }
        );
      }
    }

    if (action === 'status') {
      console.log('📊 查询向量数据库状态');
      // 获取向量数据库状态
      const documentsCount = vectorStore ? await getDocumentsCount() : 0;
      return NextResponse.json({
        hasDocuments: !!vectorStore,
        documentsCount,
      });
    }

    if (action === 'clear') {
      console.log('🗑️ 清空向量数据库');
      // 清空向量数据库
      vectorStore = null;
      return NextResponse.json({ message: '向量数据库已清空' });
    }

    console.log('❌ 无效的操作类型:', action);
    return NextResponse.json({ error: '无效的操作类型' }, { status: 400 });
  } catch (error) {
    console.error('❌ RAG API Error:', error);
    console.error(
      '错误堆栈:',
      error instanceof Error ? error.stack : '未知错误'
    );

    return NextResponse.json(
      {
        error: '处理请求时发生错误',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

// 获取文档数量的辅助函数
async function getDocumentsCount(): Promise<number> {
  if (!vectorStore) return 0;
  try {
    // 通过搜索获取所有文档的近似数量
    const allDocs = await vectorStore.similaritySearch('', 1000);
    return allDocs.length;
  } catch {
    return 0;
  }
}
