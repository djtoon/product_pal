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
  bedrockModel: 'us.anthropic.claude-sonnet-4-20250514-v1:0',
  // OpenAI defaults
  openaiApiKey: '',
  openaiModel: 'gpt-4o',
  openaiBaseUrl: '',
};

export const BEDROCK_MODELS = [
  {
    id: 'us.anthropic.claude-sonnet-4-20250514-v1:0',
    name: 'Claude Sonnet 4'
  },
  {
    id: 'us.anthropic.claude-opus-4-20250514-v1:0',
    name: 'Claude Opus 4'
  }
];

export const OPENAI_MODELS = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o'
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini'
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo'
  },
  {
    id: 'o1',
    name: 'o1'
  },
  {
    id: 'o1-mini',
    name: 'o1 Mini'
  },
  {
    id: 'o3',
    name: 'o3'
  },
  {
    id: 'o3-mini',
    name: 'o3 Mini'
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
