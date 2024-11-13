import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

function LoadingFallback() {
    return (
        <div className="h-screen flex items-center justify-center">
            <div className="text-center">
                <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600">Loading application...</p>
            </div>
        </div>
    );
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <Suspense fallback={<LoadingFallback />}>
        <App />
    </Suspense>
);
