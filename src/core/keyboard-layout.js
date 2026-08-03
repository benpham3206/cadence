/**
 * US QWERTY layout with standard touch-typing finger assignments.
 *
 * Used by the hand guide to show which finger owns the next character, and by
 * the heatmap to colour keys by the finger responsible for them.
 */

export const FINGER = {
  L_PINKY: 'l-pinky',
  L_RING: 'l-ring',
  L_MIDDLE: 'l-middle',
  L_INDEX: 'l-index',
  L_THUMB: 'l-thumb',
  R_THUMB: 'r-thumb',
  R_INDEX: 'r-index',
  R_MIDDLE: 'r-middle',
  R_RING: 'r-ring',
  R_PINKY: 'r-pinky',
};

export const FINGER_LABELS = {
  [FINGER.L_PINKY]: 'left pinky',
  [FINGER.L_RING]: 'left ring',
  [FINGER.L_MIDDLE]: 'left middle',
  [FINGER.L_INDEX]: 'left index',
  [FINGER.L_THUMB]: 'left thumb',
  [FINGER.R_THUMB]: 'right thumb',
  [FINGER.R_INDEX]: 'right index',
  [FINGER.R_MIDDLE]: 'right middle',
  [FINGER.R_RING]: 'right ring',
  [FINGER.R_PINKY]: 'right pinky',
};

/** Keys whose finger rests on them in home position. */
export const HOME_KEYS = new Set(['a', 's', 'd', 'f', 'j', 'k', 'l', ';']);

const L = FINGER;

/**
 * Physical rows. Each entry is [unshifted, shifted, finger].
 * `width` is expressed in key units for rendering the modifier keys.
 */
export const KEY_ROWS = [
  [
    ['`', '~', L.L_PINKY],
    ['1', '!', L.L_PINKY],
    ['2', '@', L.L_RING],
    ['3', '#', L.L_MIDDLE],
    ['4', '$', L.L_INDEX],
    ['5', '%', L.L_INDEX],
    ['6', '^', L.R_INDEX],
    ['7', '&', L.R_INDEX],
    ['8', '*', L.R_MIDDLE],
    ['9', '(', L.R_RING],
    ['0', ')', L.R_PINKY],
    ['-', '_', L.R_PINKY],
    ['=', '+', L.R_PINKY],
  ],
  [
    ['q', 'Q', L.L_PINKY],
    ['w', 'W', L.L_RING],
    ['e', 'E', L.L_MIDDLE],
    ['r', 'R', L.L_INDEX],
    ['t', 'T', L.L_INDEX],
    ['y', 'Y', L.R_INDEX],
    ['u', 'U', L.R_INDEX],
    ['i', 'I', L.R_MIDDLE],
    ['o', 'O', L.R_RING],
    ['p', 'P', L.R_PINKY],
    ['[', '{', L.R_PINKY],
    [']', '}', L.R_PINKY],
    ['\\', '|', L.R_PINKY],
  ],
  [
    ['a', 'A', L.L_PINKY],
    ['s', 'S', L.L_RING],
    ['d', 'D', L.L_MIDDLE],
    ['f', 'F', L.L_INDEX],
    ['g', 'G', L.L_INDEX],
    ['h', 'H', L.R_INDEX],
    ['j', 'J', L.R_INDEX],
    ['k', 'K', L.R_MIDDLE],
    ['l', 'L', L.R_RING],
    [';', ':', L.R_PINKY],
    ["'", '"', L.R_PINKY],
  ],
  [
    ['z', 'Z', L.L_PINKY],
    ['x', 'X', L.L_RING],
    ['c', 'C', L.L_MIDDLE],
    ['v', 'V', L.L_INDEX],
    ['b', 'B', L.L_INDEX],
    ['n', 'N', L.R_INDEX],
    ['m', 'M', L.R_INDEX],
    [',', '<', L.R_MIDDLE],
    ['.', '>', L.R_RING],
    ['/', '?', L.R_PINKY],
  ],
];

/**
 * @type {Map<string, { key: string, finger: string, shift: boolean, row: number, col: number }>}
 */
const CHAR_INDEX = new Map();

KEY_ROWS.forEach((row, rowIndex) => {
  row.forEach(([lower, upper, finger], colIndex) => {
    CHAR_INDEX.set(lower, { key: lower, finger, shift: false, row: rowIndex, col: colIndex });
    if (upper !== lower) {
      CHAR_INDEX.set(upper, { key: lower, finger, shift: true, row: rowIndex, col: colIndex });
    }
  });
});

CHAR_INDEX.set(' ', { key: ' ', finger: FINGER.R_THUMB, shift: false, row: 4, col: 0 });

/**
 * The shift key is pressed by the pinky opposite the character's own hand,
 * which is the distinction between a trained typist and a fast hunt-and-pecker.
 *
 * @param {string} finger
 * @returns {string} the finger that should hold shift
 */
export function shiftFingerFor(finger) {
  const isLeftHand = finger.startsWith('l-');
  return isLeftHand ? FINGER.R_PINKY : FINGER.L_PINKY;
}

/**
 * Resolves a character to the key and finger that produce it.
 *
 * @param {string} char
 * @returns {{ key: string, finger: string, shift: boolean, row: number, col: number,
 *             shiftFinger: string|null } | null} null when the character is not on the layout.
 */
export function resolveChar(char) {
  if (typeof char !== 'string' || char.length !== 1) return null;
  const entry = CHAR_INDEX.get(char);
  if (!entry) return null;
  return { ...entry, shiftFinger: entry.shift ? shiftFingerFor(entry.finger) : null };
}

/**
 * @param {string} char
 * @returns {string|null}
 */
export function fingerForChar(char) {
  return resolveChar(char)?.finger ?? null;
}

/**
 * True when consecutive characters are struck by the same finger, which forces
 * a lift-and-reposition and is a common source of slow digraphs.
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function isSameFingerBigram(a, b) {
  const fa = fingerForChar(a);
  const fb = fingerForChar(b);
  return fa !== null && fa === fb && a.toLowerCase() !== b.toLowerCase();
}
