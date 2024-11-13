import { useCallback, useState } from 'react';
import { useWorker } from './useWorker';
import { useDebug } from '../context/DebugContext';

export function useChat() {
    const [messages, setMessages] = useState([]);
    const [contexts, setContexts] = useState([]);
    const [contextError, setContextError] = useState(null);
    const { status, error, initializeWorker, generateResponse, sendContextCommand } = useWorker();
    const { addLog } = useDebug();

    const addMessage = useCallback((role, content) => {
        setMessages(prev => [...prev, { role, content }]);
    }, []);

    const updateLastMessage = useCallback((content) => {
        setMessages(prev => {
            const newMessages = [...prev];
            if (newMessages.length > 0) {
                newMessages[newMessages.length - 1].content += content;
            }
            return newMessages;
        });
    }, []);

    const sendMessage = useCallback(async (userMessage) => {
        if (!userMessage.trim()) return;

        try {
            addLog('info', 'Processing message', { userMessage });
            addMessage('user', userMessage);
            addMessage('assistant', '');

            await generateResponse(
                messages.concat({ role: 'user', content: userMessage }),
                userMessage,
                updateLastMessage
            );
        } catch (error) {
            addLog('error', 'Failed to send message', { error });
            // Update the last message to show the error
            updateLastMessage('Sorry, an error occurred while generating the response.');
        }
    }, [messages, generateResponse, addMessage, updateLastMessage, addLog]);

    const addContext = useCallback(async (text, metadata = {}) => {
        try {
            setContextError(null);
            const id = `ctx_${Date.now()}`;
            await sendContextCommand('add', {
                id,
                text,
                metadata,
                createdAt: new Date().toISOString()
            });

            const updatedContexts = await sendContextCommand('list');
            setContexts(updatedContexts);
            addLog('info', 'Context added successfully', { id });
            return id;
        } catch (error) {
            const errorMessage = error.message.includes('Context too long')
                ? error.message
                : 'Failed to add context. Please try with shorter text.';

            setContextError(errorMessage);
            addLog('error', 'Failed to add context', { error });
            throw new Error(errorMessage);
        }
    }, [sendContextCommand, addLog]);

    const removeContext = useCallback(async (id) => {
        try {
            setContextError(null);
            await sendContextCommand('remove', { id });
            const updatedContexts = await sendContextCommand('list');
            setContexts(updatedContexts);
            addLog('info', 'Context removed successfully', { id });
        } catch (error) {
            setContextError('Failed to remove context');
            addLog('error', 'Failed to remove context', { error });
            throw error;
        }
    }, [sendContextCommand, addLog]);

    const clearContexts = useCallback(async () => {
        try {
            setContextError(null);
            await sendContextCommand('clear');
            setContexts([]);
            addLog('info', 'All contexts cleared');
        } catch (error) {
            setContextError('Failed to clear contexts');
            addLog('error', 'Failed to clear contexts', { error });
            throw error;
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
