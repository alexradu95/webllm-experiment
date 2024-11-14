import { pipeline, Pipeline } from '@huggingface/transformers';
import { IContextService } from './interfaces.ts';
import {Context} from "@/types";

type FeatureExtractionPipeline = Pipeline & {
    (input: string, options?: any): Promise<{ data: Float32Array }>;
    processor?: any;
};

export class ContextService implements IContextService {
    private embedder: FeatureExtractionPipeline | null = null;
    private contexts: Context[] = [];
    private initialized: boolean = false;
    private readonly embeddingModel: string = "Xenova/all-MiniLM-L6-v2";

    async initialize(): Promise<void> {
        try {
            this.embedder = (await pipeline('feature-extraction', this.embeddingModel)) as FeatureExtractionPipeline;
            this.initialized = true;
        } catch (error) {
            console.error('Failed to initialize embedder:', error);
            throw error;
        }
    }

    cosineSimilarity(vecA: number[], vecB: number[]): number {
        const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
        const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
        const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
        return dotProduct / (magnitudeA * magnitudeB);
    }

    async getEmbeddings(text: string): Promise<number[]> {
        if (!this.initialized || !this.embedder) {
            throw new Error('Context service not initialized');
        }

        const output = await this.embedder(text, { pooling: 'mean', normalize: true });
        return Array.from(output.data);
    }

    async addContext(id: string, text: string, metadata: Record<string, any> = {}): Promise<string> {
        if (!this.initialized) {
            throw new Error('Service not initialized');
        }

        const embeddings = await this.getEmbeddings(text);
        const context: Context = {
            id,
            text,
            embeddings,
            metadata,
            createdAt: new Date().toISOString()
        };

        this.contexts.push(context);
        this.contexts.sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        return id;
    }

    async findRelevantContexts(
        query: string,
        maxResults: number = 3,
        threshold: number = 0.7
    ): Promise<Context[]> {
        if (!this.initialized) {
            throw new Error('Service not initialized');
        }

        const queryEmbeddings = await this.getEmbeddings(query);

        const withSimilarity = this.contexts.map(context => ({
            ...context,
            similarity: this.cosineSimilarity(queryEmbeddings, context.embeddings || [])
        }));

        return withSimilarity
            .filter(ctx => (ctx.similarity ?? 0) > threshold)
            .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
            .slice(0, maxResults);
    }

    removeContext(id: string): boolean {
        const initialLength = this.contexts.length;
        this.contexts = this.contexts.filter(c => c.id !== id);
        return this.contexts.length < initialLength;
    }

    clearContexts(): void {
        this.contexts = [];
    }

    getAllContexts(): Context[] {
        return [...this.contexts];
    }
}
