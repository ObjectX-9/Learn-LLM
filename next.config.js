/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // 解决LangChain在浏览器端的兼容性问题
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
};

module.exports = nextConfig;
