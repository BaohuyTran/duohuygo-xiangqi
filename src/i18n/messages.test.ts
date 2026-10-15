import { describe, expect, it } from 'vitest';
import { messages, translate } from './messages';

describe('i18n messages', () => {
  it('every entry has non-empty English and Vietnamese text with matching placeholders', () => {
    for (const [key, entry] of Object.entries(messages)) {
      expect(entry.en.trim(), key).not.toBe('');
      expect(entry.vi.trim(), key).not.toBe('');
      const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
      expect(vars(entry.vi), key).toEqual(vars(entry.en));
    }
  });

  it('fills placeholders and falls back to the key', () => {
    expect(translate('en', 'home.unit', { n: 3 })).toBe('Unit 3');
    expect(translate('vi', 'home.unit', { n: 3 })).toBe('Chương 3');
    expect(translate('en', 'missing.key')).toBe('missing.key');
  });
});
