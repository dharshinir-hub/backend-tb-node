// index.js or main.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

import { BrowserRouter } from 'react-router-dom';
import { UserDetailsProvider } from './app/Shared/context/UserDetailsContext';
import * as Sentry from '@sentry/react';
import posthog from 'posthog-js';

// The benign "ResizeObserver loop completed with undelivered notifications" warning
// (fired by ReactFlow's canvas size tracking) is harmless but the CRA dev overlay
// surfaces it as an error. Patch ResizeObserver to run its callback inside rAF so the
// synchronous loop never triggers the warning, and swallow it as a belt-and-braces.
if (typeof window !== 'undefined' && window.ResizeObserver) {
  const NativeRO = window.ResizeObserver;
  window.ResizeObserver = class extends NativeRO {
    constructor(callback) {
      super((entries, observer) => {
        window.requestAnimationFrame(() => { callback(entries, observer); });
      });
    }
  };
}
const __silenceResizeObserver = (e) => {
  const msg = (e && (e.message || (e.reason && e.reason.message))) || '';
  if (/ResizeObserver loop (limit exceeded|completed)/.test(msg)) {
    e.stopImmediatePropagation();
    return false;
  }
  return undefined;
};
window.addEventListener('error', __silenceResizeObserver);

const env = window._env_ || {};
const hostname = window.location.hostname;
const isProd = hostname === 'smart.yantra24x7.com';
const sentryEnv = isProd ? 'production' : 'development';

if (env.SENTRY_DSN && env.SENTRY_DSN !== 'REPLACE_WITH_YOUR_SENTRY_DSN') {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: sentryEnv,
    sendDefaultPii: true,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: isProd ? 0.2 : 1.0,
    tracePropagationTargets: [
      'localhost',
      /^http:\/\/smart\.yantra24x7\.com/,
      /^http:\/\/yantra24x7\.cloud/,
    ],
    replaysSessionSampleRate: isProd ? 0.1 : 1.0,
    replaysOnErrorSampleRate: 1.0,
  });
}

if (env.POSTHOG_KEY && env.POSTHOG_KEY !== 'REPLACE_WITH_YOUR_POSTHOG_KEY') {
  posthog.init(env.POSTHOG_KEY, {
    api_host: 'https://app.posthog.com',
    autocapture: true,
    capture_pageview: true,
    session_idle_timeout_seconds: 3600, // end session after 1 hour idle (matches your app's auto-logout)
    session_recording: {
      sample_rate: isProd ? 0.1 : 1.0,
    },
    loaded: (ph) => {
      if (!isProd) {
        ph.opt_out_capturing();
      }
    },
  });
}

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
