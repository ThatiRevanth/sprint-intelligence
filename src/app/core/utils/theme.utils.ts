/**
 * Read a CSS custom property value from the document root.
 * Returns the fallback if the variable is not set.
 */
export function getCssVar(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/** Semantic color getters for use in Chart.js and inline styles */
export const themeColors = {
  get primary()   { return getCssVar('--si-primary', '#0078d4'); },
  get success()   { return getCssVar('--si-success', '#107c10'); },
  get warning()   { return getCssVar('--si-warning', '#ff8c00'); },
  get danger()    { return getCssVar('--si-danger', '#e81123'); },
  get surface()   { return getCssVar('--si-surface', '#ffffff'); },
  get bg()        { return getCssVar('--si-bg', '#f5f5f5'); },
  get textPrimary()   { return getCssVar('--si-text-primary', '#333333'); },
  get textSecondary() { return getCssVar('--si-text-secondary', '#666666'); },
  get textDisabled()  { return getCssVar('--si-text-disabled', '#999999'); },
  get border()    { return getCssVar('--si-border', '#e0e0e0'); },
  get borderLight() { return getCssVar('--si-border-light', '#f0f0f0'); },
};

/** Semantic colors for well-known work item states */
const SEMANTIC_STATE_COLORS: Record<string, string> = {
  'Done': '#107c10',
  'Closed': '#498205',
  'Blocked': '#e81123',
  'In Progress': '#ff8c00',
  'Removed': '#999999',
};

/** Deterministic hash of a string to a number in [0, 1) */
function hashToUnit(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  return (((hash % 360) + 360) % 360) / 360;
}

/**
 * Get a unique, deterministic color for a work item state.
 * Known states get semantic colors; unknown states get a
 * vibrant, evenly distributed HSL-based color.
 */
export function stateColor(state: string): string {
  if (SEMANTIC_STATE_COLORS[state]) return SEMANTIC_STATE_COLORS[state];
  const hue = Math.round(hashToUnit(state) * 360);
  return `hsl(${hue}, 65%, 45%)`;
}
