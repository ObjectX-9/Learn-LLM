import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calculator, CheckCircle, AlertTriangle } from 'lucide-react';

interface MathExplanationProps {
  attempts: Array<{
    id: number;
    answer: string;
    confidence: number;
  }>;
}

export default function MathExplanation({ attempts }: MathExplanationProps) {
  // 正确的计算过程
  const correctCalculation = {
    radius: 50, // 游乐场半径
    pathWidth: 2, // 小径宽度
    pi: 3.14,

    originalArea: 3.14 * 50 * 50, // π × r²
    newRadius: 50 + 2, // 新半径 = 原半径 + 小径宽度
    newArea: 3.14 * 52 * 52, // π × (r+w)²
    pathArea: 3.14 * 52 * 52 - 3.14 * 50 * 50, // 小径面积
  };

  const correctAnswer = correctCalculation.pathArea;

  // 分析AI答案的准确性
  const analyzeAnswer = (answer: string) => {
    const numbers = answer.match(/\d+\.?\d*/g);
    if (!numbers) return { type: 'error', message: '无法提取数值' };

    const value = parseFloat(numbers[0]);
    const diff = Math.abs(value - correctAnswer);
    const diffPercent = (diff / correctAnswer) * 100;

    if (diffPercent < 5) {
      return { type: 'correct', message: '计算正确' };
    } else if (diffPercent < 20) {
      return { type: 'close', message: '计算接近正确' };
    } else {
      return { type: 'wrong', message: '计算错误' };
    }
  };

  return (
    <Card className="border-blue-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-700">
          <Calculator className="h-5 w-5" />
          数学验证：圆形游乐场小径面积计算
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 问题分析 */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">问题分析</h4>
          <div className="bg-blue-50 rounded-lg p-3 text-sm">
            <p>
              <strong>已知条件：</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>游乐场是圆形，半径 = 50米</li>
              <li>小径宽度 = 2米（在游乐场周围）</li>
              <li>π = 3.14</li>
            </ul>
            <p className="mt-2">
              <strong>求解：</strong>小径的面积
            </p>
          </div>
        </div>

        {/* 正确计算过程 */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">正确计算过程</h4>
          <div className="bg-green-50 rounded-lg p-3 space-y-2 text-sm">
            <div className="font-medium text-green-800">
              方法：大圆面积 - 小圆面积
            </div>

            <div className="space-y-1">
              <p>
                <strong>步骤1：</strong>计算原游乐场面积
              </p>
              <p className="ml-4 font-mono">
                S₁ = π × r² = 3.14 × 50² = 3.14 × 2500 ={' '}
                {correctCalculation.originalArea.toLocaleString()}平方米
              </p>
            </div>

            <div className="space-y-1">
              <p>
                <strong>步骤2：</strong>计算加上小径后的总面积
              </p>
              <p className="ml-4">新半径 = 50 + 2 = 52米</p>
              <p className="ml-4 font-mono">
                S₂ = π × (r+w)² = 3.14 × 52² = 3.14 × 2704 ={' '}
                {correctCalculation.newArea.toLocaleString()}平方米
              </p>
            </div>

            <div className="space-y-1">
              <p>
                <strong>步骤3：</strong>计算小径面积
              </p>
              <p className="ml-4 font-mono">
                小径面积 = S₂ - S₁ ={' '}
                {correctCalculation.newArea.toLocaleString()} -{' '}
                {correctCalculation.originalArea.toLocaleString()} ={' '}
                <span className="bg-green-200 px-1 rounded font-bold">
                  {correctAnswer.toLocaleString()}平方米
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* AI答案分析 */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">AI推理结果分析</h4>
          <div className="space-y-2">
            {attempts.map((attempt) => {
              const analysis = analyzeAnswer(attempt.answer);
              const Icon =
                analysis.type === 'correct' ? CheckCircle : AlertTriangle;
              const colorClass =
                analysis.type === 'correct'
                  ? 'text-green-600'
                  : analysis.type === 'close'
                    ? 'text-yellow-600'
                    : 'text-red-600';
              const bgClass =
                analysis.type === 'correct'
                  ? 'bg-green-50 border-green-200'
                  : analysis.type === 'close'
                    ? 'bg-yellow-50 border-yellow-200'
                    : 'bg-red-50 border-red-200';

              return (
                <div
                  key={attempt.id}
                  className={`p-3 rounded border ${bgClass}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      推理{attempt.id}: {attempt.answer}
                    </span>
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${colorClass}`} />
                      <Badge variant="outline" className={colorClass}>
                        {analysis.message}
                      </Badge>
                    </div>
                  </div>
                  {analysis.type !== 'correct' && (
                    <div className="text-xs text-gray-600 mt-1">
                      可能的错误原因：计算步骤错误、公式使用不当、或数值计算失误
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 为什么会出现不同结果 */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">
            为什么AI会产生不同的计算结果？
          </h4>
          <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-2">
            <div>
              <strong>1. 推理路径差异：</strong>AI可能选择不同的计算方法或公式
            </div>
            <div>
              <strong>2. 计算步骤错误：</strong>
              在多步计算中可能出现中间步骤的错误
            </div>
            <div>
              <strong>3. 数值精度问题：</strong>对π值的处理或小数点精度的差异
            </div>
            <div>
              <strong>4. 理解偏差：</strong>
              对"周围"的理解可能不同（内侧vs外侧vs环形）
            </div>
            <div>
              <strong>5. 随机性影响：</strong>
              不同的温度设置导致推理过程的随机变化
            </div>
          </div>
        </div>

        {/* 改进建议 */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">如何提高AI数学计算的准确性？</h4>
          <div className="bg-blue-50 rounded-lg p-3 text-sm space-y-1">
            <div>• 降低温度参数，减少随机性</div>
            <div>• 要求AI显示完整的计算步骤</div>
            <div>• 使用更具体的问题描述</div>
            <div>• 要求AI进行结果验证</div>
            <div>• 多次推理后选择一致性最高的答案</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
