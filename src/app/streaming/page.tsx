'use client';

import TestPageLayout from '@/components/TestPageLayout';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import {
  Radio,
  Wifi,
  Download,
  RefreshCw,
  Users,
  Clock,
  Zap,
  Network,
  Globe,
  ArrowRight,
} from 'lucide-react';

// 流式技术配置
const streamingMethods = [
  {
    id: 'sse',
    name: 'Server-Sent Events',
    description: 'HTML5标准的服务端推送技术，适合单向实时数据流',
    icon: Radio,
    difficulty: '简单',
    realtime: '高',
    features: ['自动重连', '事件类型', '文本数据', '单向推送'],
    useCase: 'AI流式输出、实时通知、股票价格',
    pros: ['实现简单', '浏览器原生支持', '自动重连'],
    cons: ['只支持文本', '单向通信', '连接数限制'],
    color: 'bg-blue-500',
  },
  {
    id: 'websocket',
    name: 'WebSocket',
    description: '全双工通信协议，提供真正的双向实时通信',
    icon: Wifi,
    difficulty: '中等',
    realtime: '极高',
    features: ['双向通信', '二进制支持', '低延迟', '自定义协议'],
    useCase: '聊天应用、在线游戏、协作编辑',
    pros: ['双向通信', '极低延迟', '支持二进制'],
    cons: ['实现复杂', '需要心跳保活', 'API Gateway支持差'],
    color: 'bg-green-500',
  },
  {
    id: 'chunked',
    name: 'Chunked Transfer',
    description: 'HTTP分块传输编码，用于流式传输大量数据',
    icon: Download,
    difficulty: '简单',
    realtime: '中',
    features: ['HTTP标准', '大文件支持', '流式解析', '无缓冲'],
    useCase: '文件下载、数据导出、视频流',
    pros: ['标准HTTP', '支持大文件', '无需特殊协议'],
    cons: ['单向传输', '无重连机制', '不适合交互'],
    color: 'bg-purple-500',
  },
  {
    id: 'long-polling',
    name: 'Long Polling',
    description: '长轮询技术，通过延长HTTP请求时间模拟实时推送',
    icon: RefreshCw,
    difficulty: '简单',
    realtime: '中',
    features: ['HTTP协议', '兼容性好', '简单实现', '支持复杂数据'],
    useCase: '轻量通知、状态更新、简单聊天',
    pros: ['实现简单', '兼容性好', '支持复杂数据'],
    cons: ['不是真实时', '资源消耗大', '延迟较高'],
    color: 'bg-orange-500',
  },
  {
    id: 'webrtc',
    name: 'WebRTC Data Channels',
    description: 'P2P数据通道，提供点对点的超低延迟通信',
    icon: Users,
    difficulty: '复杂',
    realtime: '极高',
    features: ['P2P直连', '加密传输', '超低延迟', 'NAT穿透'],
    useCase: 'P2P文件传输、音视频通话、实时游戏',
    pros: ['超低延迟', 'P2P直连', '加密安全'],
    cons: ['建立连接复杂', '需要信令服务器', '兼容性问题'],
    color: 'bg-red-500',
  },
];

const getDifficultyColor = (difficulty: string) => {
  switch (difficulty) {
    case '简单':
      return 'bg-green-100 text-green-800';
    case '中等':
      return 'bg-yellow-100 text-yellow-800';
    case '复杂':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getRealtimeColor = (realtime: string) => {
  switch (realtime) {
    case '极高':
      return 'bg-green-100 text-green-800';
    case '高':
      return 'bg-blue-100 text-blue-800';
    case '中':
      return 'bg-yellow-100 text-yellow-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export default function StreamingPage() {
  return (
    <TestPageLayout
      title="流式输出技术"
      description="探索不同的服务端到客户端流式数据传输技术"
    >
      <div className="p-6 space-y-6">
        {/* 技术介绍 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Network className="h-5 w-5 text-blue-600" />
              流式输出技术概览
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-700">
              流式输出技术让服务端能够实时向客户端推送数据，而不需要客户端不断轮询。
              不同的技术有各自的特点和适用场景，选择合适的技术能大大提升用户体验。
            </p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 border rounded-lg">
                <Clock className="h-6 w-6 text-blue-600 mb-2" />
                <h4 className="font-medium mb-1">实时性</h4>
                <p className="text-sm text-gray-600">低延迟的数据传输</p>
              </div>
              <div className="p-4 border rounded-lg">
                <Zap className="h-6 w-6 text-green-600 mb-2" />
                <h4 className="font-medium mb-1">性能优化</h4>
                <p className="text-sm text-gray-600">减少不必要的请求</p>
              </div>
              <div className="p-4 border rounded-lg">
                <Globe className="h-6 w-6 text-purple-600 mb-2" />
                <h4 className="font-medium mb-1">用户体验</h4>
                <p className="text-sm text-gray-600">流畅的交互体验</p>
              </div>
              <div className="p-4 border rounded-lg">
                <Network className="h-6 w-6 text-orange-600 mb-2" />
                <h4 className="font-medium mb-1">技术选择</h4>
                <p className="text-sm text-gray-600">适合的场景和技术栈</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 技术方法列表 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {streamingMethods.map((method) => {
            const Icon = method.icon;
            return (
              <Card
                key={method.id}
                className="hover:shadow-lg transition-shadow"
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg ${method.color} text-white`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{method.name}</CardTitle>
                        <CardDescription className="mt-1">
                          {method.description}
                        </CardDescription>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-3">
                    <Badge className={getDifficultyColor(method.difficulty)}>
                      难度: {method.difficulty}
                    </Badge>
                    <Badge className={getRealtimeColor(method.realtime)}>
                      实时性: {method.realtime}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* 特性 */}
                  <div>
                    <h4 className="font-medium text-sm mb-2">技术特性</h4>
                    <div className="flex flex-wrap gap-1">
                      {method.features.map((feature, index) => (
                        <Badge
                          key={index}
                          variant="secondary"
                          className="text-xs"
                        >
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* 适用场景 */}
                  <div>
                    <h4 className="font-medium text-sm mb-1">适用场景</h4>
                    <p className="text-sm text-gray-600">{method.useCase}</p>
                  </div>

                  {/* 优缺点 */}
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <h5 className="font-medium text-green-700 mb-1">优点</h5>
                      <ul className="space-y-1">
                        {method.pros.map((pro, index) => (
                          <li key={index} className="text-green-600">
                            • {pro}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h5 className="font-medium text-red-700 mb-1">缺点</h5>
                      <ul className="space-y-1">
                        {method.cons.map((con, index) => (
                          <li key={index} className="text-red-600">
                            • {con}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* 体验按钮 */}
                  <div className="pt-4">
                    <Link href={`/streaming/${method.id}`}>
                      <Button className="w-full" variant="outline">
                        体验 {method.name}
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* 技术对比表 */}
        <Card>
          <CardHeader>
            <CardTitle>技术对比表</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">技术</th>
                    <th className="text-left p-2">延迟</th>
                    <th className="text-left p-2">实现难度</th>
                    <th className="text-left p-2">浏览器支持</th>
                    <th className="text-left p-2">数据类型</th>
                    <th className="text-left p-2">连接方向</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="p-2 font-medium">Server-Sent Events</td>
                    <td className="p-2">
                      <Badge className="bg-yellow-100 text-yellow-800">
                        低
                      </Badge>
                    </td>
                    <td className="p-2">
                      <Badge className="bg-green-100 text-green-800">
                        简单
                      </Badge>
                    </td>
                    <td className="p-2">
                      <Badge className="bg-green-100 text-green-800">
                        优秀
                      </Badge>
                    </td>
                    <td className="p-2">文本</td>
                    <td className="p-2">单向</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2 font-medium">WebSocket</td>
                    <td className="p-2">
                      <Badge className="bg-green-100 text-green-800">
                        极低
                      </Badge>
                    </td>
                    <td className="p-2">
                      <Badge className="bg-yellow-100 text-yellow-800">
                        中等
                      </Badge>
                    </td>
                    <td className="p-2">
                      <Badge className="bg-green-100 text-green-800">
                        优秀
                      </Badge>
                    </td>
                    <td className="p-2">文本/二进制</td>
                    <td className="p-2">双向</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2 font-medium">Chunked Transfer</td>
                    <td className="p-2">
                      <Badge className="bg-yellow-100 text-yellow-800">
                        低
                      </Badge>
                    </td>
                    <td className="p-2">
                      <Badge className="bg-green-100 text-green-800">
                        简单
                      </Badge>
                    </td>
                    <td className="p-2">
                      <Badge className="bg-green-100 text-green-800">
                        优秀
                      </Badge>
                    </td>
                    <td className="p-2">文本/二进制</td>
                    <td className="p-2">单向</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2 font-medium">Long Polling</td>
                    <td className="p-2">
                      <Badge className="bg-orange-100 text-orange-800">
                        中
                      </Badge>
                    </td>
                    <td className="p-2">
                      <Badge className="bg-green-100 text-green-800">
                        简单
                      </Badge>
                    </td>
                    <td className="p-2">
                      <Badge className="bg-green-100 text-green-800">
                        优秀
                      </Badge>
                    </td>
                    <td className="p-2">JSON</td>
                    <td className="p-2">单向</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-medium">WebRTC</td>
                    <td className="p-2">
                      <Badge className="bg-green-100 text-green-800">
                        极低
                      </Badge>
                    </td>
                    <td className="p-2">
                      <Badge className="bg-red-100 text-red-800">复杂</Badge>
                    </td>
                    <td className="p-2">
                      <Badge className="bg-yellow-100 text-yellow-800">
                        良好
                      </Badge>
                    </td>
                    <td className="p-2">文本/二进制</td>
                    <td className="p-2">双向</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </TestPageLayout>
  );
}
