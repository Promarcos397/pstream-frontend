import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { GlobalProvider } from './context/GlobalContext';
import { TitleProvider } from './context/TitleContext';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';
import './i18n';


const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <TitleProvider>
    <GlobalProvider>
      <ErrorBoundary>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <App />
        </BrowserRouter>
      </ErrorBoundary>
    </GlobalProvider>
  </TitleProvider>
);

// Register Service Worker for Media Background Interceptor
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(registration => {
            console.log('[SW] Registered with scope:', registration.scope);
        }).catch(err => {
            console.error('[SW] Registration failed:', err);
        });
    });
}
