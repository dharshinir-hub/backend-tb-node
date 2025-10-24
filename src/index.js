// index.js or main.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { BrowserRouter } from 'react-router-dom'; // ✅ import this
import { UserDetailsProvider } from './app/Shared/context/UserDetailsContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter> 
    <UserDetailsProvider>
      <App />
    </UserDetailsProvider>
    </BrowserRouter>
  </React.StrictMode>
);
