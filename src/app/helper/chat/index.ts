import 'dotenv/config';
import { ChatOpenAI } from '@langchain/openai';

// 创建 ChatOpenAI 实例，并指定自定义 fetch
const chat = new ChatOpenAI({
  openAIApiKey: process.env.OPEN_API_KEY,
  modelName: 'gpt-3.5-turbo',
  temperature: 0.7,
  configuration: {
    baseURL: process.env.OPEN_API_BASE_URL,
  },
  verbose: true,
});

export default chat;
