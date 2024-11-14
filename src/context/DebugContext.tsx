import React, { createContext, useContext, useState, useCallback } from 'react';
import type {
    DebugContextValue,
    DebugContextState,
    DebugLevel,
    DebugLog
} from '../types';

const DebugContext = createContext<DebugContextValue | null>(null);

interface DebugProviderProps {
    children: React.ReactNode;
}

export const DEBUG_LEVELS: Record<string, DebugLevel> = {
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error',
    DEBUG: 'debug'
} as const;

export function DebugProvider({ children }: DebugProviderProps): JSX.Element {
    const [state, setState] = useState<DebugContextState>(() => ({
        isDebugMode: localStorage.getItem('debugMode') === 'true',
        logs: [],
        isDebugPanelOpen: false
    }));

    // Add timestamp and ID to each log
    const addLog = useCallback((level: DebugLevel, message: string, details: unknown = null): void => {
        const log: DebugLog = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            level,
            message,
            details
        };

        setState(prev => ({
            ...prev,
            logs: [...prev.logs, log]
        }));

        // Console styling for different log levels
        const consoleStyles: Record<DebugLevel, string> = {
            info: 'color: #2196F3',
            warn: 'color: #FF9800',
            error: 'color: #F44336',
            debug: 'color: #4CAF50'
        };

        // Log to console with appropriate styling
        console.log(
            `%c[${level.toUpperCase()}] ${message}`,
            consoleStyles[level] || '',
            details || ''
        );
    }, []);

    const clearLogs = useCallback((): void => {
        setState(prev => ({
            ...prev,
            logs: []
        }));
    }, []);

    const toggleDebugMode = useCallback((): void => {
        setState(prev => {
            const newIsDebugMode = !prev.isDebugMode;
            localStorage.setItem('debugMode', String(newIsDebugMode));
            return {
                ...prev,
                isDebugMode: newIsDebugMode
            };
        });
    }, []);

    const setIsDebugPanelOpen = useCallback((isOpen: boolean): void => {
        setState(prev => ({
            ...prev,
            isDebugPanelOpen: isOpen
        }));
    }, []);

    const value: DebugContextValue = {
        isDebugMode: state.isDebugMode,
        logs: state.logs,
        isDebugPanelOpen: state.isDebugPanelOpen,
        toggleDebugMode,
        addLog,
        clearLogs,
        setIsDebugPanelOpen
    };

    return (
        <DebugContext.Provider value={value}>
            {children}
        </DebugContext.Provider>
    );
}

export function useDebug(): DebugContextValue {
    const context = useContext(DebugContext);
    if (!context) {
        throw new Error('useDebug must be used within a DebugProvider');
    }
    return context;
}

// Type guard for checking if an unknown error is an Error instance
export function isError(error: unknown): error is Error {
    return error instanceof Error;
}

// Helper function to format error messages
export function formatError(error: unknown): string {
    if (isError(error)) {
        return error.message;
    }
    return String(error);
}

// Helper function to get log level color
export function getLogLevelColor(level: DebugLevel): string {
    const colors: Record<DebugLevel, string> = {
        info: 'text-blue-600',
        warn: 'text-yellow-600',
        error: 'text-red-600',
        debug: 'text-green-600'
    };
    return colors[level] || colors.info;
}

// Helper function to format timestamp
export function formatTimestamp(timestamp: string): string {
    try {
        return new Date(timestamp).toLocaleTimeString();
    } catch (error) {
        console.error('Invalid timestamp:', error);
        return timestamp;
    }
}

// Helper function to format log details
export function formatLogDetails(details: unknown): string {
    if (!details) return '';

    try {
        if (typeof details === 'object') {
            return JSON.stringify(details, null, 2);
        }
        return String(details);
    } catch (error) {
        console.error('Error formatting log details:', error);
        return String(details);
    }
}

// Utility function to limit log history
export function limitLogs(logs: DebugLog[], maxLogs: number = 1000): DebugLog[] {
    if (logs.length <= maxLogs) return logs;
    return logs.slice(-maxLogs);
}
