import { createContext, useContext, useState, useCallback } from 'react';

const DebugContext = createContext(null);

// Debug levels
export const DEBUG_LEVELS = {
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error',
    DEBUG: 'debug'
};

export function DebugProvider({ children }) {
    const [isDebugMode, setIsDebugMode] = useState(() =>
        localStorage.getItem('debugMode') === 'true'
    );
    const [logs, setLogs] = useState([]);
    const [isDebugPanelOpen, setIsDebugPanelOpen] = useState(false);

    // Add timestamp and ID to each log
    const addLog = useCallback((level, message, details = null) => {
        const log = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            level,
            message,
            details
        };

        setLogs(prev => [...prev, log]);

        // Also log to console with appropriate styling
        const consoleStyles = {
            [DEBUG_LEVELS.INFO]: 'color: #2196F3',
            [DEBUG_LEVELS.WARN]: 'color: #FF9800',
            [DEBUG_LEVELS.ERROR]: 'color: #F44336',
            [DEBUG_LEVELS.DEBUG]: 'color: #4CAF50'
        };

        console.log(
            `%c[${level.toUpperCase()}] ${message}`,
            consoleStyles[level] || '',
            details || ''
        );
    }, []);

    const clearLogs = useCallback(() => {
        setLogs([]);
    }, []);

    const toggleDebugMode = useCallback(() => {
        setIsDebugMode(prev => {
            const newValue = !prev;
            localStorage.setItem('debugMode', String(newValue));
            return newValue;
        });
    }, []);

    const value = {
        isDebugMode,
        toggleDebugMode,
        logs,
        addLog,
        clearLogs,
        isDebugPanelOpen,
        setIsDebugPanelOpen
    };

    return (
        <DebugContext.Provider value={value}>
            {children}
        </DebugContext.Provider>
    );
}

export function useDebug() {
    const context = useContext(DebugContext);
    if (!context) {
        throw new Error('useDebug must be used within a DebugProvider');
    }
    return context;
}
