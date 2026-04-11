export class Zen {
  toggle(rootEl, active) {
    rootEl.classList.toggle('zen-mode', active);
    if (typeof document === 'undefined') return;
    if (active) {
      if (rootEl.requestFullscreen) rootEl.requestFullscreen().catch(() => {});
    } else {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }
}
