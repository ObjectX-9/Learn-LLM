// 这是一个测试文件，用于验证commit时的lint和类型检查
const testFunction = (name: string): string => {
  return `Hello, ${name}!`;
};

// 故意添加一些格式问题来测试prettier
const badlyFormatted = { a: 1, b: 2 };

console.log(badlyFormatted); // 使用变量避免unused-vars警告

export default testFunction;
