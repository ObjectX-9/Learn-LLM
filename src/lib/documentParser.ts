/**
 * 文档解析工具
 * 支持多种文档格式的解析和文本提取
 */

export interface ParsedDocument {
  content: string;
  filename: string;
  fileType: string;
}

/**
 * 解析文本文件
 */
export async function parseTextFile(file: File): Promise<ParsedDocument> {
  const content = await file.text();
  return {
    content,
    filename: file.name,
    fileType: getFileExtension(file.name),
  };
}

/**
 * 解析文档文件
 */
export async function parseDocument(file: File): Promise<ParsedDocument> {
  const fileType = getFileExtension(file.name);

  switch (fileType) {
    case 'txt':
    case 'md':
    case 'mdx':
      return parseTextFile(file);

    case 'pdf':
      // PDF解析需要额外的库，这里提供基础实现
      throw new Error('PDF解析功能需要配置pdf-parse库');

    case 'docx':
      // DOCX解析需要额外的库
      throw new Error('DOCX解析功能需要配置mammoth库');

    default:
      // 尝试作为文本文件解析
      return parseTextFile(file);
  }
}

/**
 * 获取文件扩展名
 */
function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

/**
 * 验证文件类型
 */
export function isValidFileType(filename: string): boolean {
  const allowedTypes = ['txt', 'md', 'mdx', 'pdf', 'docx'];
  const fileType = getFileExtension(filename);
  return allowedTypes.includes(fileType);
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 预处理文档内容
 */
export function preprocessContent(content: string, filename: string): string {
  // 移除过多的空白字符
  let processed = content.replace(/\n\s*\n\s*\n/g, '\n\n');

  // 移除行首行尾空白
  processed = processed
    .split('\n')
    .map((line) => line.trim())
    .join('\n');

  // 如果是Markdown文件，可以做一些特殊处理
  if (filename.endsWith('.md') || filename.endsWith('.mdx')) {
    // 移除Markdown标记但保留结构
    processed = processed
      .replace(/^#{1,6}\s+/gm, '') // 移除标题标记
      .replace(/\*\*(.*?)\*\*/g, '$1') // 移除粗体标记
      .replace(/\*(.*?)\*/g, '$1') // 移除斜体标记
      .replace(/`(.*?)`/g, '$1'); // 移除行内代码标记
  }

  return processed;
}
