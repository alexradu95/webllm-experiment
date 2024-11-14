import { useEffect, useRef, useState, useCallback } from 'react';
import { useDebug } from '../context/DebugContext';
import type {
    ChatStatus,
    WorkerMessage,
    WorkerResponse,
    Message,
    DebugContextValue
} from '@/types';

interface UseWorkerReturn {
    status: ChatStatus;
    error: string | null;
    initializeWorker: () => void;
    generateResponse: (
        messages: Message[],
        userMessage: string,
        onUpdate: (content: string) => void
    ) => Promise<void>;
    sendContextCommand: (
        command: string,
        data: unknown
    ) => Promise<unknown>;
}

export function useWorker(): UseWorkerReturn {
    const worker = useRef<Worker | null>(null);
    const [status, setStatus] = useState<ChatStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    const { addLog } = useDebug() as DebugContextValue;

    useEffect(() => {
        if (!worker.current) {
            worker.current = new Worker(
                new URL('../worker.ts', import.meta.url),
                { type: 'module' }
            );
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

    const initializeWorker = useCallback(() => {
        setStatus('loading');
        worker.current?.postMessage({ type: 'load' });
        addLog('info', 'Starting worker initialization');
    }, [addLog]);

    const sendContextCommand = useCallback((
        command: string,
        data: unknown
    ): Promise<unknown> => {
        return new Promise((resolve, reject) => {
            if (!worker.current) {
                reject(new Error('Worker not initialized'));
                return;
            }

            if (status !== 'ready' && command !== 'list') {
                reject(new Error('Worker not ready'));
                return;
            }

            const messageId = Date.now();

            const handleResponse = ({ data: responseData }: MessageEvent<WorkerResponse>) => {
                if (responseData.messageId === messageId) {
                    worker.current?.removeEventListener('message', handleResponse);

                    if (responseData.status === 'error') {
                        reject(new Error(responseData.data as string));
                    } else {
                        resolve(responseData.data);
                    }
                }
            };

            worker.current.addEventListener('message', handleResponse);

            const message: WorkerMessage = {
                type: 'context',
                command,
                data,
                messageId
            };

            worker.current.postMessage(message);
        });
    }, [status]);

    const generateResponse = useCallback(async (
        messages: Message[],
        userMessage: string,
        onUpdate: (content: string) => void
    ): Promise<void> => {
        if (status !== 'ready' || !worker.current) {
            const error = new Error('Worker not ready');
            addLog('error', 'Generation attempted while worker not ready');
            throw error;
        }

        addLog('debug', 'Starting response generation', { messages });

        return new Promise((resolve, reject) => {
            const handleMessage = ({ data }: MessageEvent<WorkerResponse>) => {
                if (data.status === 'update' && data.output) {
                    onUpdate(data.output);
                } else if (data.status === 'error') {
                    setError(data.data as string);
                    setStatus('error');
                    worker.current?.removeEventListener('message', handleMessage);
                    reject(new Error(data.data as string));
                } else if (data.status === 'success') {
                    worker.current?.removeEventListener('message', handleMessage);
                    resolve();
                }
            };

            worker.current?.addEventListener('message', handleMessage);
            worker.current?.postMessage({
                type: 'generate',
                data: messages
            });
        });
    }, [status, addLog]);

    useEffect(() => {
        const messageHandler = ({ data }: MessageEvent<WorkerResponse>) => {
            switch (data.status) {
                case 'ready':
                    setStatus('ready');
                    setError(null);
                    addLog('info', 'Worker ready');
                    break;

                case 'error':
                    if (!data.messageId) {
                        setError(data.data as string);
                        setStatus('error');
                    }
                    addLog('error', 'Worker error', { error: data.data });
                    break;

                case 'debug':
                    if (typeof data.data === 'object' && data.data !== null) {
                        const debugData = data.data as {
                            level: DebugContextValue['level'];
                            message: string;
                            details?: unknown;
                        };
                        addLog(debugData.level, debugData.message, debugData.details);
                    }
                    break;
            }
        };

        worker.current?.addEventListener('message', messageHandler);
        return () => worker.current?.removeEventListener('message', messageHandler);
    }, [addLog]);

    return {
        status,
        error,
        initializeWorker,
        generateResponse,
        sendContextCommand
    };
}
