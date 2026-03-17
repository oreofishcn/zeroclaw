export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY: 'zeroclaw-theme';

export function normalizeTheme(value: unknown): Theme | null;

export function resolveInitialTheme(
  storedTheme: unknown,
  prefersLight: boolean,
): Theme;
