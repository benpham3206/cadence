/**
 * Theme application.
 *
 * Themes are pure CSS custom-property sets in tokens.css. Switching one is a
 * single attribute write, so there is nothing to re-render and no flash.
 */

export const THEMES = ['cadence', 'serika', 'nord', 'gruvbox', 'paper'];

export const DEFAULT_THEME = 'cadence';

/**
 * @param {string} theme
 * @returns {string} the theme actually applied
 */
export function applyTheme(theme) {
  const resolved = THEMES.includes(theme) ? theme : DEFAULT_THEME;
  document.documentElement.setAttribute('data-theme', resolved);

  // Keep the browser chrome in step with the page on mobile.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    if (bg) meta.setAttribute('content', bg);
  }

  return resolved;
}
