import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost:3000/',
  pretendToBeVisual: true,
});

(global as any).window = dom.window;
(global as any).document = dom.window.document;
(global as any).navigator = dom.window.navigator;
(global as any).HTMLElement = dom.window.HTMLElement;
(global as any).HTMLInputElement = dom.window.HTMLInputElement;
(global as any).HTMLTextAreaElement = dom.window.HTMLTextAreaElement;
(global as any).HTMLSelectElement = dom.window.HTMLSelectElement;
(global as any).KeyboardEvent = dom.window.KeyboardEvent;
(global as any).MouseEvent = dom.window.MouseEvent;
(global as any).localStorage = dom.window.localStorage;
(global as any).sessionStorage = dom.window.sessionStorage;
(global as any).requestAnimationFrame = (cb: any) => setTimeout(cb, 0);
(global as any).cancelAnimationFrame = (id: any) => clearTimeout(id);

// Mock fetch to hit local express server!
(global as any).fetch = async (url: string, init?: any) => {
  const fullUrl = url.startsWith('http') ? url : `http://localhost:3000${url}`;
  return fetch(fullUrl, init);
};

// Set token for authenticated user in localStorage
dom.window.localStorage.setItem('mirage_session_token', 'test_token');

import React from 'react';
import { createRoot } from 'react-dom/client';
import App from '../src/App';

async function run() {
  console.log('Mounting App in JSDOM...');
  const rootEl = dom.window.document.getElementById('root')!;
  const root = createRoot(rootEl);
  
  // Catch any unhandled errors
  dom.window.addEventListener('error', (event) => {
    console.error('JSDOM window error:', event.error || event.message);
  });
  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
  });

  try {
    root.render(React.createElement(App));
  } catch (e) {
    console.error('Render error:', e);
  }

  // Wait for initial render and data fetch
  await new Promise((r) => setTimeout(r, 1000));
  console.log('Root innerHTML after 1s:', rootEl.innerHTML.slice(0, 300));
}

run().catch(console.error);
