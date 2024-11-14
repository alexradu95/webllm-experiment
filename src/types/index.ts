export interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: string;
}

export interface Context {
    id: string;
    text: string;
    createdAt: string;
    tokens?: number;
    similarity?: number;
    embeddings?: number[];
    metadata?: Record<string, any>;
}

export type ChatStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface WorkerMessage {
    type: 'check' | 'load' | 'generate' | 'context';
    command?: string;
    data?: any;
    messageId?: number;
}

export interface WorkerResponse {
    status: 'ready' | 'error' | 'update' | 'debug' | 'success';
    output?: string;
    data?: any;
    messageId?: number;
}

export interface DebugLog {
    id: number;
    timestamp: string;
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    details?: any;
}
