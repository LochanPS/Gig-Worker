import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './lib/auth.js';
import { MetaProvider } from './lib/meta.js';
import App from './App.js';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <MetaProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MetaProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
