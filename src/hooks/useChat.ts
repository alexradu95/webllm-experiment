import { useCallback, useState } from 'react';
import { ChatStatus, Context, DebugContextValue, Message } from '../types';
import { useWorker } from './useWorker';
import { useDebug } from '../context/DebugContext';

interface UseChatReturn {
    messages: Message[];
    contexts: Context[];
    contextError: string | null;
    status: ChatStatus;
    error: string | null;
    sendMessage: (content: string) => Promise<void>;
    initializeWorker: () => void;
    addContext: (text: string, metadata?: Record<string, unknown>) => Promise<string>;
    removeContext: (id: string) => Promise<void>;
    clearContexts: () => Promise<void>;
}

export function useChat(): UseChatReturn {
    const [messages, setMessages] = useState<Message[]>([]);
    const [contexts, setContexts] = useState<Context[]>([]);
    const [contextError, setContextError] = useState<string | null>(null);

    const {
        status,
        error,
        initializeWorker,
        generateResponse,
        sendContextCommand
    } = useWorker();

    const { addLog } = useDebug() as DebugContextValue;

    const createMessage = useCallback((role: Message['role'], content: string): Message => ({
        id: crypto.randomUUID(),
        role,
        content,
        timestamp: new Date().toISOString()
    }), []);

    const addMessage = useCallback((role: Message['role'], content: string): void => {
        setMessages(prev => [...prev, createMessage(role, content)]);
    }, [createMessage]);

    const updateLastMessage = useCallback((content: string): void => {
        setMessages(prev => {
            const newMessages = [...prev];
            if (newMessages.length > 0) {
                newMessages[newMessages.length - 1].content += content;
            }
            return newMessages;
        });
    }, []);

    const sendMessage = useCallback(async (userMessage: string) => {
        if (!userMessage.trim()) return;

        try {
            addLog('info', 'Processing message', { userMessage });
            const userMsg = createMessage('user', userMessage);
            addMessage('user', userMessage);
            addMessage('assistant', '');

            await generateResponse(
                [...messages, userMsg],
                userMessage,
                updateLastMessage
            );
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            addLog('error', 'Failed to send message', { error: errorMessage });
            updateLastMessage('\n\nSorry, an error occurred while generating the response.');
        }
    }, [messages, generateResponse, addMessage, updateLastMessage, addLog, createMessage]);

    const addContext = useCallback(async (
        text: string,
        metadata: Record<string, unknown> = {}
    ): Promise<string> => {
        try {
            setContextError(null);
            const id = `ctx_${Date.now()}`;
            await sendContextCommand('add', {
                id,
                text,
                metadata,
                createdAt: new Date().toISOString()
            });

            const updatedContexts = await sendContextCommand('list') as Context[];
            setContexts(updatedContexts);
            addLog('info', 'Context added successfully', { id });
            return id;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            const userMessage = errorMessage.includes('Context too long')
                ? errorMessage
                : 'Failed to add context. Please try with shorter text.';

            setContextError(userMessage);
            addLog('error', 'Failed to add context', { error: errorMessage });
            throw new Error(userMessage);
        }
    }, [sendContextCommand, addLog]);

    const removeContext = useCallback(async (id: string): Promise<void> => {
        try {
            setContextError(null);
            await sendContextCommand('remove', { id });
            const updatedContexts = await sendContextCommand('list') as Context[];
            setContexts(updatedContexts);
            addLog('info', 'Context removed successfully', { id });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            setContextError('Failed to remove context');
            addLog('error', 'Failed to remove context', { error: errorMessage });
            throw new Error(errorMessage);
        }
    }, [sendContextCommand, addLog]);

    const clearContexts = useCallback(async (): Promise<void> => {
        try {
            setContextError(null);
            await sendContextCommand('clear');
            setContexts([]);
            addLog('info', 'All contexts cleared');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            setContextError('Failed to clear contexts');
            addLog('error', 'Failed to clear contexts', { error: errorMessage });
            throw new Error(errorMessage);
        }
    }, [sendContextCommand, addLog]);

    return {
        messages,
        contexts,
        contextError,
        status,
        error,
        sendMessage,
        initializeWorker,
        addContext,
        removeContext,
        clearContexts
    };
}
