import './styles/tokens.css';
import './styles/base.css';
import './styles/typing.css';
import './styles/keyboard.css';
import './styles/stats.css';
import './styles/app.css';

import { App } from './app/App.js';

const mount = document.getElementById('app');

if (!mount) {
  // Nothing else can run, so say why in the place the user will actually look.
  document.body.textContent = 'Cadence failed to start: no #app element in the document.';
  console.error('[main] internal: mount point #app is missing from index.html');
} else {
  const app = new App(mount);
  app.mount_().catch((err) => {
    console.error('[main] internal: startup failed', err);
    mount.innerHTML = `
      <div style="padding:3rem;font-family:monospace;color:#e2586b">
        Cadence failed to start.<br />
        <span style="color:#888;font-size:.85rem">${String(err?.message ?? err)}</span>
      </div>`;
  });
}
