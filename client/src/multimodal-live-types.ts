import type {
  Content,
  FunctionCall,
  GenerationConfig,
  GenerativeContentBlob,
  Part,
  Tool,
} from "@google/generative-ai";

export interface StreamingLog {
  date: Date;
  type: string;
  message: any;
}

export type LiveConfig = {
  model: string;
  systemInstruction?: { parts: Part[] };
  generationConfig?: Partial<LiveGenerationConfig>;
  tools?: Array<Tool | { googleSearch: {} } | { codeExecution: {} }>;
};

export type LiveGenerationConfig = GenerationConfig & {
  responseModalities: "text" | "audio" | "image";
  speechConfig?: {
    voiceConfig?: {
      prebuiltVoiceConfig?: {
        voiceName: "Puck" | "Charon" | "Kore" | "Fenrir" | "Aoede" | string;
      };
    };
  };
};

export interface RealtimeInputMessage {
  realtimeInput: {
    mediaChunks: GenerativeContentBlob[];
  };
}

export interface ClientContentMessage {
  clientContent: {
    turns: Content[];
    turnComplete: boolean;
  };
}

export interface ServerContent {
  interrupted?: boolean;
  turnComplete?: boolean;
  modelTurn?: ModelTurn;
}

export interface ModelTurn {
  parts: Part[];
}

export interface ToolCall {
  functionCalls: Array<{
    name: string;
    id: string;
    args: Record<string, any>;
  }>;
}

export interface ToolCallCancellation {
  ids: string[];
}

export interface ToolResponseMessage {
  toolResponse: {
    functionResponses: Array<{
      id: string;
      response: Record<string, any>;
    }>;
  };
}

export interface SetupMessage {
  setup: LiveConfig;
}

export type LiveIncomingMessage = 
  | { serverContent: ServerContent }
  | { setupComplete: Record<string, never> }
  | { toolCall: ToolCall }
  | { toolCallCancellation: ToolCallCancellation };

// Type guards
export function isServerContentMessage(message: any): message is { serverContent: ServerContent } {
  return message && typeof message === 'object' && 'serverContent' in message;
}

export function isSetupCompleteMessage(message: any): message is { setupComplete: Record<string, never> } {
  return message && typeof message === 'object' && 'setupComplete' in message;
}

export function isToolCallMessage(message: any): message is { toolCall: ToolCall } {
  return message && typeof message === 'object' && 'toolCall' in message;
}

export function isToolCallCancellationMessage(message: any): message is { toolCallCancellation: ToolCallCancellation } {
  return message && typeof message === 'object' && 'toolCallCancellation' in message;
}

export function isInterrupted(serverContent: ServerContent): boolean {
  return Boolean(serverContent.interrupted);
}

export function isTurnComplete(serverContent: ServerContent): boolean {
  return Boolean(serverContent.turnComplete);
}

export function isModelTurn(serverContent: ServerContent): serverContent is ServerContent & { modelTurn: ModelTurn } {
  return Boolean(serverContent.modelTurn);
}
