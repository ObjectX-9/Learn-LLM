'use client';

import TestPageLayout from '@/components/TestPageLayout';
import PromptTestBase from '@/components/PromptTestBase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Languages,
  Globe,
  BookOpen,
  Briefcase,
  MessageCircle,
  FileText,
} from 'lucide-react';

const TRANSLATION_TEMPLATES = [
  {
    id: 'cn-to-en',
    name: '中译英',
    prompt: '请将以下中文翻译成英文，要求翻译准确、地道：\n\n{中文文本}',
    systemMessage: '你是一个专业的中英翻译专家，精通两种语言的文化背景。',
    responseFormat: 'text',
    description: '中文翻译为英文',
  },
  {
    id: 'en-to-cn',
    name: '英译中',
    prompt: '请将以下英文翻译成中文，要求翻译准确、流畅：\n\n{英文文本}',
    systemMessage: '你是一个专业的英中翻译专家，能够准确传达原文意思。',
    responseFormat: 'text',
    description: '英文翻译为中文',
  },
  {
    id: 'technical-translation',
    name: '技术文档翻译',
    prompt: '请翻译以下技术文档，保持专业术语的准确性：\n\n{技术文档}',
    systemMessage: '你是一个技术翻译专家，熟悉各种技术术语和行业标准。',
    responseFormat: 'text',
    description: '专业技术文档翻译',
  },
  {
    id: 'business-translation',
    name: '商务翻译',
    prompt: '请翻译以下商务文档，保持正式和专业的语调：\n\n{商务文档}',
    systemMessage: '你是一个商务翻译专家，了解商务礼仪和专业表达。',
    responseFormat: 'text',
    description: '商务文档翻译',
  },
  {
    id: 'literary-translation',
    name: '文学翻译',
    prompt: '请翻译以下文学作品片段，保持原文的文学性和美感：\n\n{文学文本}',
    systemMessage: '你是一个文学翻译大师，能够传达原文的艺术美感和深层含义。',
    responseFormat: 'text',
    description: '文学作品翻译',
  },
  {
    id: 'casual-translation',
    name: '日常对话翻译',
    prompt: '请翻译以下日常对话，使用自然、口语化的表达：\n\n{对话内容}',
    systemMessage: '你是一个口语翻译专家，擅长日常对话的自然翻译。',
    responseFormat: 'text',
    description: '日常对话翻译',
  },
];

export default function TranslationPage() {
  return (
    <TestPageLayout
      title="翻译测试"
      description="测试各种翻译场景，支持不同语言对和翻译风格"
    >
      <PromptTestBase
        testType="translation"
        title="翻译测试"
        description="使用AI进行高质量的多语言翻译"
        templates={TRANSLATION_TEMPLATES}
        defaultResponseFormat="text"
      >
        {/* 翻译特有的功能说明 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="border-blue-200 bg-blue-50/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-base">通用翻译</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                日常文本、新闻、网页内容翻译
              </p>
              <Badge variant="secondary" className="mt-2">
                推荐温度: 0.3-0.5
              </Badge>
            </CardContent>
          </Card>

          <Card className="border-green-200 bg-green-50/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-green-600" />
                <CardTitle className="text-base">商务翻译</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                合同、邮件、报告等商务文档
              </p>
              <Badge variant="secondary" className="mt-2">
                推荐温度: 0.2-0.4
              </Badge>
            </CardContent>
          </Card>

          <Card className="border-purple-200 bg-purple-50/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-purple-600" />
                <CardTitle className="text-base">文学翻译</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                小说、诗歌、散文等文学作品
              </p>
              <Badge variant="secondary" className="mt-2">
                推荐温度: 0.6-0.8
              </Badge>
            </CardContent>
          </Card>

          <Card className="border-orange-200 bg-orange-50/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-orange-600" />
                <CardTitle className="text-base">技术翻译</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                技术文档、API文档、说明书
              </p>
              <Badge variant="secondary" className="mt-2">
                推荐温度: 0.1-0.3
              </Badge>
            </CardContent>
          </Card>

          <Card className="border-pink-200 bg-pink-50/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-pink-600" />
                <CardTitle className="text-base">口语翻译</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                对话、聊天、口语化表达
              </p>
              <Badge variant="secondary" className="mt-2">
                推荐温度: 0.4-0.6
              </Badge>
            </CardContent>
          </Card>

          <Card className="border-indigo-200 bg-indigo-50/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Languages className="h-5 w-5 text-indigo-600" />
                <CardTitle className="text-base">多语言</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                支持中、英、日、韩等多种语言
              </p>
              <Badge variant="secondary" className="mt-2">
                推荐温度: 0.3-0.5
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* 翻译质量提升建议 */}
        <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
          <CardHeader>
            <CardTitle className="text-lg">🎯 翻译质量提升建议</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div>
                <h4 className="font-medium mb-3 text-green-800">
                  提高准确性：
                </h4>
                <ul className="space-y-2 text-muted-foreground">
                  <li>• 提供上下文背景信息</li>
                  <li>• 指明文本类型和目标读者</li>
                  <li>• 标注专业术语和特殊表达</li>
                  <li>• 使用较低的温度值</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-3 text-green-800">
                  提高自然度：
                </h4>
                <ul className="space-y-2 text-muted-foreground">
                  <li>• 要求符合目标语言习惯</li>
                  <li>• 考虑文化差异和本土化</li>
                  <li>• 保持原文的语调和风格</li>
                  <li>• 适当调整温度值</li>
                </ul>
              </div>
            </div>

            <div className="mt-4 p-4 bg-white/70 rounded-lg">
              <h4 className="font-medium mb-2 text-green-800">
                常用语言代码：
              </h4>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">中文 (zh)</Badge>
                <Badge variant="outline">英文 (en)</Badge>
                <Badge variant="outline">日文 (ja)</Badge>
                <Badge variant="outline">韩文 (ko)</Badge>
                <Badge variant="outline">法文 (fr)</Badge>
                <Badge variant="outline">德文 (de)</Badge>
                <Badge variant="outline">西班牙文 (es)</Badge>
                <Badge variant="outline">俄文 (ru)</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 示例用法 */}
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader>
            <CardTitle className="text-lg">📝 示例用法</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-lg border">
                <h4 className="font-medium mb-2">技术文档翻译示例：</h4>
                <p className="text-sm text-muted-foreground">
                  &ldquo;请将以下API文档从英文翻译为中文，保持技术术语的准确性，并确保中文表达符合技术文档的规范：
                  <br />
                  [原文内容]&rdquo;
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg border">
                <h4 className="font-medium mb-2">商务邮件翻译示例：</h4>
                <p className="text-sm text-muted-foreground">
                  &ldquo;请将以下商务邮件翻译为英文，保持正式和礼貌的语调，符合国际商务沟通标准：
                  <br />
                  [邮件内容]&rdquo;
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </PromptTestBase>
    </TestPageLayout>
  );
}
