import { pipeline, Pipeline } from '@huggingface/transformers';

// We'll use a smaller model for embeddings to save resources
const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";

interface Context {
    id: string;
    text: string;
    createdAt: string;
    tokens?: number;
    similarity?: number;
    embeddings?: number[];
    metadata?: Record<string, any>;
}

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

type FeatureExtractionPipeline = Pipeline & {
    (input: string, options?: any): Promise<{ data: Float32Array }>;
    processor?: any; // Adding processor as optional to satisfy the Pipeline interface
};

export class ContextService implements IContextService {
    private embedder: FeatureExtractionPipeline | null;
    private contexts: Context[];
    private initialized: boolean;

    constructor() {
        this.embedder = null;
        this.contexts = [];
        this.initialized = false;
    }

    async initialize(): Promise<void> {
        try {
            this.embedder = (await pipeline('feature-extraction', EMBEDDING_MODEL)) as FeatureExtractionPipeline;
            this.initialized = true;
        } catch (error) {
            console.error('Failed to initialize embedder:', error);
            throw error;
        }
    }

    // Calculate cosine similarity between two vectors
    cosineSimilarity(vecA: number[], vecB: number[]): number {
        const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
        const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
        const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
        return dotProduct / (magnitudeA * magnitudeB);
    }

    // Get embeddings for a text
    async getEmbeddings(text: string): Promise<number[]> {
        if (!this.initialized || !this.embedder) {
            throw new Error('Context service not initialized');
        }

        const output = await this.embedder(text, { pooling: 'mean', normalize: true });
        return Array.from(output.data);
    }

    // Add a new context
    async addContext(id: string, text: string, metadata: Record<string, any> = {}): Promise<string> {
        const embeddings = await this.getEmbeddings(text);

        this.contexts.push({
            id,
            text,
            embeddings,
            metadata,
            createdAt: new Date().toISOString()
        });

        // Sort contexts by date for consistent retrieval
        this.contexts.sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        return id;
    }

    // Find relevant contexts for a query
    async findRelevantContexts(query: string, maxResults: number = 3, threshold: number = 0.7): Promise<Context[]> {
        const queryEmbeddings = await this.getEmbeddings(query);

        // Calculate similarities and sort
        const withSimilarity = this.contexts.map(context => ({
            ...context,
            similarity: this.cosineSimilarity(queryEmbeddings, context.embeddings || [])
        }));

        return withSimilarity
            .filter(ctx => ctx.similarity !== undefined && ctx.similarity > threshold)
            .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
            .slice(0, maxResults);
    }

    // Remove a context by ID
    removeContext(id: string): boolean {
        const index = this.contexts.findIndex(c => c.id === id);
        if (index !== -1) {
            this.contexts.splice(index, 1);
            return true;
        }
        return false;
    }

    // Clear all contexts
    clearContexts(): void {
        this.contexts = [];
    }

    // Get all contexts
    getAllContexts(): Context[] {
        return [...this.contexts];
    }
}
