import { useState, useCallback, useEffect } from 'react';
import { useDebug } from '../context/DebugContext';

export function ContextPanel({
                                 contexts,
                                 onAddContext,
                                 onRemoveContext,
                                 onClearContexts,
                                 disabled = false
                             }) {
    const [newContext, setNewContext] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const { addLog } = useDebug();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!newContext.trim() || isAdding || disabled) return;

        setIsAdding(true);
        try {
            await onAddContext(newContext);
            setNewContext('');
            addLog('info', 'Context added successfully');
        } catch (error) {
            addLog('error', 'Failed to add context', { error });
        } finally {
            setIsAdding(false);
        }
    };

    const handleRemoveContext = async (id) => {
        try {
            await onRemoveContext(id);
            addLog('info', 'Context removed successfully', { id });
        } catch (error) {
            addLog('error', 'Failed to remove context', { error, id });
        }
    };

    return (
        <div className="fixed right-0 top-0 h-screen w-80 bg-white border-l shadow-lg transform transition-transform duration-300"
             style={{ transform: isPanelOpen ? 'translateX(0)' : 'translateX(100%)' }}>

            {/* Toggle Button */}
            <button
                onClick={() => setIsPanelOpen(!isPanelOpen)}
                className="absolute left-0 top-1/2 -translate-x-full rotate-90 bg-white px-4 py-2 border-t border-l border-b rounded-t-lg transform origin-right"
            >
                {isPanelOpen ? 'Hide Contexts' : 'Show Contexts'}
            </button>

            <div className="h-full flex flex-col p-4">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold">Contexts</h2>
                    <button
                        onClick={onClearContexts}
                        disabled={disabled || contexts.length === 0}
                        className="text-sm text-red-600 hover:text-red-700 disabled:text-gray-400"
                    >
                        Clear All
                    </button>
                </div>

                {/* Add Context Form */}
                <form onSubmit={handleSubmit} className="mb-4">
          <textarea
              value={newContext}
              onChange={(e) => setNewContext(e.target.value)}
              placeholder="Add new context..."
              className="w-full p-2 border rounded-lg resize-none h-24 mb-2"
              disabled={disabled || isAdding}
          />
                    <button
                        type="submit"
                        disabled={disabled || isAdding || !newContext.trim()}
                        className="w-full py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 transition-colors"
                    >
                        {isAdding ? 'Adding...' : 'Add Context'}
                    </button>
                </form>

                {/* Contexts List */}
                <div className="flex-1 overflow-auto">
                    {contexts.map((context) => (
                        <div
                            key={context.id}
                            className="mb-3 p-3 bg-gray-50 rounded-lg group relative"
                        >
                            <button
                                onClick={() => handleRemoveContext(context.id)}
                                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-600 transition-opacity"
                            >
                                ×
                            </button>
                            <div className="text-sm text-gray-500 mb-1">
                                {new Date(context.createdAt).toLocaleString()}
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{context.text}</p>
                            {context.similarity && (
                                <div className="text-xs text-gray-500 mt-1">
                                    Relevance: {Math.round(context.similarity * 100)}%
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
