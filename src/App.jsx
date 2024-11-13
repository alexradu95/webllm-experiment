import { MessageList } from './components/MessageList';
import { ChatInput } from './components/ChatInput';
import { StatusBar } from './components/StatusBar';
import { useChat } from './hooks/useChat';

export default function App() {
  const { messages, status, error, sendMessage, initializeWorker } = useChat();

  if (!navigator.gpu) {
    return (
        <main className="h-screen flex items-center justify-center">
          <h1 className="text-2xl font-bold text-red-600">WebGPU not supported</h1>
        </main>
    );
  }

  return (
      <main className="h-screen flex flex-col">
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
      </main>
  );
}
