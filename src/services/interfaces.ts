import {Context} from "../types/index.ts";

export interface IContextService {
    initialize(): Promise<void>;
    cosineSimilarity(vecA: number[], vecB: number[]): number;
    getEmbeddings(text: string): Promise<number[]>;
    addContext(id: string, text: string, metadata?: Record<string, any>): Promise<string>;
    findRelevantContexts(query: string, maxResults?: number, threshold?: number): Promise<Context[]>;
    removeContext(id: string): boolean;
    clearContexts(): void;
    getAllContexts(): Context[];
}

export interface IWorkerService {
    status: 'idle' | 'loading' | 'ready' | 'error';
    error: string | null;
    initializeWorker(): void;
    generateResponse(messages: any[], onUpdate: (content: string) => void): Promise<void>;
    sendContextCommand(command: string, data: any): Promise<any>;
}
