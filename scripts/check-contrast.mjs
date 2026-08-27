/**
 * WCAG AA contrast check for the design tokens in app/globals.css.
 *
 * The Design Direction says "check it, don't eyeball it" — this is that check.
 * Run after any colour change: node scripts/check-contrast.mjs
 */
import fs from 'node:fs';

const css = fs.readFileSync('app/globals.css', 'utf8');

function themeVars(selector) {
  const block = css.split(selector)[1]?.split('}')[0] ?? '';
  const vars = {};
  for (const m of block.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})/g)) {
    vars[m[1]] = m[2];
  }
  return vars;
}

const themes = {
  dark: themeVars('[data-theme="dark"] {'),
  light: themeVars('[data-theme="light"] {'),
};

const srgb = (c) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  return (
    0.2126 * srgb((n >> 16) & 255) +
    0.7152 * srgb((n >> 8) & 255) +
    0.0722 * srgb(n & 255)
  );
}

function ratio(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** [foreground, background, label, minimum] — 4.5 for text, 3.0 for UI edges. */
const PAIRS = [
  ['ink', 'canvas', 'body text on page', 4.5],
  ['ink', 'card', 'body text on card', 4.5],
  ['ink', 'raised', 'body text on raised', 4.5],
  ['ink-muted', 'canvas', 'secondary on page', 4.5],
  ['ink-muted', 'card', 'secondary on card', 4.5],
  ['ink-muted', 'raised', 'secondary on raised', 4.5],
  ['ink-faint', 'canvas', 'meta on page', 4.5],
  ['ink-faint', 'card', 'meta on card', 4.5],
  ['ink-faint', 'raised', 'meta on raised', 4.5],
  ['accent-ink', 'accent', 'label on accent button', 4.5],
  ['accent-text', 'canvas', 'accent text on page', 4.5],
  ['accent-text', 'card', 'accent text on card', 4.5],
  ['ok', 'ok-soft', 'success pill', 4.5],
  ['danger', 'danger-soft', 'danger pill', 4.5],
  ['warn', 'warn-soft', 'warning pill', 4.5],
  ['info', 'info-soft', 'info pill', 4.5],
  ['sell', 'sell-soft', 'sell pill', 4.5],
  ['buy', 'buy-soft', 'buy pill', 4.5],
  ['ok', 'card', 'success text on card', 4.5],
  ['danger', 'card', 'danger text on card', 4.5],
  ['warn', 'card', 'warning text on card', 4.5],
  ['info', 'card', 'info text on card', 4.5],
  ['sell', 'card', 'sell text on card', 4.5],
  ['buy', 'card', 'buy text on card', 4.5],
  ['focus-ring', 'canvas', 'focus ring on page', 3.0],
  ['focus-ring', 'card', 'focus ring on card', 3.0],
  ['line-strong', 'card', 'strong border on card', 3.0],
];

let failures = 0;
for (const [theme, vars] of Object.entries(themes)) {
  console.log(`\n${theme.toUpperCase()}`);
  console.log('-'.repeat(62));
  for (const [fg, bg, label, min] of PAIRS) {
    if (!vars[fg] || !vars[bg]) {
      console.log(`  MISSING  ${label} (${fg} / ${bg})`);
      failures++;
      continue;
    }
    const r = ratio(vars[fg], vars[bg]);
    const pass = r >= min;
    if (!pass) failures++;
    console.log(
      `  ${pass ? 'PASS' : 'FAIL'}  ${r.toFixed(2).padStart(5)}:1  (min ${min})  ${label}`,
    );
  }
}

console.log(
  `\n${failures === 0 ? 'All pairs clear WCAG AA.' : `${failures} pair(s) below the minimum.`}`,
);
process.exit(failures === 0 ? 0 : 1);
