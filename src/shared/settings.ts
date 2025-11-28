export interface AppSettings {
  profileName: string;
  awsRegion: string;
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  bedrockModel: string;
  aiEnabled: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  profileName: 'Default Profile',
  awsRegion: 'us-east-1',
  awsAccessKeyId: '',
  awsSecretAccessKey: '',
  bedrockModel: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
  aiEnabled: false
};

export const AVAILABLE_MODELS = [
  {
    id: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
    name: 'Claude Sonnet 4.5'
  },
  {
    id: 'global.anthropic.claude-opus-4-5-20251101-v1:0',
    name: 'Claude Opus 4.5'
  }
];

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

