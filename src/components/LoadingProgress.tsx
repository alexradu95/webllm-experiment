import React from 'react';
import { Loader2 } from 'lucide-react';
import type { ChatStatus } from '@/types';

interface LoadingProgressProps {
    status: ChatStatus;
    error: string | null;
}

export function LoadingProgress({ status, error }: LoadingProgressProps): JSX.Element | null {
    if (status !== 'loading') return null;

    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
                <div className="flex flex-col items-center text-center">
                    {/* Loading Animation */}
                    <div className="relative w-24 h-24 mb-6">
                        {/* Outer rotating ring */}
                        <div className="absolute inset-0 border-4 border-blue-100 rounded-full" />
                        <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin" />

                        {/* Inner icon */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                        </div>
                    </div>

                    {/* Loading Text */}
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">
                        Loading Llama Model
                    </h2>
                    <p className="text-gray-500 mb-6">
                        This may take a few moments...
                    </p>

                    {/* Progress Pulse Bar */}
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full w-full animate-pulse" />
                    </div>

                    {/* Loading Tips */}
                    <div className="mt-6 text-sm text-gray-500">
                        <p className="animate-pulse">Initializing WebGPU and loading model weights...</p>
                    </div>

                    {/* Error Message if any */}
                    {error && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg w-full">
                            <p className="text-sm text-red-600">{error}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
