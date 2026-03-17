export const THEME_STORAGE_KEY = 'zeroclaw-theme';

export function normalizeTheme(value) {
  if (value === 'light' || value === 'dark') {
    return value;
  }
  return null;
}

export function resolveInitialTheme(storedTheme, prefersLight) {
  const normalized = normalizeTheme(storedTheme);
  if (normalized) {
    return normalized;
  }
  return prefersLight ? 'light' : 'dark';
}
