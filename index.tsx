import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
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
        <HashRouter>
          <App />
        </HashRouter>
      </ErrorBoundary>
    </GlobalProvider>
  </TitleProvider>
);
