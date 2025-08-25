import { NextRequest, NextResponse } from 'next/server';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { TokenTextSplitter } from 'langchain/text_splitter';
import { MarkdownTextSplitter } from 'langchain/text_splitter';
import { CharacterTextSplitter } from 'langchain/text_splitter';
import { TextLoader } from 'langchain/document_loaders/fs/text';
import { CSVLoader } from '@langchain/community/document_loaders/fs/csv';
import { JSONLoader } from 'langchain/document_loaders/fs/json';
import { Document } from '@langchain/core/documents';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// 内存存储已处理的文档
let processedDocuments: Map<string, any> = new Map();

// 生成简单的ID
const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// 创建临时文件
const createTempFile = async (file: File): Promise<string> => {
  const tempDir = os.tmpdir();
  const tempFilePath = path.join(
    tempDir,
    `langchain_${generateId()}_${file.name}`
  );
  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(tempFilePath, buffer);
  return tempFilePath;
};

// 清理临时文件
const cleanupTempFile = (filePath: string) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.warn('清理临时文件失败:', error);
  }
};

// 动态导入可选的加载器
const loadOptionalLoader = async (loaderName: string, modulePath: string) => {
  try {
    const importedModule = await import(modulePath);
    return importedModule[loaderName];
  } catch (error) {
    console.warn(`加载器 ${loaderName} 不可用:`, error);
    return null;
  }
};

// 使用真正的 LangChain 文档加载器
const loadDocumentWithLangChain = async (
  file: File,
  loaderType: string
): Promise<Document[]> => {
  const tempFilePath = await createTempFile(file);

  try {
    let docs: Document[] = [];

    switch (loaderType) {
      case 'text':
        const textLoader = new TextLoader(tempFilePath);
        docs = await textLoader.load();
        break;

      case 'pdf':
        try {
          // 动态加载 PDFLoader
          const PDFLoader = await loadOptionalLoader(
            'PDFLoader',
            '@langchain/community/document_loaders/fs/pdf'
          );
          if (PDFLoader) {
            const pdfLoader = new PDFLoader(tempFilePath, {
              splitPages: false, // 我们稍后用分割器来分割
            });
            docs = await pdfLoader.load();
          } else {
            throw new Error('PDFLoader 不可用，请安装 pdf-parse 依赖');
          }
        } catch (error) {
          console.warn('PDF 加载失败，使用文本模式:', error);
          // 降级到文本加载器
          const fallbackContent = `[PDF 文档 - ${file.name}]\n\n这是一个 PDF 文档。由于缺少 pdf-parse 依赖或其他问题，无法提取实际内容。\n\n要正确处理 PDF 文档，请确保已安装 pdf-parse 包：\nnpm install pdf-parse\n\n文件大小: ${file.size} 字节`;
          docs = [
            new Document({
              pageContent: fallbackContent,
              metadata: {
                source: file.name,
                loader: 'FallbackTextLoader',
                type: 'pdf',
                fallback: true,
                originalError:
                  error instanceof Error ? error.message : '未知错误',
              },
            }),
          ];
        }
        break;

      case 'docx':
        try {
          // 动态加载 DocxLoader
          const DocxLoader = await loadOptionalLoader(
            'DocxLoader',
            '@langchain/community/document_loaders/fs/docx'
          );
          if (DocxLoader) {
            const docxLoader = new DocxLoader(tempFilePath);
            docs = await docxLoader.load();
          } else {
            throw new Error('DocxLoader 不可用，请安装 mammoth 依赖');
          }
        } catch (error) {
          console.warn('DOCX 加载失败，使用文本模式:', error);
          // 降级到文本加载器
          const fallbackContent = `[Word 文档 - ${file.name}]\n\n这是一个 Word 文档。由于缺少 mammoth 依赖或其他问题，无法提取实际内容。\n\n要正确处理 Word 文档，请确保已安装 mammoth 包：\nnpm install mammoth\n\n文件大小: ${file.size} 字节`;
          docs = [
            new Document({
              pageContent: fallbackContent,
              metadata: {
                source: file.name,
                loader: 'FallbackTextLoader',
                type: 'docx',
                fallback: true,
                originalError:
                  error instanceof Error ? error.message : '未知错误',
              },
            }),
          ];
        }
        break;

      case 'csv':
        const csvLoader = new CSVLoader(tempFilePath);
        docs = await csvLoader.load();
        break;

      case 'json':
        const jsonLoader = new JSONLoader(tempFilePath);
        docs = await jsonLoader.load();
        break;

      case 'html':
        try {
          // 动态加载 CheerioWebBaseLoader
          const CheerioWebBaseLoader = await loadOptionalLoader(
            'CheerioWebBaseLoader',
            '@langchain/community/document_loaders/web/cheerio'
          );
          if (CheerioWebBaseLoader) {
            // 对于HTML，我们需要先保存为文件，然后读取内容
            const htmlContent = fs.readFileSync(tempFilePath, 'utf-8');
            const cheerioLoader = new CheerioWebBaseLoader(
              `data:text/html,${encodeURIComponent(htmlContent)}`
            );
            docs = await cheerioLoader.load();
          } else {
            // 降级：简单的HTML文本提取
            const htmlContent = fs.readFileSync(tempFilePath, 'utf-8');
            const cleanText = htmlContent
              .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
              .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();

            docs = [
              new Document({
                pageContent: cleanText,
                metadata: {
                  source: file.name,
                  loader: 'SimpleHTMLExtractor',
                  type: 'html',
                  fallback: true,
                  original_length: htmlContent.length,
                  extracted_length: cleanText.length,
                },
              }),
            ];
          }
        } catch (error) {
          console.warn('HTML 加载失败:', error);
          throw error;
        }
        break;

      case 'markdown':
        // Markdown 使用 TextLoader 加载，然后用 MarkdownTextSplitter 分割
        const markdownLoader = new TextLoader(tempFilePath);
        docs = await markdownLoader.load();
        // 为 markdown 文档添加特殊标记
        docs.forEach((doc) => {
          doc.metadata.type = 'markdown';
          doc.metadata.loader = 'TextLoader + MarkdownTextSplitter';
        });
        break;

      default:
        // 默认使用 TextLoader
        const defaultLoader = new TextLoader(tempFilePath);
        docs = await defaultLoader.load();
    }

    // 确保所有文档都有基本的元数据
    docs.forEach((doc) => {
      doc.metadata = {
        ...doc.metadata,
        source: file.name,
        originalName: file.name,
        fileSize: file.size,
        loaderType: loaderType,
        loadedAt: new Date().toISOString(),
      };
    });

    return docs;
  } finally {
    // 清理临时文件
    cleanupTempFile(tempFilePath);
  }
};

// 获取文件扩展名
const getFileExtension = (filename: string): string => {
  return filename.split('.').pop()?.toLowerCase() || '';
};

// 自动选择加载器
const selectLoader = (filename: string, loaderType: string) => {
  if (loaderType !== 'auto') {
    return loaderType;
  }

  const ext = getFileExtension(filename);
  switch (ext) {
    case 'pdf':
      return 'pdf';
    case 'docx':
    case 'doc':
      return 'docx';
    case 'csv':
      return 'csv';
    case 'json':
      return 'json';
    case 'html':
    case 'htm':
      return 'html';
    case 'md':
    case 'markdown':
      return 'markdown';
    case 'txt':
    default:
      return 'text';
  }
};

// 创建文档分割器 - 使用 LangChain 的分割器
const createSplitter = (splitterType: string, options: any) => {
  const { chunkSize, chunkOverlap, separators } = options;

  switch (splitterType) {
    case 'token':
      return new TokenTextSplitter({
        chunkSize: chunkSize || 1000,
        chunkOverlap: chunkOverlap || 200,
      });

    case 'character':
      return new CharacterTextSplitter({
        chunkSize: chunkSize || 1000,
        chunkOverlap: chunkOverlap || 200,
        separator: separators?.[0] || '\n\n',
      });

    case 'markdown':
      return new MarkdownTextSplitter({
        chunkSize: chunkSize || 1000,
        chunkOverlap: chunkOverlap || 200,
      });

    case 'recursive':
    default:
      return new RecursiveCharacterTextSplitter({
        chunkSize: chunkSize || 1000,
        chunkOverlap: chunkOverlap || 200,
        separators: separators || ['\n\n', '\n', ' ', ''],
      });
  }
};

export async function POST(request: NextRequest) {
  console.log('📨 收到 LangChain 文档处理请求');

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const loaderType = formData.get('loader') as string;
    const optionsStr = formData.get('options') as string;

    if (!file) {
      return NextResponse.json({ error: '未提供文件' }, { status: 400 });
    }

    console.log('📄 处理文件:', file.name, '大小:', file.size);

    const options = JSON.parse(optionsStr || '{}');
    const selectedLoaderType = selectLoader(file.name, loaderType);
    const splitterType = options.splitterType || 'recursive';

    console.log('🔧 使用 LangChain 加载器:', selectedLoaderType);
    console.log('✂️ 使用 LangChain 分割器:', splitterType);

    const startTime = Date.now();

    // 使用真正的 LangChain 加载器加载文档
    console.log('📚 开始使用 LangChain 加载器加载文档...');
    const documents = await loadDocumentWithLangChain(file, selectedLoaderType);

    console.log('✅ LangChain 文档加载完成，共', documents.length, '个文档');
    documents.forEach((doc, index) => {
      console.log(`📄 文档 ${index + 1}:`, {
        contentLength: doc.pageContent.length,
        metadata: doc.metadata,
      });
    });

    // 使用选定的分割器分割文档
    console.log('🧩 开始使用 LangChain 分割器分割文档...');
    const splitter = createSplitter(splitterType, options);
    const chunks = await splitter.splitDocuments(documents);

    console.log('🧩 LangChain 文档分割完成，共', chunks.length, '个片段');

    // 为每个片段添加ID和索引
    const chunksWithIds = chunks.map((chunk, index) => ({
      id: generateId(),
      content: chunk.pageContent,
      metadata: {
        ...chunk.metadata,
        chunkIndex: index,
        chunkLength: chunk.pageContent.length,
        splitter: splitterType,
        splitterClass: splitter.constructor.name,
      },
    }));

    const processTime = Date.now() - startTime;
    const documentId = generateId();

    // 合并所有文档内容作为预览
    const combinedContent = documents
      .map((doc) => doc.pageContent)
      .join('\n\n');

    // 检查是否有降级处理
    const hasFallback = documents.some((doc) => doc.metadata.fallback);
    const loaderClass = documents[0]?.metadata.loader || 'Unknown';

    // 存储处理结果
    const processedDoc = {
      id: documentId,
      filename: file.name,
      documentType: selectedLoaderType,
      splitterType: splitterType,
      documents: documents, // 保存原始 LangChain 文档
      content: combinedContent,
      metadata: documents[0]?.metadata || {},
      chunks: chunksWithIds,
      processTime,
      createdAt: new Date().toISOString(),
    };

    processedDocuments.set(documentId, processedDoc);

    console.log('💾 LangChain 文档处理完成，ID:', documentId);

    return NextResponse.json({
      id: documentId,
      documentType: selectedLoaderType,
      splitterType: splitterType,
      loaderClass: loaderClass,
      splitterClass: splitter.constructor.name,
      documentCount: documents.length,
      content: combinedContent.substring(0, 1000), // 返回前1000字符作为预览
      metadata: documents[0]?.metadata || {},
      chunks: chunksWithIds,
      processTime,
      totalContentLength: combinedContent.length,
      hasFallback: hasFallback,
      warnings: hasFallback ? ['某些加载器使用了降级处理'] : [],
    });
  } catch (error) {
    console.error('❌ LangChain 文档处理失败:', error);

    return NextResponse.json(
      {
        error: 'LangChain 文档处理失败',
        details: error instanceof Error ? error.message : '未知错误',
        stack:
          process.env.NODE_ENV === 'development'
            ? error instanceof Error
              ? error.stack
              : undefined
            : undefined,
      },
      { status: 500 }
    );
  }
}

// 获取文档块的API
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get('id');

  if (!documentId) {
    return NextResponse.json({ error: '缺少文档ID' }, { status: 400 });
  }

  const document = processedDocuments.get(documentId);
  if (!document) {
    return NextResponse.json({ error: '文档不存在' }, { status: 404 });
  }

  return NextResponse.json({
    chunks: document.chunks,
    originalDocuments: document.documents.map((doc: Document) => ({
      content:
        doc.pageContent.substring(0, 500) +
        (doc.pageContent.length > 500 ? '...' : ''),
      metadata: doc.metadata,
    })),
  });
}
