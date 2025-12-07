// Type declarations for @strands-agents/sdk/openai subpath export
declare module '@strands-agents/sdk/openai' {
  export interface OpenAIModelConfig {
    modelId?: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    params?: Record<string, unknown>;
  }

  export interface OpenAIModelOptions extends OpenAIModelConfig {
    apiKey?: string;
    client?: any;
    clientConfig?: {
      baseURL?: string;
      [key: string]: any;
    };
  }

  export class OpenAIModel {
    constructor(options?: OpenAIModelOptions);
    updateConfig(modelConfig: OpenAIModelConfig): void;
    getConfig(): OpenAIModelConfig;
    stream(messages: any[], options?: any): AsyncIterable<any>;
  }
}

