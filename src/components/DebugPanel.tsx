import React from "react";
import { DEBUG_LEVELS, useDebug } from "../context/DebugContext.js";

export function DebugPanel() {
    const {
        isDebugMode,
        toggleDebugMode,
        logs,
        clearLogs,
        isDebugPanelOpen,
        setIsDebugPanelOpen
    } = useDebug();

    if (!isDebugMode) return null;

    const levelColors = {
        [DEBUG_LEVELS.INFO]: 'text-blue-600',
        [DEBUG_LEVELS.WARN]: 'text-yellow-600',
        [DEBUG_LEVELS.ERROR]: 'text-red-600',
        [DEBUG_LEVELS.DEBUG]: 'text-green-600'
    };

    return (
        <div
            className={`fixed bottom-0 right-0 w-full md:w-1/2 lg:w-1/3 bg-white border-l border-t shadow-lg transition-transform duration-300 ${
                isDebugPanelOpen ? 'translate-y-0' : 'translate-y-full'
            }`}
        >
            {/* Debug Panel Header */}
            <div className="flex items-center justify-between p-2 bg-gray-100 border-b">
                <div className="flex items-center space-x-2">
                    <h3 className="font-semibold">Debug Panel</h3>
                    <button
                        onClick={toggleDebugMode}
                        className="px-2 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                        {isDebugMode ? 'Disable Debug' : 'Enable Debug'}
                    </button>
                </div>
                <div className="flex items-center space-x-2">
                    <button
                        onClick={clearLogs}
                        className="px-2 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                    >
                        Clear
                    </button>
                    <button
                        onClick={() => setIsDebugPanelOpen(false)}
                        className="p-1 hover:bg-gray-200 rounded"
                    >
                        ↓
                    </button>
                </div>
            </div>

            {/* Debug Panel Content */}
            <div className="h-64 overflow-auto p-2 bg-gray-50">
                {logs.map(log => (
                    <div key={log.id} className="mb-2 text-sm">
                        <div className="flex items-start">
              <span className="text-gray-500 mr-2">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
                            <span className={`font-medium ${levelColors[log.level]}`}>
                [{log.level.toUpperCase()}]
              </span>
                            <span className="ml-2">{log.message}</span>
                        </div>
                        {log.details && (
                            <pre className="ml-6 mt-1 text-xs bg-gray-100 p-1 rounded">
                {typeof log.details === 'object'
                    ? JSON.stringify(log.details, null, 2)
                    : log.details
                }
              </pre>
                        )}
                    </div>
                ))}
            </div>

            {/* Debug Panel Toggle Button */}
            {!isDebugPanelOpen && (
                <button
                    onClick={() => setIsDebugPanelOpen(true)}
                    className="absolute -top-8 right-4 px-4 py-1 bg-gray-100 border border-b-0 rounded-t"
                >
                    Debug
                </button>
            )}
        </div>
    );
}
