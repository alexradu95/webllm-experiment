export type Role = 'user' | 'assistant' | 'system';
export type ChatStatus = 'idle' | 'loading' | 'ready' | 'error';
export type DebugLevel = 'info' | 'warn' | 'error' | 'debug';

export interface Message {
    id: string;
    role: Role;
    content: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
}

export interface Context {
    id: string;
    text: string;
    createdAt: string;
    tokens?: number;
    similarity?: number;
    embeddings?: number[];
    metadata?: Record<string, unknown>;
}

export interface WorkerMessage {
    type: 'check' | 'load' | 'generate' | 'context';
    command?: string;
    data?: unknown;
    messageId?: number;
}

export interface WorkerResponse {
    status: 'ready' | 'error' | 'update' | 'debug' | 'success';
    output?: string;
    data?: unknown;
    messageId?: number;
}

export interface DebugLog {
    id: number;
    timestamp: string;
    level: DebugLevel;
    message: string;
    details?: unknown;
}

export interface ModelConfig {
    readonly MODEL_ID: string;
    readonly MAX_CONTEXT_LENGTH: number;
    readonly MAX_TOTAL_LENGTH: number;
    readonly MAX_MESSAGE_LENGTH: number;
    readonly MAX_GENERATION_LENGTH: number;
}

export interface GenerationConfig {
    max_new_tokens: number;
    do_sample: boolean;
    temperature: number;
    top_p: number;
    stop_sequences: string[];
}

// Service interfaces
export interface IChatService {
    sendMessage(content: string): Promise<void>;
    getMessages(): Message[];
    clearMessages(): void;
}

export interface IContextService {
    initialize(): Promise<void>;
    addContext(text: string, metadata?: Record<string, unknown>): Promise<string>;
    removeContext(id: string): Promise<void>;
    clearContexts(): Promise<void>;
    getContexts(): Context[];
    findRelevantContexts(query: string, maxResults?: number, threshold?: number): Promise<Context[]>;
    getEmbeddings(text: string): Promise<number[]>;
    cosineSimilarity(vecA: number[], vecB: number[]): number;
}

// Component Props
export interface ChatInputProps {
    onSubmit: (content: string) => Promise<void> | void;
    disabled: boolean;
    placeholder?: string;
}

export interface MessageListProps {
    messages: Message[];
    loading?: boolean;
}

export interface ContextPanelProps {
    contexts: Context[];
    onAddContext: (text: string) => Promise<void>;
    onRemoveContext: (id: string) => Promise<void>;
    onClearContexts: () => Promise<void>;
    disabled: boolean;
}

export interface StatusBarProps {
    status: ChatStatus;
    error: string | null;
    onInitialize: () => void;
}

export type StageStatus = 'pending' | 'loading' | 'complete';

export interface LoadingProgressProps {
    status: ChatStatus;
    error: string | null;
    progress?: number;
}

export interface ErrorBoundaryProps {
    children: React.ReactNode;
}

export interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

// Debug Context Types
export interface DebugContextState {
    isDebugMode: boolean;
    logs: DebugLog[];
    isDebugPanelOpen: boolean;
}

export interface DebugContextValue extends DebugContextState {
    toggleDebugMode: () => void;
    addLog: (level: DebugLevel, message: string, details?: unknown) => void;
    clearLogs: () => void;
    setIsDebugPanelOpen: (isOpen: boolean) => void;
}

// Worker Types
export interface Pipeline {
    (input: string, options?: Record<string, unknown>): Promise<{ data: Float32Array }>;
    processor?: unknown;
}

export interface TokenizerResult {
    input_ids: number[];
    length: number;
}

export interface WorkerState {
    tokenizer: unknown | null;
    model: unknown | null;
}
