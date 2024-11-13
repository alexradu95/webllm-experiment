import { pipeline } from '@huggingface/transformers';
import { useDebug } from '../context/DebugContext';

// We'll use a smaller model for embeddings to save resources
const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";

export class ContextService {
    constructor() {
        this.embedder = null;
        this.contexts = [];
        this.initialized = false;
    }

    async initialize() {
        try {
            this.embedder = await pipeline('feature-extraction', EMBEDDING_MODEL);
            this.initialized = true;
        } catch (error) {
            console.error('Failed to initialize embedder:', error);
            throw error;
        }
    }

    // Calculate cosine similarity between two vectors
    cosineSimilarity(vecA, vecB) {
        const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
        const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
        const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
        return dotProduct / (magnitudeA * magnitudeB);
    }

    // Get embeddings for a text
    async getEmbeddings(text) {
        if (!this.initialized) {
            throw new Error('Context service not initialized');
        }

        const output = await this.embedder(text, { pooling: 'mean', normalize: true });
        return Array.from(output.data);
    }

    // Add a new context
    async addContext(id, text, metadata = {}) {
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
            new Date(b.createdAt) - new Date(a.createdAt)
        );

        return id;
    }

    // Find relevant contexts for a query
    async findRelevantContexts(query, maxResults = 3, threshold = 0.7) {
        const queryEmbeddings = await this.getEmbeddings(query);

        // Calculate similarities and sort
        const withSimilarity = this.contexts.map(context => ({
            ...context,
            similarity: this.cosineSimilarity(queryEmbeddings, context.embeddings)
        }));

        return withSimilarity
            .filter(ctx => ctx.similarity > threshold)
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, maxResults);
    }

    // Remove a context by ID
    removeContext(id) {
        const index = this.contexts.findIndex(c => c.id === id);
        if (index !== -1) {
            this.contexts.splice(index, 1);
            return true;
        }
        return false;
    }

    // Clear all contexts
    clearContexts() {
        this.contexts = [];
    }

    // Get all contexts
    getAllContexts() {
        return [...this.contexts];
    }
}
