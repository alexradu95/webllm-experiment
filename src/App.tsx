import { DebugPanel } from './components/DebugPanel.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { DebugProvider } from './context/DebugContext.tsx';
import AppContent from './components/AppContent.tsx';

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
