module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // 类型枚举，支持中英文
    'type-enum': [
      2,
      'always',
      [
        'feat', // 新功能
        'fix', // 修复bug
        'docs', // 文档更新
        'style', // 代码格式（不影响代码运行的变动）
        'refactor', // 重构（既不是新增功能，也不是修改bug的代码变动）
        'perf', // 性能优化
        'test', // 增加测试
        'chore', // 构建过程或辅助工具的变动
        'revert', // 回滚
        'build', // 构建系统或外部依赖项的更改
        'ci', // CI配置文件和脚本的更改
        'wip', // 开发中
        '功能', // 中文：新功能
        '修复', // 中文：修复bug
        '文档', // 中文：文档更新
        '样式', // 中文：样式调整
        '重构', // 中文：重构
        '优化', // 中文：性能优化
        '测试', // 中文：测试
        '构建', // 中文：构建
        '配置', // 中文：配置更改
      ],
    ],
    // 主题不能为空
    'subject-empty': [2, 'never'],
    // 主题长度限制
    'subject-max-length': [2, 'always', 100],
    // 主题不能以句号结尾
    'subject-full-stop': [2, 'never', '.'],
    // 主题格式（允许中英文）
    'subject-case': [0], // 禁用默认的大小写规则
    // 类型不能为空
    'type-empty': [2, 'never'],
    // 类型必须小写（对中文不适用）
    'type-case': [0], // 禁用默认的大小写规则
    // header最大长度
    'header-max-length': [2, 'always', 120],
  },
  // 自定义提示信息
  prompt: {
    messages: {
      type: '选择你要提交的类型:',
      scope: '选择一个提交范围（可选）:',
      customScope: '请输入自定义的提交范围:',
      subject: '填写简短精炼的变更描述:',
      body: '填写更加详细的变更描述（可选）。使用 "|" 换行:',
      breaking: '列举非兼容性重大的变更（可选）。使用 "|" 换行:',
      footerPrefixesSelect: '选择关联issue前缀（可选）:',
      customFooterPrefix: '输入自定义issue前缀:',
      footer: '列举关联issue（可选）例如: #31, #I3244:',
      confirmCommit: '是否提交或修改commit?',
    },
    types: [
      { value: 'feat', name: 'feat:     ✨ 新功能' },
      { value: 'fix', name: 'fix:      🐛 修复bug' },
      { value: 'docs', name: 'docs:     📝 文档更新' },
      { value: 'style', name: 'style:    💄 代码格式（不影响功能）' },
      { value: 'refactor', name: 'refactor: ♻️  重构（非新增功能或修复bug）' },
      { value: 'perf', name: 'perf:     ⚡ 性能优化' },
      { value: 'test', name: 'test:     ✅ 增加测试' },
      { value: 'build', name: 'build:    📦 构建系统或依赖项更改' },
      { value: 'ci', name: 'ci:       🎡 CI配置文件和脚本更改' },
      { value: 'chore', name: 'chore:    🔧 其他更改（不修改src或test文件）' },
      { value: 'revert', name: 'revert:   ⏪ 回滚之前的提交' },
      { value: 'wip', name: 'wip:      🚧 开发中' },
    ],
    useEmoji: true,
    emojiAlign: 'center',
    allowCustomScopes: true,
    allowEmptyScopes: true,
    customScopesAlign: 'bottom',
    customScopesAlias: 'custom',
    emptyScopesAlias: 'empty',
    upperCaseSubject: false,
    allowBreakingChanges: ['feat', 'fix'],
    breaklineNumber: 100,
    breaklineChar: '|',
    skipQuestions: [],
    issuePrefixes: [
      { value: 'closed', name: 'closed:   ISSUES has been processed' },
    ],
    customIssuePrefixAlign: 'top',
    emptyIssuePrefixAlias: 'skip',
    customIssuePrefixAlias: 'custom',
    allowCustomIssuePrefix: true,
    allowEmptyIssuePrefix: true,
    confirmColorize: true,
    maxHeaderLength: Infinity,
    maxSubjectLength: Infinity,
    minSubjectLength: 0,
    scopeOverrides: undefined,
    defaultBody: '',
    defaultIssues: '',
    defaultScope: '',
    defaultSubject: '',
  },
};
