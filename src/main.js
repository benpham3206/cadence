import './styles/tokens.css';
import './styles/base.css';
import './styles/app.css';
import './styles/animations.css';

import { App } from './app/App.js';

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Silent fail — app works without SW
    });
  });
}

const app = new App(document.getElementById('app'));
app.mount();
