import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './lib/auth.js';
import { SystemProvider } from './lib/system.js';
import App from './App.js';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        {/* Settlement facts (real vs simulated, chain, explorer) are needed by every
            dashboard that renders a tx hash, so they are fetched once here. */}
        <SystemProvider>
          <App />
        </SystemProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
