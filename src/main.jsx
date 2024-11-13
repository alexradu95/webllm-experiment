import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import LoadingFallback from './components/LoadingFallback';

ReactDOM.createRoot(document.getElementById('root')).render(
    <Suspense fallback={<LoadingFallback />}>
        <App />
    </Suspense>
);
