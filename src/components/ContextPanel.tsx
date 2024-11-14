import { useState, useCallback, useEffect } from 'react';
import { AlertCircle, X, ChevronLeft, ChevronRight, Trash2, Info } from 'lucide-react';
import { useDebug } from '../context/DebugContext.jsx';

// Constants for token limits
const MAX_TOTAL_LENGTH = 512;
const MAX_CONTEXT_LENGTH = 256;

const formatTokenCount = (count) => {
    if (!count) return '';
    return `${count.toLocaleString()} token${count === 1 ? '' : 's'}`;
};

const TokenProgress = ({ current, max, containerClass = '' }) => (
    <div className={`w-full ${containerClass}`}>
        <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span>{formatTokenCount(current)}</span>
            <span>{formatTokenCount(max)}</span>
        </div>
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
                className="h-full transition-all duration-300 rounded-full"
                style={{
                    width: `${Math.min((current / max) * 100, 100)}%`,
                    backgroundColor: current > max ? '#ef4444' : current > max * 0.8 ? '#f59e0b' : '#3b82f6'
                }}
            />
        </div>
    </div>
);

export function ContextPanel({
                                 contexts,
                                 onAddContext,
                                 onRemoveContext,
                                 onClearContexts,
                                 disabled = false
                             }) {
    const [newContext, setNewContext] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [error, setError] = useState(null);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);
    const { addLog } = useDebug();

    // Handle Escape key
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape' && isPanelOpen) {
                setIsPanelOpen(false);
            }
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isPanelOpen]);

    // Auto-hide error after 5 seconds
    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => setError(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [error]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!newContext.trim() || isAdding || disabled) return;

        setIsAdding(true);
        setError(null);

        try {
            await onAddContext(newContext);
            setNewContext('');
            addLog('info', 'Context added successfully');
        } catch (error) {
            setError(error.message);
            addLog('error', 'Failed to add context', { error });
        } finally {
            setIsAdding(false);
        }
    };

    const totalTokens = contexts.reduce((sum, ctx) => sum + (ctx.tokens || 0), 0);

    return (
        <>
            {/* Panel Toggle Button */}
            <button
                onClick={() => setIsPanelOpen(!isPanelOpen)}
                className="fixed right-0 top-1/2 -translate-y-1/2 bg-white px-2 py-4 border-l border-y rounded-l-lg shadow-lg transform transition-transform duration-300 hover:bg-gray-50 group z-40"
            >
                {isPanelOpen ? <ChevronRight className="w-5 h-5 text-gray-600"/> :
                    <ChevronLeft className="w-5 h-5 text-gray-600"/>}
                <span
                    className="absolute left-0 transform -translate-x-full -translate-y-1/2 top-1/2 bg-gray-800 text-white px-2 py-1 rounded text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                    {isPanelOpen ? 'Hide Context' : 'Show Context'}
                </span>
            </button>

            {/* Main Panel */}
            <div
                className={`fixed inset-y-0 right-0 w-96 bg-white border-l shadow-lg transform transition-transform duration-300 ease-in-out z-50 ${
                    isPanelOpen ? 'translate-x-0' : 'translate-x-full'
                }`}
            >
                <div className="h-full flex flex-col bg-gray-50">
                    {/* Header */}
                    <div className="sticky top-0 px-6 py-4 bg-white border-b relative z-10">
                        {/* Close button */}
                        <button
                            onClick={() => setIsPanelOpen(false)}
                            className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                            aria-label="Close panel"
                        >
                            <X className="w-5 h-5"/>
                        </button>

                        <div className="flex items-center space-x-2 pr-8">
                            <h2 className="text-lg font-semibold text-gray-800">Context Manager</h2>
                            <button
                                onClick={() => setShowTooltip(!showTooltip)}
                                className="p-1 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors"
                            >
                                <Info className="w-4 h-4"/>
                            </button>
                            <button
                                onClick={onClearContexts}
                                disabled={disabled || contexts.length === 0}
                                className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Clear all contexts"
                            >
                                <Trash2 className="w-4 h-4"/>
                            </button>
                        </div>

                        {/* Token Usage */}
                        <div className="mt-4">
                            <TokenProgress
                                current={totalTokens}
                                max={MAX_TOTAL_LENGTH}
                            />
                        </div>
                    </div>

                    {/* Info Tooltip */}
                    {showTooltip && (
                        <div className="px-6 py-3 bg-blue-50 border-b">
                            <div className="text-sm text-blue-800">
                                <p className="font-medium mb-1">Context Limits</p>
                                <ul className="list-disc list-inside space-y-1 text-xs">
                                    <li>Maximum {MAX_CONTEXT_LENGTH} tokens per context</li>
                                    <li>Total limit of {MAX_TOTAL_LENGTH} tokens across all contexts</li>
                                    <li>Newer contexts are prioritized in responses</li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* Error Display */}
                    {error && (
                        <div className="px-6 py-3 bg-red-50 border-b">
                            <div className="flex items-start space-x-2">
                                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0"/>
                                <div className="flex-1">
                                    <p className="text-sm text-red-800">{error}</p>
                                </div>
                                <button
                                    onClick={() => setError(null)}
                                    className="text-red-500 hover:text-red-700"
                                >
                                    <X className="w-4 h-4"/>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Content Area */}
                    <div className="flex-1 overflow-auto px-6 py-4">
                        {/* Context List */}
                        <div className="space-y-4">
                            {contexts.map((context) => (
                                <div
                                    key={context.id}
                                    className="bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow duration-200 group"
                                >
                                    <div className="p-4">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="text-xs text-gray-500">
                                                {new Date(context.createdAt).toLocaleString()}
                                            </div>
                                            <button
                                                onClick={() => onRemoveContext(context.id)}
                                                disabled={disabled}
                                                className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 rounded transition-all duration-200"
                                            >
                                                <X className="w-4 h-4"/>
                                            </button>
                                        </div>
                                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                            {context.text}
                                        </p>
                                        <div className="mt-2 flex justify-between items-center">
                                            <TokenProgress
                                                current={context.tokens || 0}
                                                max={MAX_CONTEXT_LENGTH}
                                                containerClass="w-32"
                                            />
                                            {context.similarity && (
                                                <div className="text-xs text-gray-500">
                                                    Relevance: {Math.round(context.similarity * 100)}%
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Add Context Form */}
                    <div className="p-6 bg-white border-t">
                        <form onSubmit={handleSubmit} className="space-y-3">
                            <div className="relative">
                                <textarea
                                    value={newContext}
                                    onChange={(e) => {
                                        setNewContext(e.target.value);
                                        setError(null);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && e.metaKey) {
                                            handleSubmit(e);
                                        }
                                    }}
                                    placeholder="Add new context..."
                                    className="w-full p-3 border rounded-lg resize-none h-32 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow disabled:bg-gray-50 disabled:text-gray-500"
                                    disabled={disabled || isAdding}
                                />
                                <div className="absolute bottom-2 right-2 text-xs text-gray-400">
                                    Press ⌘+Enter to submit
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={disabled || isAdding || !newContext.trim()}
                                className="w-full py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
                            >
                                {isAdding ? (
                                    <>
                                        <div
                                            className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                                        <span>Adding...</span>
                                    </>
                                ) : (
                                    <span>Add Context</span>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            </div>

            {/* Backdrop for mobile */}
            {isPanelOpen && (
                <div
                    className="fixed inset-0 bg-black/25 md:hidden z-40"
                    onClick={() => setIsPanelOpen(false)}
                />
            )}
        </>
    );
}
