import { useEffect, useRef, useState } from 'react';

export function useWorker() {
    const worker = useRef(null);
    const [status, setStatus] = useState('idle');
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!worker.current) {
            worker.current = new Worker(new URL('../worker.js', import.meta.url), { type: 'module' });
            worker.current.postMessage({ type: 'check' });
        }

        return () => worker.current?.terminate();
    }, []);

    const initializeWorker = () => {
        setStatus('loading');
        worker.current.postMessage({ type: 'load' });
    };

    const generateResponse = (messages, onUpdate) => {
        if (status !== 'ready') {
            throw new Error('Worker not ready');
        }

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
                    break;
                case 'error':
                    setError(data.data);
                    setStatus('error');
                    break;
            }
        };

        worker.current.addEventListener('message', messageHandler);
        return () => worker.current.removeEventListener('message', messageHandler);
    }, []);

    return {
        status,
        error,
        initializeWorker,
        generateResponse
    };
}
