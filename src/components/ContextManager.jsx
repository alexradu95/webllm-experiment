import { useState } from 'react';
import { useDebug } from '../context/DebugContext';

export function ContextManager({ contextService, onContextChange }) {
    const [newContext, setNewContext] = useState('');
    const [contexts, setContexts] = useState([]);
    const { addLog } = useDebug();
    const [isLoading, setIsLoading] = useState(false);

    const handleAddContext = async (e) => {
        e.preventDefault();
        if (!newContext.trim()) return;

        setIsLoading(true);
        try {
            const id = `ctx_${Date.now()}`;
            await contextService.addContext(id, newContext);

            addLog('info', 'Added new context', { id, text: newContext });
            setContexts(contextService.getAllContexts());
            setNewContext('');

            if (onContextChange) {
                onContextChange(contextService.getAllContexts());
            }
        } catch (error) {
            addLog('error', 'Failed to add context', { error });
        } finally {
            setIsLoading(false);
        }
    };

    const handleRemoveContext = async (id) => {
        try {
            contextService.removeContext(id);
            addLog('info', 'Removed context', { id });
            setContexts(contextService.getAllContexts());

            if (onContextChange) {
                onContextChange(contextService.getAllContexts());
            }
        } catch (error) {
            addLog('error', 'Failed to remove context', { error });
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
