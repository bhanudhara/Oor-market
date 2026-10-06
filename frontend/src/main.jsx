import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import App from './AuthApp.jsx';
import { store } from './store.js';

createRoot(document.getElementById('root')).render(
  <React.StrictMode><Provider store={store}><App /></Provider></React.StrictMode>,
);