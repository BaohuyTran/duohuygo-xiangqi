import { describe, expect, it } from 'vitest';
import type { Exercise } from '../types';
import { contentHash, hashInput, sha256Hex, type TextLookup } from './hash';

const item = {
  type: 'move',
  id: 'b05l2-04',
  version: 2,
  status: 'reviewed',
  source: { kind: 'authored' },
  side: 'red',
  pieces: { e0: 'K', d9: 'k', h2: 'R' },
  prompt: 'u1l2.e2',
  goal: { kind: 'checkmate' },
  solution: { from: 'h2', to: 'h9' },
  explanation: 'u1l2.x2',
} as unknown as Exercise;

const texts =
  (en: string, vi: string): TextLookup =>
  (key) =>
    key === 'u1l2.e2' ? { en, vi } : key === 'u1l2.x2' ? { en: 'Why', vi: 'Tại sao' } : undefined;

describe('sha256Hex', () => {
  it('matches the FIPS 180-4 test vectors', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    );
  });

  it('agrees with Web Crypto on multi-block and non-ASCII input', async () => {
    for (const text of ['a'.repeat(1000), 'Tướng đỏ ở e0 — 帥', 'x'.repeat(55), 'y'.repeat(56), 'z'.repeat(64)]) {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
      expect(sha256Hex(text), text.slice(0, 10)).toBe(hex);
    }
  });
});

describe('contentHash', () => {
  const lookup = texts('Mate in one', 'Chiếu hết một nước');
  const base = contentHash(item, lookup);

  it('ignores status and key order', () => {
    expect(contentHash({ ...item, status: 'published' } as Exercise, lookup)).toBe(base);
    const reordered = Object.fromEntries(Object.entries(item).reverse()) as unknown as Exercise;
    expect(contentHash(reordered, lookup)).toBe(base);
  });

  it('changes with the position, the answer, the version and either language', () => {
    expect(contentHash({ ...item, pieces: { e0: 'K', d9: 'k', h3: 'R' } } as Exercise, lookup)).not.toBe(base);
    expect(contentHash({ ...item, solution: { from: 'h2', to: 'h8' } } as Exercise, lookup)).not.toBe(base);
    expect(contentHash({ ...item, version: 3 } as Exercise, lookup)).not.toBe(base);
    expect(contentHash(item, texts('Mate in one!', 'Chiếu hết một nước'))).not.toBe(base);
    expect(contentHash(item, texts('Mate in one', 'Chiếu hết'))).not.toBe(base);
  });

  it('includes the en and vi text of every i18n key the item uses', () => {
    const input = hashInput(item, lookup);
    expect(input).toContain('["u1l2.e2","Mate in one","Chiếu hết một nước"]');
    expect(input).toContain('["u1l2.x2","Why","Tại sao"]');
    expect(input).not.toContain('reviewed');
  });

  it('uses the real messages by default', () => {
    expect(hashInput(item)).toMatch(/\["u1l2\.e2","[^"]+","[^"]+"\]/);
    expect(contentHash(item)).toMatch(/^[0-9a-f]{64}$/);
  });
});
