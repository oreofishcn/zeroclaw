import test from 'node:test';
import assert from 'node:assert/strict';

import {
  THEME_STORAGE_KEY,
  normalizeTheme,
  resolveInitialTheme,
} from '../src/lib/theme.js';

test('theme storage key is stable', () => {
  assert.equal(THEME_STORAGE_KEY, 'zeroclaw-theme');
});

test('normalizeTheme accepts explicit light and dark values', () => {
  assert.equal(normalizeTheme('light'), 'light');
  assert.equal(normalizeTheme('dark'), 'dark');
});

test('normalizeTheme rejects unsupported values', () => {
  assert.equal(normalizeTheme('system'), null);
  assert.equal(normalizeTheme(''), null);
  assert.equal(normalizeTheme(undefined), null);
});

test('resolveInitialTheme prefers stored theme over system preference', () => {
  assert.equal(resolveInitialTheme('light', false), 'light');
  assert.equal(resolveInitialTheme('dark', true), 'dark');
});

test('resolveInitialTheme falls back to system preference and defaults to dark', () => {
  assert.equal(resolveInitialTheme(null, true), 'light');
  assert.equal(resolveInitialTheme(null, false), 'dark');
  assert.equal(resolveInitialTheme('invalid', false), 'dark');
});
