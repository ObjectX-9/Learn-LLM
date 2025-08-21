'use client';

import TestPageLayout from '@/components/TestPageLayout';
import PromptTestBase from '@/components/PromptTestBase';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PenTool, BookOpen, Newspaper, Mail } from 'lucide-react';

const TEXT_GENERATION_TEMPLATES = [
  {
    id: 'story-writing',
    name: '故事创作',
    prompt:
      '请写一个关于{主题}的短故事，大约300字。要求有完整的情节，包含开头、发展、高潮和结尾。',
    systemMessage: '你是一个富有创意的故事作家，擅长创作引人入胜的故事。',
    responseFormat: 'markdown',
    description: '创作富有想象力的故事',
  },
  {
    id: 'article-writing',
    name: '文章写作',
    prompt:
      '请写一篇关于{主题}的文章，大约500字。要求观点明确，逻辑清晰，有理有据。',
    systemMessage: '你是一个专业的文章作者，能够写出高质量的内容。',
    responseFormat: 'markdown',
    description: '撰写专业的文章内容',
  },
  {
    id: 'blog-post',
    name: '博客文章',
    prompt:
      '请写一篇关于{主题}的博客文章，要求轻松易读，有个人观点，适合网络阅读。',
    systemMessage: '你是一个经验丰富的博客作者，文风轻松幽默。',
    responseFormat: 'markdown',
    description: '创作适合网络的博客内容',
  },
  {
    id: 'product-description',
    name: '产品描述',
    prompt: '为{产品名称}写一个吸引人的产品描述，突出其特点和优势。',
    systemMessage: '你是一个营销文案专家，擅长写出有说服力的产品描述。',
    responseFormat: 'text',
    description: '撰写营销产品描述',
  },
  {
    id: 'email-template',
    name: '邮件模板',
    prompt: '写一封关于{主题}的邮件，要求专业、礼貌、简洁明了。',
    systemMessage: '你是一个商务沟通专家，擅长撰写各类商务邮件。',
    responseFormat: 'text',
    description: '创建专业邮件模板',
  },
  {
    id: 'social-media',
    name: '社交媒体',
    prompt: '为{主题}写一条社交媒体文案，要求简洁有趣，容易传播。',
    systemMessage: '你是一个社交媒体运营专家，了解如何创作吸引人的内容。',
    responseFormat: 'text',
    description: '创作社交媒体文案',
  },
];

export default function TextGenerationPage() {
  return (
    <TestPageLayout
      title="文本生成测试"
      description="测试各种文本生成场景，包括故事创作、文章写作、营销文案等"
    >
      <PromptTestBase
        testType="text-generation"
        title="文本生成测试"
        description="使用AI生成各种类型的文本内容"
        templates={TEXT_GENERATION_TEMPLATES}
        defaultResponseFormat="markdown"
      >
        {/* 文本生成特有的说明和提示 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-blue-200 bg-blue-50/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <PenTool className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-base">创意写作</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                故事、小说、诗歌等创意内容生成
              </p>
              <Badge variant="secondary" className="mt-2">
                推荐温度: 0.8-1.2
              </Badge>
            </CardContent>
          </Card>

          <Card className="border-green-200 bg-green-50/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-green-600" />
                <CardTitle className="text-base">专业写作</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                技术文档、学术论文、报告等
              </p>
              <Badge variant="secondary" className="mt-2">
                推荐温度: 0.3-0.7
              </Badge>
            </CardContent>
          </Card>

          <Card className="border-purple-200 bg-purple-50/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Newspaper className="h-5 w-5 text-purple-600" />
                <CardTitle className="text-base">新闻资讯</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                新闻稿、资讯文章、公告等
              </p>
              <Badge variant="secondary" className="mt-2">
                推荐温度: 0.4-0.6
              </Badge>
            </CardContent>
          </Card>

          <Card className="border-orange-200 bg-orange-50/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-orange-600" />
                <CardTitle className="text-base">营销文案</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                广告文案、产品描述、邮件等
              </p>
              <Badge variant="secondary" className="mt-2">
                推荐温度: 0.6-0.9
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* 使用提示 */}
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-lg">💡 使用提示</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-medium mb-2">提高创意性：</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• 使用较高的温度值 (0.8-1.2)</li>
                  <li>• 在prompt中加入"创新"、"独特"等词汇</li>
                  <li>• 提供多个参考元素让AI组合</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">提高准确性：</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• 使用较低的温度值 (0.3-0.6)</li>
                  <li>• 提供明确的格式要求</li>
                  <li>• 在系统消息中强调专业性</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </PromptTestBase>
    </TestPageLayout>
  );
}
