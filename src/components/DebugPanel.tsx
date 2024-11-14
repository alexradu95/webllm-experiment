import React from 'react';
import { useDebug, getLogLevelColor, formatTimestamp, formatLogDetails } from '../context/DebugContext.tsx';
import type { FC } from 'react';

interface DebugPanelContentProps {
    clearLogs: () => void;
    setIsDebugPanelOpen: (isOpen: boolean) => void;
}

const DebugPanelContent: FC<DebugPanelContentProps> = ({
                                                           clearLogs,
                                                           setIsDebugPanelOpen
                                                       }) => (
    <div className="flex items-center justify-between p-2 bg-gray-100 border-b">
        <div className="flex items-center space-x-2">
            <h3 className="font-semibold">Debug Panel</h3>
        </div>
        <div className="flex items-center space-x-2">
            <button
                onClick={clearLogs}
                className="px-2 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
            >
                Clear
            </button>
            <button
                onClick={() => setIsDebugPanelOpen(false)}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
                aria-label="Close debug panel"
            >
                ↓
            </button>
        </div>
    </div>
);

interface DebugLogEntryProps {
    timestamp: string;
    level: string;
    message: string;
    details?: unknown;
}

const DebugLogEntry: FC<DebugLogEntryProps> = ({
                                                   timestamp,
                                                   level,
                                                   message,
                                                   details
                                               }) => (
    <div className="mb-2 text-sm">
        <div className="flex items-start">
      <span className="text-gray-500 mr-2">
        {formatTimestamp(timestamp)}
      </span>
            <span className={`font-medium ${getLogLevelColor(level as any)}`}>
        [{level.toUpperCase()}]
      </span>
            <span className="ml-2">{message}</span>
        </div>
        {details && (
            <pre className="ml-6 mt-1 text-xs bg-gray-100 p-1 rounded overflow-auto">
        {formatLogDetails(details)}
      </pre>
        )}
    </div>
);

export const DebugPanel: FC = () => {
    const {
        isDebugMode,
        toggleDebugMode,
        logs,
        clearLogs,
        isDebugPanelOpen,
        setIsDebugPanelOpen
    } = useDebug();

    if (!isDebugMode) return null;

    return (
        <div
            className={`fixed bottom-0 right-0 w-full md:w-1/2 lg:w-1/3 bg-white border-l border-t 
        shadow-lg transition-transform duration-300 ${
                isDebugPanelOpen ? 'translate-y-0' : 'translate-y-full'
            }`}
        >
            <DebugPanelContent
                clearLogs={clearLogs}
                setIsDebugPanelOpen={setIsDebugPanelOpen}
            />

            <div className="h-64 overflow-auto p-2 bg-gray-50">
                {logs.map(log => (
                    <DebugLogEntry
                        key={log.id}
                        timestamp={log.timestamp}
                        level={log.level}
                        message={log.message}
                        details={log.details}
                    />
                ))}
            </div>

            {!isDebugPanelOpen && (
                <button
                    onClick={() => setIsDebugPanelOpen(true)}
                    className="absolute -top-8 right-4 px-4 py-1 bg-gray-100 border border-b-0
            rounded-t hover:bg-gray-200 transition-colors"
                >
                    Debug
                </button>
            )}
        </div>
    );
};
