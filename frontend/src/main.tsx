import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Intercept all fetch requests to write logs of API calls in the browser console
const originalFetch = window.fetch;
window.fetch = async function (input, init) {
  const url = typeof input === 'string' ? input : (input as any).url || '';
  const method = init?.method || 'GET';
  console.log(`%c[Frontend Fetch Log] Calling URL: ${url} [%c${method}%c]`, 'color: #3b82f6; font-weight: bold;', 'color: #ec4899; font-weight: bold;', 'color: inherit;', {
    headers: init?.headers,
    body: init?.body ? JSON.parse(init.body as string) : null
  });
  
  try {
    const response = await originalFetch(input, init);
    console.log(`%c[Frontend Fetch Log] Response Status: ${response.status} for URL: ${url}`, response.ok ? 'color: #10b981; font-weight: bold;' : 'color: #ef4444; font-weight: bold;');
    return response;
  } catch (error) {
    console.error(`%c[Frontend Fetch Log] Failed to connect to URL: ${url}`, 'color: #ef4444; font-weight: bold;', error);
    throw error;
  }
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
