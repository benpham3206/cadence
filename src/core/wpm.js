const WINDOW_MS = 5000;
const CHARS_PER_WORD = 5;

export function getRollingWpm(timestamps, now) {
  now = now || performance.now();
  const windowed = timestamps.filter(t => t >= now - WINDOW_MS);
  if (windowed.length < 2) return 0;
  const span = (now - windowed[0]) / 60000;
  if (span <= 0) return 0;
  return Math.round((windowed.length / CHARS_PER_WORD) / span);
}
