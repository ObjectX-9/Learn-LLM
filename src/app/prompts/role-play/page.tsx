'use client';

import TestPageLayout from '@/components/TestPageLayout';
import PromptTestBase from '@/components/PromptTestBase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Headphones,
  GraduationCap,
  Stethoscope,
  Scale,
  ChefHat,
} from 'lucide-react';

const ROLE_PLAY_TEMPLATES = [
  {
    id: 'customer-service',
    name: '客服代表',
    prompt: '客户问题：{问题内容}',
    systemMessage:
      '你是一位专业、友善的客服代表。请耐心解答客户问题，提供有帮助的解决方案，保持礼貌和专业的态度。',
    responseFormat: 'text',
    description: '专业客服角色扮演',
  },
  {
    id: 'teacher',
    name: '教师',
    prompt: '学生问题：{问题内容}',
    systemMessage:
      '你是一位经验丰富的教师，善于用简单易懂的方式解释复杂概念。请耐心教导，鼓励学生思考。',
    responseFormat: 'text',
    description: '教师角色扮演',
  },
  {
    id: 'doctor',
    name: '医生',
    prompt: '患者描述：{症状描述}',
    systemMessage:
      '你是一位专业的医生。请注意：你只能提供一般性健康信息，不能进行具体诊断，建议患者咨询专业医生。',
    responseFormat: 'text',
    description: '医生角色扮演（仅供参考）',
  },
  {
    id: 'lawyer',
    name: '律师',
    prompt: '法律咨询：{法律问题}',
    systemMessage:
      '你是一位专业律师。请提供一般性法律信息，但强调具体案件需要咨询当地执业律师。',
    responseFormat: 'text',
    description: '律师角色扮演',
  },
  {
    id: 'chef',
    name: '厨师',
    prompt: '烹饪需求：{菜品或需求}',
    systemMessage:
      '你是一位经验丰富的厨师，熟悉各种菜系。请提供详细的烹饪建议、食谱和技巧。',
    responseFormat: 'text',
    description: '厨师角色扮演',
  },
  {
    id: 'therapist',
    name: '心理咨询师',
    prompt: '情况描述：{心理状况}',
    systemMessage:
      '你是一位专业的心理咨询师，善于倾听和提供情感支持。请注意保持专业界限，严重情况建议寻求专业帮助。',
    responseFormat: 'text',
    description: '心理咨询师角色扮演',
  },
];

export default function RolePlayPage() {
  return (
    <TestPageLayout
      title="角色扮演测试"
      description="测试AI扮演不同专业角色，提供相应的专业建议和服务"
    >
      <PromptTestBase
        testType="role-play"
        title="角色扮演测试"
        description="让AI扮演不同的专业角色进行对话"
        templates={ROLE_PLAY_TEMPLATES}
        defaultResponseFormat="text"
      >
        {/* 角色类型说明 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="border-blue-200 bg-blue-50/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Headphones className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-base">客服服务</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                客服代表、技术支持、售后服务
              </p>
              <Badge variant="secondary" className="mt-2">
                推荐温度: 0.3-0.5
              </Badge>
            </CardContent>
          </Card>

          <Card className="border-green-200 bg-green-50/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-green-600" />
                <CardTitle className="text-base">教育培训</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                教师、导师、培训师、学术顾问
              </p>
              <Badge variant="secondary" className="mt-2">
                推荐温度: 0.4-0.6
              </Badge>
            </CardContent>
          </Card>

          <Card className="border-red-200 bg-red-50/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-red-600" />
                <CardTitle className="text-base">医疗健康</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                医生、营养师、健身教练
              </p>
              <Badge variant="secondary" className="mt-2">
                推荐温度: 0.2-0.4
              </Badge>
            </CardContent>
          </Card>

          <Card className="border-purple-200 bg-purple-50/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-purple-600" />
                <CardTitle className="text-base">法律咨询</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                律师、法律顾问、合规专家
              </p>
              <Badge variant="secondary" className="mt-2">
                推荐温度: 0.2-0.4
              </Badge>
            </CardContent>
          </Card>

          <Card className="border-orange-200 bg-orange-50/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <ChefHat className="h-5 w-5 text-orange-600" />
                <CardTitle className="text-base">生活服务</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                厨师、设计师、理财顾问
              </p>
              <Badge variant="secondary" className="mt-2">
                推荐温度: 0.5-0.7
              </Badge>
            </CardContent>
          </Card>

          <Card className="border-pink-200 bg-pink-50/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-pink-600" />
                <CardTitle className="text-base">心理支持</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                心理咨询师、生活教练
              </p>
              <Badge variant="secondary" className="mt-2">
                推荐温度: 0.6-0.8
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* 角色扮演要点 */}
        <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
          <CardHeader>
            <CardTitle className="text-lg">🎭 角色扮演要点</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div>
                <h4 className="font-medium mb-3 text-purple-800">
                  提高真实性：
                </h4>
                <ul className="space-y-2 text-muted-foreground">
                  <li>• 详细描述角色背景和经验</li>
                  <li>• 使用专业术语和表达方式</li>
                  <li>• 体现角色的性格特点</li>
                  <li>• 保持角色一致性</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-3 text-purple-800">注意事项：</h4>
                <ul className="space-y-2 text-muted-foreground">
                  <li>• 明确专业界限和责任</li>
                  <li>• 避免提供具体医疗/法律建议</li>
                  <li>• 鼓励寻求专业帮助</li>
                  <li>• 保持道德和伦理标准</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </PromptTestBase>
    </TestPageLayout>
  );
}
