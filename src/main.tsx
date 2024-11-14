import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.js';
import './styles.css';
import LoadingFallback from './components/LoadingFallback.tsx';

ReactDOM.createRoot(document.getElementById('root')).render(
    <Suspense fallback={<LoadingFallback />}>
        <App />
    </Suspense>
);
