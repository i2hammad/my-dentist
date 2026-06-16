import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { IconContext } from '@phosphor-icons/react';
import { AuthProvider } from './lib/auth.jsx';
import { FeedbackProvider } from './components/feedback.jsx';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* Default all Phosphor icons to filled weight to match the design. */}
    <IconContext.Provider value={{ weight: 'fill' }}>
      <BrowserRouter>
        <AuthProvider>
          <FeedbackProvider>
            <App />
          </FeedbackProvider>
        </AuthProvider>
      </BrowserRouter>
    </IconContext.Provider>
  </React.StrictMode>
);
