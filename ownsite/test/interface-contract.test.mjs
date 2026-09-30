import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const html = readFileSync(resolve(root, 'public/index.html'), 'utf8');
const css = readFileSync(resolve(root, 'public/styles.css'), 'utf8');
const app = readFileSync(resolve(root, 'public/app.js'), 'utf8');

test('page keeps a keyboard skip target and contains no visitor data form', () => {
  assert.match(html, /class="skip" href="#work-content"/);
  assert.match(html, /<main id="work-content" tabindex="-1">/);
  assert.doesNotMatch(html, /<(form|input|textarea|select)\b/i);
});

test('reduced-motion rules cover CSS transitions and scripted catalogue scrolling', () => {
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css, /scroll-behavior:auto/);
  assert.match(css, /transition-duration:\.01ms!important/);
  assert.match(app, /prefers-reduced-motion: reduce/);
  assert.match(app, /'instant' : 'smooth'/);
});

test('tablet layout switches to the readable single-column composition', () => {
  assert.match(css, /@media\(max-width:820px\)/);
  assert.match(css, /\.hero-grid\{display:flex;flex-direction:column/);
});
