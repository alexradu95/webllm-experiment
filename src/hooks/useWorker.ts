import { useEffect, useRef, useState } from 'react';
import { useDebug } from '../context/DebugContext.tsx';

export function useWorker() {
    const worker = useRef(null);
    const [status, setStatus] = useState('idle');
    const [error, setError] = useState(null);
    const { addLog } = useDebug();

    useEffect(() => {
        if (!worker.current) {
            worker.current = new Worker(new URL('../worker.ts', import.meta.url), { type: 'module' });
            worker.current.postMessage({ type: 'check' });
            addLog('info', 'Worker initialized');
        }

        return () => {
            if (worker.current) {
                addLog('info', 'Worker terminated');
                worker.current.terminate();
            }
        };
    }, [addLog]);

    const initializeWorker = () => {
        setStatus('loading');
        worker.current.postMessage({ type: 'load' });
        addLog('info', 'Starting worker initialization');
    };

    const sendContextCommand = (command, data) => {
        return new Promise((resolve, reject) => {
            if (status !== 'ready' && command !== 'list') {
                reject(new Error('Worker not ready'));
                return;
            }

            const messageId = Date.now();

            const handleResponse = ({ data: responseData }) => {
                if (responseData.messageId === messageId) {
                    worker.current.removeEventListener('message', handleResponse);

                    if (responseData.status === 'error') {
                        // Don't set global error state for context errors
                        reject(new Error(responseData.data));
                    } else {
                        resolve(responseData.data);
                    }
                }
            };

            worker.current.addEventListener('message', handleResponse);

            worker.current.postMessage({
                type: 'context',
                command,
                data,
                messageId
            });
        });
    };

    const generateResponse = (messages, userMessage, onUpdate) => {
        if (status !== 'ready') {
            const error = new Error('Worker not ready');
            addLog('error', 'Generation attempted while worker not ready');
            throw error;
        }

        addLog('debug', 'Starting response generation', { messages });

        worker.current.postMessage({
            type: 'generate',
            data: messages
        });

        const handleMessage = ({ data }) => {
            if (data.status === 'update' && typeof onUpdate === 'function') {
                onUpdate(data.output);
            } else if (data.status === 'error') {
                // Set global error state only for generation errors
                setError(data.data);
                setStatus('error');
            }
        };

        worker.current.addEventListener('message', handleMessage);
        return () => worker.current.removeEventListener('message', handleMessage);
    };

    useEffect(() => {
        const messageHandler = ({ data }) => {
            switch (data.status) {
                case 'ready':
                    setStatus('ready');
                    setError(null);
                    addLog('info', 'Worker ready');
                    break;

                case 'error':
                    // Only set global error for non-context errors
                    if (!data.messageId) {
                        setError(data.data);
                        setStatus('error');
                    }
                    addLog('error', 'Worker error', { error: data.data });
                    break;

                case 'debug':
                    addLog(data.data.level, data.data.message, data.data.details);
                    break;
            }
        };

        worker.current.addEventListener('message', messageHandler);
        return () => worker.current.removeEventListener('message', messageHandler);
    }, [addLog]);

    return {
        status,
        error,
        initializeWorker,
        generateResponse,
        sendContextCommand
    };
}
