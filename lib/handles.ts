/**
 * Handle comparison for impersonation checks.
 *
 * Lookalike handles are the actual attack: `mirrors_mm` against `mirrorsmm`,
 * `n4dia` against `nadia`, `ju no` against `juno`. A plain equality check tells
 * someone their handle is not on the roster but not that it is a near-miss of
 * one that is — and the near-miss is the dangerous case, because it means
 * somebody built it deliberately.
 */

/**
 * Confusable groups, each collapsed onto one representative character.
 *
 * Grouping matters more than picking the "right" letter: `nad1a` must land on
 * the same skeleton as `nadia`, and `1` reads as either `i` or `l` depending on
 * the font, so the whole `i / l / 1 / | / !` family becomes a single token. The
 * representative is arbitrary — only membership is meaningful.
 */
const CONFUSABLE_GROUPS = [
  'il1|!íìĺ',
  'o0ºóòоσ', // includes Cyrillic o
  's5$ѕ', // includes Cyrillic es
  'a4@áàа', // includes Cyrillic a
  'e3éèе', // includes Cyrillic ie
  'b8',
  't7',
  'g9',
  'z2',
  'cс', // Cyrillic es
  'pр', // Cyrillic er
  'xх', // Cyrillic ha
  'yу', // Cyrillic u
  'kк',
  'nп',
  'uüúù',
];

const CONFUSABLE: Record<string, string> = {};
for (const group of CONFUSABLE_GROUPS) {
  for (const ch of group) CONFUSABLE[ch] = group[0];
}

/** Multi-character shapes that read as a single letter. */
const LIGATURES: [RegExp, string][] = [
  [/rn/g, 'm'],
  [/vv/g, 'w'],
  [/cl/g, 'd'],
];

/**
 * Strip a handle to its skeleton: case, separators, confusable characters and
 * repeated letters all removed, so two handles that would look the same to a
 * person in a hurry collapse to the same string.
 */
export function skeleton(handle: string): string {
  let s = handle.trim().toLowerCase().normalize('NFKC');
  for (const [pattern, replacement] of LIGATURES) s = s.replace(pattern, replacement);
  s = s
    .split('')
    .map((ch) => CONFUSABLE[ch] ?? ch)
    .filter((ch) => /[a-z0-9]/.test(ch))
    .join('');
  // Collapse runs: `sabble` and `sable` are the same handle to a reader.
  return s.replace(/(.)\1+/g, '$1');
}

export type HandleVerdict =
  | { kind: 'empty' }
  /** Exactly this handle is on the roster. */
  | { kind: 'match'; handle: string }
  /** Not on the roster, but it collapses onto one that is — an impersonation
   *  attempt, not a typo, until proven otherwise. */
  | { kind: 'lookalike'; typed: string; real: string }
  /** Not on the roster and not close to anything on it. */
  | { kind: 'absent'; typed: string };

export function checkHandle(typed: string, roster: string[]): HandleVerdict {
  const q = typed.trim();
  if (!q) return { kind: 'empty' };

  const exact = roster.find((r) => r.toLowerCase() === q.toLowerCase());
  if (exact) return { kind: 'match', handle: exact };

  const s = skeleton(q);
  if (s) {
    const near = roster.find((r) => skeleton(r) === s);
    if (near) return { kind: 'lookalike', typed: q, real: near };
  }

  return { kind: 'absent', typed: q };
}
