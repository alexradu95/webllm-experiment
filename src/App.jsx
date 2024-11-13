import { MessageList } from './components/MessageList';
import { ChatInput } from './components/ChatInput';
import { StatusBar } from './components/StatusBar';
import { DebugPanel } from './components/DebugPanel';
import { useChat } from './hooks/useChat';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DebugProvider, useDebug } from './context/DebugContext';
import React from "react";

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
    const { messages, status, error, sendMessage, initializeWorker } = useChat();
    const { addLog } = useDebug();

    // Log WebGPU support status on component mount
    React.useEffect(() => {
        const checkWebGPU = async () => {
            if (!navigator.gpu) {
                addLog('error', 'WebGPU not supported in this browser');
                return;
            }

            try {
                const adapter = await navigator.gpu.requestAdapter();
                if (!adapter) {
                    addLog('error', 'No WebGPU adapter found');
                    return;
                }

                const device = await adapter.requestDevice();
                addLog('info', 'WebGPU initialized successfully', {
                    adapterName: adapter.name,
                    features: [...device.features].map(f => f.toString()),
                    limits: Object.fromEntries(
                        Object.entries(device.limits)
                            .filter(([, value]) => typeof value !== 'function')
                    )
                });
            } catch (error) {
                addLog('error', 'WebGPU initialization failed', {
                    error: error.message,
                    stack: error.stack
                });
            }
        };

        checkWebGPU();
    }, [addLog]);

    if (!navigator.gpu) {
        return (
            <main className="h-screen flex items-center justify-center">
                <div className="text-center p-8">
                    <h1 className="text-2xl font-bold text-red-600 mb-4">
                        WebGPU is not supported
                    </h1>
                    <p className="text-gray-600 max-w-md mx-auto">
                        This application requires WebGPU support. Please use a compatible browser
                        like Chrome Canary or Edge Canary with WebGPU flags enabled.
                    </p>
                </div>
            </main>
        );
    }

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

            <MessageList
                messages={messages}
                onMessageRendered={(message) => {
                    addLog('debug', 'Message rendered', {
                        role: message.role,
                        contentLength: message.content.length
                    });
                }}
            />

            <footer className="border-t bg-white">
                <ChatInput
                    onSubmit={(message) => {
                        addLog('info', 'User message submitted', { message });
                        sendMessage(message);
                    }}
                    disabled={status !== 'ready'}
                />
                <StatusBar
                    status={status}
                    error={error}
                    onInitialize={() => {
                        addLog('info', 'Model initialization requested');
                        initializeWorker();
                    }}
                />
            </footer>
        </main>
    );
}
