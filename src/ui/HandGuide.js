import { KEY_ROWS, FINGER, FINGER_LABELS, HOME_KEYS, resolveChar } from '../core/keyboard-layout.js';

/**
 * Keyboard and hand position guide.
 *
 * The point is not decoration. A typist who reaches 130 WPM with improvised
 * fingering hits a ceiling that no amount of practice moves, because the wrong
 * finger on a key forces a hand shift that costs more than the keystroke saved.
 * This shows the correct finger for the next character, including which pinky
 * should be holding shift.
 */

/**
 * Stylised top-down left hand, mirrored to produce the right.
 *
 * Fingers splay slightly from their knuckles and the palm tapers to a wrist,
 * because a symmetric grid of identical bars reads as a mitten rather than a
 * hand and stops conveying which digit is which.
 */
const HAND_GEOMETRY = {
  palm: 'M36,100 L126,100 L121,147 Q118,161 104,161 L58,161 Q44,161 41,147 Z',
  fingers: [
    { finger: 'pinky', x: 37, y: 64, width: 15, height: 52, rotate: -9 },
    { finger: 'ring', x: 57, y: 44, width: 16, height: 72, rotate: -3 },
    { finger: 'middle', x: 78, y: 38, width: 16, height: 78, rotate: 0 },
    { finger: 'index', x: 99, y: 46, width: 16, height: 70, rotate: 5 },
  ],
  /** The thumb pivots outward from the top of its own base, not the palm centre. */
  thumb: { x: 112, y: 106, width: 17, height: 54, rotate: 44 },
};

const VIEW_WIDTH = 420;
const VIEW_HEIGHT = 176;

/** Extra keys worth drawing so shift usage can be taught. */
const MODIFIERS = {
  0: { after: { label: 'bksp', width: 2, finger: FINGER.R_PINKY } },
  1: { before: { label: 'tab', width: 1.5, finger: FINGER.L_PINKY } },
  2: { before: { label: 'caps', width: 1.75, finger: FINGER.L_PINKY }, after: { label: 'enter', width: 2.25, finger: FINGER.R_PINKY } },
  3: {
    before: { label: 'shift', width: 2.25, finger: FINGER.L_PINKY, id: 'shift-left' },
    after: { label: 'shift', width: 2.75, finger: FINGER.R_PINKY, id: 'shift-right' },
  },
};

export class HandGuide {
  /** @param {HTMLElement} root */
  constructor(root) {
    this.root = root;
    /** @type {Map<string, HTMLElement>} */
    this.keyEls = new Map();
    /** @type {Map<string, SVGElement[]>} */
    this.fingerEls = new Map();
    /** @type {HTMLElement[]} */
    this.activeKeys = [];
    /** @type {SVGElement[]} */
    this.activeFingers = [];

    root.innerHTML = `
      <div class="guide">
        <div class="guide__keyboard" id="guide-keyboard">${this._keyboardMarkup()}</div>
        <div class="guide__hands-wrap">
          <svg class="guide__hands" viewBox="0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}" aria-hidden="true">
            ${this._handMarkup('l')}
            ${this._handMarkup('r')}
          </svg>
          <p class="guide__hint" id="guide-hint"></p>
        </div>
      </div>
    `;

    root.querySelectorAll('[data-key]').forEach((el) => {
      this.keyEls.set(/** @type {string} */ (el.getAttribute('data-key')), /** @type {HTMLElement} */ (el));
    });

    root.querySelectorAll('[data-finger]').forEach((el) => {
      const finger = /** @type {string} */ (el.getAttribute('data-finger'));
      if (!(el instanceof SVGElement)) return;
      const list = this.fingerEls.get(finger) ?? [];
      list.push(el);
      this.fingerEls.set(finger, list);
    });

    this.hintEl = /** @type {HTMLElement} */ (root.querySelector('#guide-hint'));
  }

  _keyboardMarkup() {
    return KEY_ROWS.map((row, rowIndex) => {
      const mods = MODIFIERS[rowIndex] ?? {};
      const keys = row
        .map(
          ([lower, upper, finger]) =>
            `<span class="key${HOME_KEYS.has(lower) ? ' key--home' : ''}" data-key="${escapeAttr(lower)}"
                   data-finger-key="${finger}">
               <span class="key__shifted">${escapeHtml(upper === lower ? '' : upper)}</span>
               <span class="key__base">${escapeHtml(lower)}</span>
             </span>`
        )
        .join('');

      const before = mods.before ? this._modifierMarkup(mods.before) : '';
      const after = mods.after ? this._modifierMarkup(mods.after) : '';
      return `<div class="key-row">${before}${keys}${after}</div>`;
    })
      .join('') +
      `<div class="key-row">
         <span class="key key--mod" style="--w:5" data-key=" " data-finger-key="${FINGER.R_THUMB}">space</span>
       </div>`;
  }

  /**
   * @param {{ label: string, width: number, finger: string, id?: string }} mod
   */
  _modifierMarkup(mod) {
    const key = mod.id ?? mod.label;
    return `<span class="key key--mod" style="--w:${mod.width}" data-key="${escapeAttr(key)}"
                  data-finger-key="${mod.finger}">${escapeHtml(mod.label)}</span>`;
  }

  /**
   * @param {'l'|'r'} side
   */
  _handMarkup(side) {
    const { palm, fingers, thumb } = HAND_GEOMETRY;
    const mirror = side === 'r' ? ` transform="translate(${VIEW_WIDTH},0) scale(-1,1)"` : '';

    const fingerShapes = fingers
      .map((f) => {
        // Rotate about the knuckle so the fingertip fans out and the base stays
        // anchored to the palm.
        const pivotX = f.x + f.width / 2;
        const pivotY = f.y + f.height;
        return `<rect class="hand__part" data-finger="${side}-${f.finger}" x="${f.x}" y="${f.y}"
                      width="${f.width}" height="${f.height}" rx="${f.width / 2}"
                      transform="rotate(${f.rotate} ${pivotX} ${pivotY})" />`;
      })
      .join('');

    return `<g class="hand hand--${side}"${mirror}>
      <path class="hand__palm" d="${palm}" />
      ${fingerShapes}
      <rect class="hand__part" data-finger="${side}-thumb" x="${thumb.x}" y="${thumb.y}"
            width="${thumb.width}" height="${thumb.height}" rx="${thumb.width / 2}"
            transform="rotate(${thumb.rotate} ${thumb.x + thumb.width / 2} ${thumb.y})" />
    </g>`;
  }

  /**
   * Highlights the key and finger for the next character to be typed.
   *
   * @param {string|null} char
   */
  setNextChar(char) {
    this._clearHighlights();
    if (!char) {
      this.hintEl.textContent = '';
      return;
    }

    const resolved = resolveChar(char);
    if (!resolved) {
      this.hintEl.textContent = '';
      return;
    }

    this._highlightKey(resolved.key, 'key--next');
    this._highlightFinger(resolved.finger);

    if (resolved.shiftFinger) {
      const shiftKey = resolved.shiftFinger === FINGER.L_PINKY ? 'shift-left' : 'shift-right';
      this._highlightKey(shiftKey, 'key--next-mod');
      this._highlightFinger(resolved.shiftFinger);
      this.hintEl.textContent = `${FINGER_LABELS[resolved.finger]} + ${FINGER_LABELS[resolved.shiftFinger]} for shift`;
    } else {
      this.hintEl.textContent = FINGER_LABELS[resolved.finger] ?? '';
    }
  }

  /**
   * @param {string} key
   * @param {string} className
   */
  _highlightKey(key, className) {
    const el = this.keyEls.get(key);
    if (!el) return;
    el.classList.add(className);
    this.activeKeys.push(el);
  }

  /** @param {string} finger */
  _highlightFinger(finger) {
    const els = this.fingerEls.get(this._svgFingerName(finger));
    if (!els) return;
    for (const el of els) {
      el.classList.add('hand__part--active');
      el.setAttribute('data-active-finger', finger);
      this.activeFingers.push(el);
    }
  }

  /**
   * Maps layout finger ids onto the SVG's naming, which uses the anatomical
   * name rather than the row position.
   *
   * @param {string} finger
   */
  _svgFingerName(finger) {
    return finger;
  }

  _clearHighlights() {
    for (const el of this.activeKeys) el.classList.remove('key--next', 'key--next-mod');
    for (const el of this.activeFingers) {
      el.classList.remove('hand__part--active');
      el.removeAttribute('data-active-finger');
    }
    this.activeKeys = [];
    this.activeFingers = [];
  }

  /**
   * Briefly flashes a key when it is struck, so mistakes register visually.
   *
   * @param {string} char
   * @param {boolean} correct
   */
  flashKey(char, correct) {
    const resolved = resolveChar(char);
    if (!resolved) return;
    const el = this.keyEls.get(resolved.key);
    if (!el) return;

    const className = correct ? 'key--hit' : 'key--miss';
    el.classList.remove(className);
    // Reading offsetWidth restarts the CSS animation on rapid repeats.
    void el.offsetWidth;
    el.classList.add(className);
    setTimeout(() => el.classList.remove(className), 220);
  }

  /** @param {boolean} visible */
  setVisible(visible) {
    this.root.classList.toggle('guide-host--hidden', !visible);
  }
}

/** @param {string} v */
function escapeHtml(v) {
  return v.replace(/[&<>"']/g, (ch) =>
    ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch === '"' ? '&quot;' : '&#39;'
  );
}

/** @param {string} v */
function escapeAttr(v) {
  return escapeHtml(v);
}
