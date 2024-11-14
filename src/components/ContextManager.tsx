import React, { useState, FormEvent } from 'react';
import { useDebug } from '../context/DebugContext.tsx';

interface Context {
    id: string;
    text: string;
    createdAt: string;
    tokens?: number;
    similarity?: number;
    embeddings?: number[];
    metadata?: Record<string, any>;
}

interface IContextService {
    initialize(): Promise<void>;
    cosineSimilarity(vecA: number[], vecB: number[]): number;
    getEmbeddings(text: string): Promise<number[]>;
    addContext(id: string, text: string, metadata?: Record<string, any>): Promise<string>;
    findRelevantContexts(query: string, maxResults?: number, threshold?: number): Promise<Context[]>;
    removeContext(id: string): boolean;
    clearContexts(): void;
    getAllContexts(): Context[];
}

interface ContextManagerProps {
    contextService: IContextService;
    onContextChange?: (contexts: Context[]) => void;
}

export function ContextManager({ contextService, onContextChange }: ContextManagerProps) {
    const [newContext, setNewContext] = useState<string>('');
    const [contexts, setContexts] = useState<Context[]>([]);
    const { addLog } = useDebug();
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const handleAddContext = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!newContext.trim()) return;

        setIsLoading(true);
        try {
            const id = `ctx_${Date.now()}`;
            await contextService.addContext(id, newContext);

            addLog('info', 'Added new context', { id, text: newContext });
            const updatedContexts = contextService.getAllContexts();
            setContexts(updatedContexts);
            setNewContext('');

            if (onContextChange) {
                onContextChange(updatedContexts);
            }
        } catch (error: any) {
            addLog('error', 'Failed to add context', { error: error.message });
        } finally {
            setIsLoading(false);
        }
    };

    const handleRemoveContext = async (id: string) => {
        try {
            const removed = contextService.removeContext(id);
            if (removed) {
                addLog('info', 'Removed context', { id });
                const updatedContexts = contextService.getAllContexts();
                setContexts(updatedContexts);

                if (onContextChange) {
                    onContextChange(updatedContexts);
                }
            } else {
                addLog('error', 'Context not found', { id });
            }
        } catch (error: any) {
            addLog('error', 'Failed to remove context', { error: error.message });
        }
    };

    return (
        <div className="border rounded-lg bg-white p-4">
            <h2 className="text-lg font-semibold mb-4">Context Management</h2>

            {/* Add Context Form */}
            <form onSubmit={handleAddContext} className="mb-4">
                <div className="flex gap-2">
                    <textarea
                        value={newContext}
                        onChange={(e) => setNewContext(e.target.value)}
                        placeholder="Enter new context information..."
                        className="flex-1 p-2 border rounded-lg resize-vertical min-h-[100px]"
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !newContext.trim()}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300"
                    >
                        {isLoading ? 'Adding...' : 'Add Context'}
                    </button>
                </div>
            </form>

            {/* Context List */}
            <div className="space-y-2">
                {contexts.map((context) => (
                    <div
                        key={context.id}
                        className="p-3 border rounded-lg hover:bg-gray-50 group"
                    >
                        <div className="flex justify-between items-start">
                            <div className="flex-1">
                                <p className="text-sm text-gray-600 mb-1">
                                    Added: {new Date(context.createdAt).toLocaleString()}
                                </p>
                                <p className="whitespace-pre-wrap">{context.text}</p>
                            </div>
                            <button
                                onClick={() => handleRemoveContext(context.id)}
                                className="ml-2 p-1 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                Remove
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
