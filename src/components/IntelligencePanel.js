import { generateLocalPortrait } from '../core/portrait.js';
import { canShowChunkTransfer } from '../core/ui-logic.js';

export class IntelligencePanel {
  constructor(container, profile, digraphMap, callbacks) {
    this.container = container;
    this.profile = profile;
    this.digraphMap = digraphMap;
    this.callbacks = callbacks;
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="section-label">Intelligence</div>
      <div class="identity-card" style="margin-bottom:20px;line-height:1.6;">
        <div id="identity-text" style="font-family:var(--font-mono);font-size:13px;color:var(--color-text-muted);font-style:italic;">Analyzing form...</div>
      </div>

      <div id="coach-tips"></div>

      <div class="settings-group" style="margin-top:auto;">
        <div class="section-label" style="margin-bottom:10px;">Mode</div>
        <div class="pill-group" style="margin-bottom:var(--space-md);">
          <button class="pill active" id="btn-mode">quote</button>
          <button class="pill" id="btn-zen">zen</button>
        </div>

        <div class="section-label" style="margin-bottom:10px;">AI Settings</div>
        <label class="settings-label">API Key</label>
        <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;">
          <input type="password" class="settings-input" id="input-apikey" placeholder="sk-ant-... (Enter to save)" />
          <button class="btn" id="btn-remove-key" style="display:none">✕</button>
        </div>
        <div id="apikey-status" style="font-size:10px;padding:4px 8px;border-radius:4px;margin-bottom:8px;background:var(--color-surface-2);border:1px solid var(--color-border);color:var(--color-text-muted);">No key set — using local drills</div>

        <label class="settings-label">API Mode</label>
        <select class="settings-input" id="select-api-mode" style="margin-bottom:10px;background:var(--color-surface-2);">
          <option value="auto">Auto (Uses API)</option>
          <option value="manual">Manual (Local Fallback)</option>
        </select>

        <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:10px;">
          <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--color-text-muted);cursor:pointer;">
            <input type="checkbox" id="check-sound" ${this.profile.settings?.soundEnabled ? 'checked' : ''} />
            Sound on error
          </label>
          <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--color-text-muted);cursor:pointer;">
            <input type="checkbox" id="check-ghost" ${this.profile.settings?.ghostEnabled ? 'checked' : ''} />
            Ghost replay
          </label>
          <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--color-text-muted);cursor:pointer;">
            <input type="checkbox" id="check-rhythm" ${this.profile.settings?.rhythmEnabled ? 'checked' : ''} />
            Rhythm pulse
          </label>
          <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--color-text-muted);cursor:pointer;">
            <input type="checkbox" id="check-chunk-nudge" ${this.profile.settings?.chunkNudgeEnabled !== false ? 'checked' : ''} />
            Catch-up nudge
          </label>
        </div>

        <label class="settings-label">AI Processing Log</label>
        <div class="ai-log" id="ai-log" style="height:180px;"></div>

        <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;">
          <button class="btn btn-danger" id="btn-clear">Clear all data</button>
          <button class="btn" id="btn-export">Export</button>
          <button class="btn" id="btn-cinema">Cinema</button>
        </div>
      </div>
    `;

    this.els = {
      identity: document.getElementById('identity-text'),
      coachTips: document.getElementById('coach-tips'),
      aiLog: document.getElementById('ai-log'),
      apiKeyInput: document.getElementById('input-apikey'),
      apiKeyStatus: document.getElementById('apikey-status'),
      removeKeyBtn: document.getElementById('btn-remove-key'),
      apiModeSelect: document.getElementById('select-api-mode'),
      soundCheck: document.getElementById('check-sound'),
      ghostCheck: document.getElementById('check-ghost'),
      rhythmCheck: document.getElementById('check-rhythm'),
      chunkNudgeCheck: document.getElementById('check-chunk-nudge'),
    };

    this.els.apiModeSelect.value = this.profile.apiMode || 'auto';
    this.updateKeyUI();

    document.getElementById('btn-mode').addEventListener('click', this.callbacks.onModeToggle);
    document.getElementById('btn-zen').addEventListener('click', this.callbacks.onZenToggle);
    document.getElementById('btn-clear').addEventListener('click', this.callbacks.onClearData);
    document.getElementById('btn-export').addEventListener('click', () => this.exportProfile());
    const cinemaBtn = document.getElementById('btn-cinema');
    if (cinemaBtn && this.callbacks.onCinema) cinemaBtn.addEventListener('click', this.callbacks.onCinema);
    this.els.apiKeyInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.callbacks.onSaveApiKey(this.els.apiKeyInput.value.trim());
        this.updateKeyUI();
      }
      e.stopPropagation();
    });
    this.els.removeKeyBtn.addEventListener('click', () => {
      this.callbacks.onSaveApiKey('');
      this.updateKeyUI();
    });
    this.els.apiModeSelect.addEventListener('change', (e) => this.callbacks.onApiModeChange(e.target.value));
    this.els.soundCheck.addEventListener('change', (e) => this.callbacks.onSettingChange('soundEnabled', e.target.checked));
    this.els.ghostCheck.addEventListener('change', (e) => this.callbacks.onSettingChange('ghostEnabled', e.target.checked));
    this.els.rhythmCheck.addEventListener('change', (e) => this.callbacks.onSettingChange('rhythmEnabled', e.target.checked));
    this.els.chunkNudgeCheck.addEventListener('change', (e) => this.callbacks.onSettingChange('chunkNudgeEnabled', e.target.checked));

    // Weak digraph clicks delegate from panel-right, but that's in MetricsPanel.
    // We'll wire MetricsPanel click through App callback.
  }

  updateIdentity(profile, weakList) {
    this.els.identity.textContent = generateLocalPortrait(profile, weakList);
  }

  updateMode(mode) {
    const btn = document.getElementById('btn-mode');
    btn.textContent = mode;
    btn.className = mode === 'practice' ? 'pill active-accent' : 'pill active';
  }

  updateChunk(active) {
    // Chunk pill lives in stage header, handled by TypingStage
  }

  updateZen(active) {
    const btn = document.getElementById('btn-zen');
    btn.classList.toggle('active', active);
  }

  updateLogs(logs = []) {
    this.els.aiLog.innerHTML = logs.map(entry => `
      <div class="ai-log-entry ${entry.type}">
        <span class="log-time">${entry.time}</span>${entry.message}
      </div>
    `).join('');
    this.els.aiLog.scrollTop = this.els.aiLog.scrollHeight;
  }

  updateCoachTips(tips) {
    if (!tips || !tips.length) {
      this.els.coachTips.innerHTML = '';
      return;
    }
    this.els.coachTips.innerHTML = tips.map(t => `<div class="coach-tip">${t}</div>`).join('');
  }

  updateKeyUI() {
    if (this.profile.apiKey) {
      const provider = this.profile.apiKey.startsWith('sk-ant-') ? 'Anthropic' : this.profile.apiKey.startsWith('sk-') ? 'OpenAI' : 'Unknown';
      const masked = this.profile.apiKey.slice(0, 7) + '···' + this.profile.apiKey.slice(-4);
      this.els.apiKeyStatus.textContent = `✓ ${provider} key active: ${masked}`;
      this.els.apiKeyStatus.style.cssText = 'font-size:10px;padding:4px 8px;border-radius:4px;margin-bottom:8px;color:var(--color-accent);background:rgba(0,208,132,0.08);border:1px solid rgba(0,208,132,0.15);';
      this.els.apiKeyInput.value = '';
      this.els.apiKeyInput.placeholder = 'Key saved — paste new key to replace';
      this.els.removeKeyBtn.style.display = '';
    } else {
      this.els.apiKeyStatus.textContent = 'No key set — using local drills';
      this.els.apiKeyStatus.style.cssText = 'font-size:10px;padding:4px 8px;border-radius:4px;margin-bottom:8px;background:var(--color-surface-2);border:1px solid var(--color-border);color:var(--color-text-muted);';
      this.els.apiKeyInput.value = '';
      this.els.apiKeyInput.placeholder = 'sk-ant-... or sk-... (press Enter to save)';
      this.els.removeKeyBtn.style.display = 'none';
    }
  }

  exportProfile() {
    const json = JSON.stringify(this.profile, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cadence-profile-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
