import { useState, useCallback } from 'react';
import { useWorker } from './useWorker';
import { useDebug } from '../context/DebugContext';

export function useChat() {
    const [messages, setMessages] = useState([]);
    const [contexts, setContexts] = useState([]);
    const { status, error, initializeWorker, generateResponse, sendContextCommand } = useWorker();
    const { addLog } = useDebug();

    const addMessage = useCallback((role, content) => {
        setMessages(prev => [...prev, { role, content }]);
    }, []);

    const updateLastMessage = useCallback((content) => {
        setMessages(prev => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1].content += content;
            return newMessages;
        });
    }, []);

    const sendMessage = useCallback(async (userMessage) => {
        if (!userMessage.trim()) return;

        addLog('info', 'Processing message', { userMessage });
        addMessage('user', userMessage);
        addMessage('assistant', '');

        const cleanup = generateResponse(
            messages.concat({ role: 'user', content: userMessage }),
            userMessage,
            updateLastMessage
        );

        return cleanup;
    }, [messages, generateResponse, addMessage, updateLastMessage, addLog]);

    const addContext = useCallback(async (text, metadata = {}) => {
        try {
            const result = await sendContextCommand('add', {
                id: `ctx_${Date.now()}`,
                text,
                metadata
            });
            addLog('info', 'Context added', result);
            refreshContexts();
            return result;
        } catch (error) {
            addLog('error', 'Failed to add context', { error });
            throw error;
        }
    }, [sendContextCommand, addLog]);

    const removeContext = useCallback(async (id) => {
        try {
            const result = await sendContextCommand('remove', { id });
            addLog('info', 'Context removed', result);
            refreshContexts();
            return result;
        } catch (error) {
            addLog('error', 'Failed to remove context', { error });
            throw error;
        }
    }, [sendContextCommand, addLog]);

    const clearContexts = useCallback(async () => {
        try {
            const result = await sendContextCommand('clear');
            addLog('info', 'Contexts cleared', result);
            setContexts([]);
            return result;
        } catch (error) {
            addLog('error', 'Failed to clear contexts', { error });
            throw error;
        }
    }, [sendContextCommand, addLog]);

    const refreshContexts = useCallback(async () => {
        try {
            const result = await sendContextCommand('list');
            setContexts(result.contexts);
            addLog('debug', 'Contexts refreshed', { count: result.contexts.length });
            return result.contexts;
        } catch (error) {
            addLog('error', 'Failed to refresh contexts', { error });
            throw error;
        }
    }, [sendContextCommand, addLog]);

    return {
        messages,
        contexts,
        status,
        error,
        sendMessage,
        initializeWorker,
        addContext,
        removeContext,
        clearContexts,
        refreshContexts
    };
}
