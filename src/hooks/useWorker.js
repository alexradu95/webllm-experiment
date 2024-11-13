import { useEffect, useRef, useState } from 'react';
import { useDebug } from '../context/DebugContext';

export function useWorker() {
    const worker = useRef(null);
    const [status, setStatus] = useState('idle');
    const [error, setError] = useState(null);
    const { addLog } = useDebug();

    useEffect(() => {
        if (!worker.current) {
            worker.current = new Worker(new URL('../worker.js', import.meta.url), { type: 'module' });
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

    const generateResponse = (messages, onUpdate) => {
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
            if (data.status === 'update') {
                onUpdate(data.output);
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
                    setError(data.data);
                    setStatus('error');
                    addLog('error', 'Worker error', { error: data.data });
                    break;

                case 'debug':
                    // Forward debug messages to the debug context
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
        generateResponse
    };
}
