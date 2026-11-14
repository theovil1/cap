/// <reference types="node" />
// Every text the code asks for exists, in French and in English: a missing one
// shows its key on screen ("treadmillSetup.onText").
import fs from 'fs';
import path from 'path';

import en from '../locales/en.json';
import fr from '../locales/fr.json';

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'string' ? [prefix + key] : flatten(value, `${prefix}${key}.`),
  );
}

const PLURALS = /_(zero|one|two|few|many|other)$/;
const keys = {
  fr: new Set(flatten(fr as Tree)),
  en: new Set(flatten(en as Tree)),
};
const has = (set: Set<string>, key: string) =>
  set.has(key) || [...set].some((k) => k.replace(PLURALS, '') === key);

function sources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry: fs.Dirent) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sources(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

const root = path.join(__dirname, '..', '..');
const code = sources(root).map((file) => ({
  file: path.relative(root, file),
  text: fs.readFileSync(file, 'utf8'),
}));
// t('a.b'), i18n.t("a.b"), translate('a.b'); and t(`a.b.${x}`) by its fixed start.
const STATIC = /\b(?:t|translate)\(\s*['"]([A-Za-z0-9_.]+)['"]/g;
const DYNAMIC = /\b(?:t|translate)\(\s*`([A-Za-z0-9_.]+)\.\$\{/g;

describe('translations', () => {
  it('have the same texts in French and English', () => {
    const base = (set: Set<string>) => new Set([...set].map((k) => k.replace(PLURALS, '')));
    const frBase = base(keys.fr);
    const enBase = base(keys.en);
    expect([...frBase].filter((k) => !enBase.has(k))).toEqual([]);
    expect([...enBase].filter((k) => !frBase.has(k))).toEqual([]);
  });

  it('have every text the code uses', () => {
    const missing: string[] = [];
    for (const { file, text } of code) {
      for (const [, key] of text.matchAll(STATIC)) {
        for (const lang of ['fr', 'en'] as const) {
          if (!has(keys[lang], key)) missing.push(`${lang} ${key} (${file})`);
        }
      }
      for (const [, prefix] of text.matchAll(DYNAMIC)) {
        for (const lang of ['fr', 'en'] as const) {
          if (![...keys[lang]].some((k) => k.startsWith(`${prefix}.`))) {
            missing.push(`${lang} ${prefix}.* (${file})`);
          }
        }
      }
    }
    expect([...new Set(missing)]).toEqual([]);
  });
});
