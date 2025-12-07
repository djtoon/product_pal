export type AIProvider = 'bedrock' | 'openai';

export interface AppSettings {
  profileName: string;
  // Provider selection
  aiProvider: AIProvider;
  aiEnabled: boolean;
  // AWS Bedrock settings
  awsRegion: string;
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  bedrockModel: string;
  // OpenAI settings
  openaiApiKey: string;
  openaiModel: string;
  openaiBaseUrl?: string; // For OpenAI-compatible endpoints
}

export const DEFAULT_SETTINGS: AppSettings = {
  profileName: 'Default Profile',
  aiProvider: 'bedrock',
  aiEnabled: false,
  // Bedrock defaults
  awsRegion: 'us-east-1',
  awsAccessKeyId: '',
  awsSecretAccessKey: '',
  bedrockModel: 'global.anthropic.claude-opus-4-5-20251101-v1:0',
  // OpenAI defaults
  openaiApiKey: '',
  openaiModel: 'gpt-5.1',
  openaiBaseUrl: '',
};

export const BEDROCK_MODELS = [
  {
    id: 'global.anthropic.claude-opus-4-5-20251101-v1:0',
    name: 'Claude Opus 4.5'
  }
];

export const OPENAI_MODELS = [
  {
    id: 'gpt-5.1',
    name: 'GPT-5.1'
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o'
  }
];

// Keep for backwards compatibility
export const AVAILABLE_MODELS = BEDROCK_MODELS;

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}
