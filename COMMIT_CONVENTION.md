# Git Commit 规范

## 🎯 概述

本项目使用 [Conventional Commits](https://conventionalcommits.org/) 规范来标准化 commit 信息，并通过 commitlint 进行自动检查。

## 📝 Commit 格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### 必填字段
- **type**: 提交类型
- **subject**: 简短描述（不超过100个字符）

### 可选字段
- **scope**: 影响范围
- **body**: 详细描述
- **footer**: 关联issue或破坏性更改说明

## 🏷️ 提交类型

| 类型 | 描述 | 示例 |
|------|------|------|
| `feat` | ✨ 新功能 | `feat: 添加用户登录功能` |
| `fix` | 🐛 修复bug | `fix: 修复登录页面样式问题` |
| `docs` | 📝 文档更新 | `docs: 更新API文档` |
| `style` | 💄 代码格式 | `style: 修复代码缩进` |
| `refactor` | ♻️ 重构 | `refactor: 优化用户服务代码结构` |
| `perf` | ⚡ 性能优化 | `perf: 优化数据库查询性能` |
| `test` | ✅ 测试 | `test: 添加用户模块单元测试` |
| `build` | 📦 构建 | `build: 升级webpack到5.0` |
| `ci` | 🎡 CI配置 | `ci: 添加GitHub Actions工作流` |
| `chore` | 🔧 其他更改 | `chore: 更新依赖包版本` |
| `revert` | ⏪ 回滚 | `revert: 回滚用户登录功能` |
| `wip` | 🚧 开发中 | `wip: 用户管理功能开发中` |

## 🚀 使用方式

### 方式一：交互式提交（推荐）

```bash
# 使用交互式提交工具，会引导你填写规范的commit信息
pnpm run commit

# 如果上次提交失败，可以重试
pnpm run commit:retry
```

### 方式二：手动编写

```bash
# 直接使用git commit，需要遵循规范格式
git commit -m "feat: 添加新功能"
```

## ✅ 示例

### 好的示例
```bash
feat: 添加用户注册功能
fix: 修复密码验证逻辑错误
docs: 更新README安装说明
style: 统一代码缩进格式
refactor: 重构用户认证模块
perf: 优化图片加载性能
test: 添加登录功能测试用例
chore: 升级React到18版本
```

### 带scope的示例
```bash
feat(auth): 添加JWT认证
fix(ui): 修复按钮样式问题
docs(api): 更新接口文档
```

### 带body和footer的示例
```bash
feat: 添加用户权限管理

实现了基于角色的访问控制系统，支持以下功能：
- 角色创建和管理
- 权限分配
- 用户角色绑定

Closes #123
```

## ❌ 常见错误

```bash
# ❌ 错误：缺少类型
git commit -m "添加新功能"

# ❌ 错误：类型不规范  
git commit -m "add: 添加新功能"

# ❌ 错误：主题为空
git commit -m "feat:"

# ❌ 错误：主题以句号结尾
git commit -m "feat: 添加新功能."

# ❌ 错误：主题过长
git commit -m "feat: 这是一个非常非常非常非常非常非常非常非常非常非常长的提交信息，超过了规定的长度限制"
```

## 🔧 自动检查

项目已配置以下自动检查：

1. **pre-commit hook**: 提交前自动运行代码检查和格式化
2. **commit-msg hook**: 验证commit信息格式
3. **lint-staged**: 只对暂存文件运行检查

如果commit信息不符合规范，提交将被阻止，直到修复问题。

## 🎨 自定义配置

如需修改commit规范，请编辑 `commitlint.config.js` 文件。 