import { DebugPanel } from './components/DebugPanel';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DebugProvider } from './context/DebugContext';
import AppContent from './components/AppContent';

export default function App() {
    return (
        <ErrorBoundary>
            <DebugProvider>
                <AppContent />
                <DebugPanel />
            </DebugProvider>
        </ErrorBoundary>
    );
}
