import { useState, useCallback } from 'react';
import { useWorker } from './useWorker';

export function useChat() {
    const [messages, setMessages] = useState([]);
    const { status, error, initializeWorker, generateResponse } = useWorker();

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

        addMessage('user', userMessage);
        addMessage('assistant', '');

        const cleanup = generateResponse(
            messages.concat({ role: 'user', content: userMessage }),
            updateLastMessage
        );

        return cleanup;
    }, [messages, generateResponse, addMessage, updateLastMessage]);

    return {
        messages,
        status,
        error,
        sendMessage,
        initializeWorker
    };
}
