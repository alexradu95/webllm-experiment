import { MessageList } from './components/MessageList';
import { ChatInput } from './components/ChatInput';
import { StatusBar } from './components/StatusBar';
import { ContextPanel } from './components/ContextPanel';
import { DebugPanel } from './components/DebugPanel';
import { LoadingProgress } from './components/LoadingProgress';
import { useChat } from './hooks/useChat';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DebugProvider } from './context/DebugContext';

export default function App() {
    return (
        <ErrorBoundary>
            <DebugProvider>
                <AppContent />
                <DebugPanel />
            </DebugProvider>
        </ErrorBoundary>
    );
}

function AppContent() {
    const {
        messages,
        contexts,
        status,
        error,
        sendMessage,
        initializeWorker,
        addContext,
        removeContext,
        clearContexts
    } = useChat();

    return (
        <main className="h-screen flex flex-col bg-gray-50">
            <header className="bg-white border-b px-4 py-3 flex justify-between items-center">
                <h1 className="text-xl font-semibold text-gray-800">Llama 3.2 Chat</h1>
                <div className="flex items-center space-x-2 text-sm">
                    <span className={`px-2 py-1 rounded ${
                        status === 'ready'
                            ? 'bg-green-100 text-green-800'
                            : status === 'error'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                    }`}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                    </span>
                </div>
            </header>

            <div className="flex-1 flex">
                <div className="flex-1 flex flex-col">
                    <MessageList messages={messages} />

                    <footer className="border-t bg-white">
                        <ChatInput
                            onSubmit={sendMessage}
                            disabled={status !== 'ready'}
                        />
                        <StatusBar
                            status={status}
                            error={error}
                            onInitialize={initializeWorker}
                        />
                    </footer>
                </div>

                <ContextPanel
                    contexts={contexts}
                    onAddContext={addContext}
                    onRemoveContext={removeContext}
                    onClearContexts={clearContexts}
                    disabled={status !== 'ready'}
                />
            </div>

            <LoadingProgress status={status} error={error} />
        </main>
    );
}
