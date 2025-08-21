'use client';

import TestPageLayout from '@/components/TestPageLayout';
import PromptTestBase from '@/components/PromptTestBase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Code, Database, Globe, Smartphone, Terminal, Cpu } from 'lucide-react';

const CODE_GENERATION_TEMPLATES = [
  {
    id: 'function-creation',
    name: '函数生成',
    prompt:
      '请用{编程语言}编写一个函数来实现：{功能描述}\n\n要求：\n- 包含完整的函数定义\n- 添加详细注释\n- 包含使用示例',
    systemMessage: '你是一个经验丰富的程序员，能够编写高质量、可维护的代码。',
    responseFormat: 'code',
    description: '生成特定功能的函数',
  },
  {
    id: 'algorithm-implementation',
    name: '算法实现',
    prompt:
      '请用{编程语言}实现{算法名称}算法，包含：\n- 完整的算法实现\n- 时间和空间复杂度分析\n- 测试用例',
    systemMessage: '你是一个算法专家，精通各种数据结构和算法。',
    responseFormat: 'code',
    description: '实现经典算法',
  },
  {
    id: 'api-development',
    name: 'API开发',
    prompt:
      '请用{框架}创建一个{API功能}的RESTful API，包含：\n- 路由定义\n- 请求处理逻辑\n- 错误处理\n- API文档',
    systemMessage: '你是一个后端开发专家，熟悉API设计最佳实践。',
    responseFormat: 'code',
    description: '创建RESTful API',
  },
  {
    id: 'frontend-component',
    name: '前端组件',
    prompt:
      '请用{前端框架}创建一个{组件功能}组件，包含：\n- 组件结构\n- 样式定义\n- 交互逻辑\n- 使用示例',
    systemMessage: '你是一个前端开发专家，熟悉现代前端框架和最佳实践。',
    responseFormat: 'code',
    description: '创建前端UI组件',
  },
  {
    id: 'database-query',
    name: '数据库查询',
    prompt:
      '请编写SQL查询来实现：{查询需求}\n\n数据表结构：{表结构}\n\n要求：\n- 优化查询性能\n- 添加注释说明\n- 考虑索引使用',
    systemMessage: '你是一个数据库专家，精通SQL优化和数据库设计。',
    responseFormat: 'code',
    description: '编写SQL查询语句',
  },
  {
    id: 'debug-fix',
    name: '代码调试',
    prompt:
      '以下代码存在问题：\n```\n{有问题的代码}\n```\n\n请：\n- 找出问题所在\n- 提供修复方案\n- 解释问题原因',
    systemMessage: '你是一个代码调试专家，能够快速定位和修复代码问题。',
    responseFormat: 'code',
    description: '调试和修复代码',
  },
];

export default function CodeGenerationPage() {
  return (
    <TestPageLayout
      title="代码生成测试"
      description="测试AI生成各种编程语言的代码，包括函数、算法、API等"
    >
      <PromptTestBase
        testType="code-generation"
        title="代码生成测试"
        description="使用AI生成高质量的程序代码"
        templates={CODE_GENERATION_TEMPLATES}
        defaultResponseFormat="code"
      >
        {/* 编程语言和场景 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="border-blue-200 bg-blue-50/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-base">Web开发</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                JavaScript, TypeScript, React, Vue
              </p>
              <Badge variant="secondary" className="mt-2">
                推荐温度: 0.3-0.5
              </Badge>
            </CardContent>
          </Card>

          <Card className="border-green-200 bg-green-50/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Terminal className="h-5 w-5 text-green-600" />
                <CardTitle className="text-base">后端开发</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Python, Java, Go, Node.js
              </p>
              <Badge variant="secondary" className="mt-2">
                推荐温度: 0.2-0.4
              </Badge>
            </CardContent>
          </Card>

          <Card className="border-purple-200 bg-purple-50/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-purple-600" />
                <CardTitle className="text-base">移动开发</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Swift, Kotlin, Flutter, React Native
              </p>
              <Badge variant="secondary" className="mt-2">
                推荐温度: 0.3-0.5
              </Badge>
            </CardContent>
          </Card>

          <Card className="border-orange-200 bg-orange-50/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-orange-600" />
                <CardTitle className="text-base">数据处理</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                SQL, Python, R, Scala
              </p>
              <Badge variant="secondary" className="mt-2">
                推荐温度: 0.2-0.4
              </Badge>
            </CardContent>
          </Card>

          <Card className="border-red-200 bg-red-50/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Cpu className="h-5 w-5 text-red-600" />
                <CardTitle className="text-base">系统编程</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                C, C++, Rust, Assembly
              </p>
              <Badge variant="secondary" className="mt-2">
                推荐温度: 0.1-0.3
              </Badge>
            </CardContent>
          </Card>

          <Card className="border-indigo-200 bg-indigo-50/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Code className="h-5 w-5 text-indigo-600" />
                <CardTitle className="text-base">算法竞赛</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">C++, Python, Java</p>
              <Badge variant="secondary" className="mt-2">
                推荐温度: 0.2-0.4
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* 代码质量提升建议 */}
        <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200">
          <CardHeader>
            <CardTitle className="text-lg">🚀 代码质量提升建议</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div>
                <h4 className="font-medium mb-3 text-emerald-800">
                  提高代码质量：
                </h4>
                <ul className="space-y-2 text-muted-foreground">
                  <li>• 要求添加详细注释和文档</li>
                  <li>• 指定编码规范和风格</li>
                  <li>• 要求错误处理和边界情况</li>
                  <li>• 包含单元测试示例</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-3 text-emerald-800">
                  提高准确性：
                </h4>
                <ul className="space-y-2 text-muted-foreground">
                  <li>• 提供清晰的需求描述</li>
                  <li>• 指定技术栈和版本</li>
                  <li>• 给出输入输出示例</li>
                  <li>• 使用较低的温度值</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 最佳实践提示 */}
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader>
            <CardTitle className="text-lg">💡 最佳实践</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div>
                <h4 className="font-medium mb-2">Prompt 编写技巧：</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• 明确指定编程语言和版本</li>
                  <li>• 描述具体的功能需求</li>
                  <li>• 提供输入输出示例</li>
                  <li>• 要求代码注释和文档</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">代码审查要点：</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• 检查语法正确性</li>
                  <li>• 验证逻辑完整性</li>
                  <li>• 确认性能优化</li>
                  <li>• 测试边界条件</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </PromptTestBase>
    </TestPageLayout>
  );
}
