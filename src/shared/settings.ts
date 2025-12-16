export type AIProvider = 'bedrock' | 'openai' | 'ollama';

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
  // Ollama settings (local LLM)
  ollamaModel: string;
  ollamaBaseUrl: string;
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
  // Ollama defaults
  ollamaModel: 'qwen3:4b',
  ollamaBaseUrl: 'http://localhost:11434',
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

// All models that support tool calling with download sizes
// Organized by: Recommended → By Family
export const OLLAMA_MODELS = [
  // === RECOMMENDED ===
  { id: 'qwen3:8b', name: '⭐ Qwen 3 8B (recommended)', size: '5.2 GB' },
  { id: 'llama3.1:8b', name: '⭐ Llama 3.1 8B (recommended)', size: '4.9 GB' },
  
  // === QWEN FAMILY ===
  { id: 'qwen3:1.7b', name: 'Qwen 3 1.7B (fast, light)', size: '1.1 GB' },
  { id: 'qwen3:4b', name: 'Qwen 3 4B (balanced)', size: '2.6 GB' },
  { id: 'qwen3:14b', name: 'Qwen 3 14B (high quality)', size: '9.0 GB' },
  { id: 'qwen3:32b', name: 'Qwen 3 32B (best Qwen)', size: '20 GB' },
  { id: 'qwen2.5:3b', name: 'Qwen 2.5 3B', size: '1.9 GB' },
  { id: 'qwen2.5:7b', name: 'Qwen 2.5 7B', size: '4.7 GB' },
  { id: 'qwen2.5:14b', name: 'Qwen 2.5 14B', size: '9.0 GB' },
  { id: 'qwen2.5:32b', name: 'Qwen 2.5 32B', size: '20 GB' },
  
  // === LLAMA FAMILY ===
  { id: 'llama3.1:8b', name: 'Llama 3.1 8B', size: '4.9 GB' },
  { id: 'llama3.1:70b', name: 'Llama 3.1 70B (large)', size: '43 GB' },
  { id: 'llama3.2:1b', name: 'Llama 3.2 1B (tiny)', size: '1.3 GB' },
  { id: 'llama3.2:3b', name: 'Llama 3.2 3B', size: '2.0 GB' },
  { id: 'llama3.3:70b', name: 'Llama 3.3 70B (latest)', size: '43 GB' },
  
  // === MISTRAL FAMILY ===
  { id: 'mistral:7b', name: 'Mistral 7B', size: '4.1 GB' },
  { id: 'mixtral:8x7b', name: 'Mixtral 8x7B (MoE)', size: '26 GB' },
  { id: 'mixtral:8x22b', name: 'Mixtral 8x22B (large MoE)', size: '80 GB' },
  
  // === OTHER TOOL-CAPABLE ===
  { id: 'command-r:35b', name: 'Command R 35B (Cohere)', size: '20 GB' },
  { id: 'command-r-plus:104b', name: 'Command R+ 104B', size: '63 GB' },
  { id: 'granite3-dense:8b', name: 'Granite 3 Dense 8B (IBM)', size: '4.9 GB' },
  { id: 'nemotron-mini:4b', name: 'Nemotron Mini 4B (NVIDIA)', size: '2.7 GB' },
  { id: 'smollm2:1.7b', name: 'SmolLM2 1.7B (fast)', size: '1.0 GB' },
  { id: 'hermes3:8b', name: 'Hermes 3 8B', size: '4.9 GB' },
  { id: 'firefunction-v2:70b', name: 'FireFunction v2 70B', size: '43 GB' },
];

// Minimum recommended model for reliable tool calling
export const OLLAMA_MIN_TOOL_MODEL = 'qwen3:4b';

// Keep for backwards compatibility
export const AVAILABLE_MODELS = BEDROCK_MODELS;

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}
