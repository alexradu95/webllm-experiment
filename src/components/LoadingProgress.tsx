import React, { useState, useEffect } from 'react';
import { useDebug } from '../context/DebugContext';

export function LoadingProgress({ status, error }) {
    const { logs } = useDebug();
    const [stages, setStages] = useState({
        webgpu: { status: 'pending', progress: 0 },
        tokenizer: { status: 'pending', progress: 0 },
        model: { status: 'pending', progress: 0 }
    });

    // Process debug logs to update stages
    useEffect(() => {
        const loadingLogs = logs.filter(log =>
            log.level === 'info' &&
            log.message.toLowerCase().includes('loading')
        );

        setStages(prev => {
            const newStages = { ...prev };

            loadingLogs.forEach(log => {
                if (log.message.includes('WebGPU')) {
                    newStages.webgpu.status = 'complete';
                    newStages.webgpu.progress = 100;
                }
                if (log.message.includes('tokenizer')) {
                    newStages.tokenizer.status = 'complete';
                    newStages.tokenizer.progress = 100;
                }
                if (log.message.includes('model')) {
                    if (log.message.includes('successfully')) {
                        newStages.model.status = 'complete';
                        newStages.model.progress = 100;
                    } else {
                        newStages.model.status = 'loading';
                        // If we have loading time details, we can estimate progress
                        if (log.details?.loadTimeMs) {
                            const progress = Math.min((log.details.loadTimeMs / 30000) * 100, 99);
                            newStages.model.progress = progress;
                        }
                    }
                }
            });

            return newStages;
        });
    }, [logs]);

    // Only show when loading
    if (status !== 'loading') return null;

    // Calculate overall progress
    const overallProgress = Object.values(stages)
        .reduce((acc, stage) => acc + stage.progress, 0) / Object.keys(stages).length;

    const stageColors = {
        pending: 'bg-gray-200',
        loading: 'bg-blue-500',
        complete: 'bg-green-500'
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full">
                <h2 className="text-xl font-semibold mb-4">Loading Llama Model</h2>

                {/* Overall progress */}
                <div className="mb-6">
                    <div className="flex justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Overall Progress</span>
                        <span className="text-sm text-gray-500">{Math.round(overallProgress)}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-blue-500 transition-all duration-300"
                            style={{ width: `${overallProgress}%` }}
                        />
                    </div>
                </div>

                {/* Individual stages */}
                <div className="space-y-4">
                    {Object.entries(stages).map(([stageName, { status, progress }]) => (
                        <div key={stageName}>
                            <div className="flex justify-between mb-1">
                                <div className="flex items-center">
                                    <span className="text-sm capitalize">{stageName}</span>
                                    {status === 'complete' && (
                                        <svg className="w-4 h-4 ml-2 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                </div>
                                <span className="text-sm text-gray-500">{Math.round(progress)}%</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                    className={`h-full transition-all duration-300 ${stageColors[status]}`}
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Error display */}
                {error && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-600">{error}</p>
                    </div>
                )}

                {/* Debug logs summary */}
                <div className="mt-4 pt-4 border-t">
                    <div className="max-h-32 overflow-y-auto text-xs text-gray-500">
                        {logs.slice(-5).map((log, i) => (
                            <div key={i} className="mb-1">
                                <span className="text-gray-400">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
                                {log.message}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
