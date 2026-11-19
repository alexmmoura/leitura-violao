import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './ui/App';
import { isNativeApp } from './data/appUpdate';
import './ui/styles.css';

// Service worker só existe no build de produção; no `npm run dev` isto não faz nada.
// No app Android (.apk) os arquivos já vêm dentro do aplicativo: não precisa dele.
if (!isNativeApp()) registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
