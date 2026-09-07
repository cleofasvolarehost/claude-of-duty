import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PlayerName, sanitizeName } from '../export/web/player-name.js';

function fakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

test('empty and junk names fall back to YOU', () => {
  assert.equal(sanitizeName(''), 'YOU');
  assert.equal(sanitizeName('   '), 'YOU');
  assert.equal(sanitizeName('***'), 'YOU');
  assert.equal(sanitizeName(null), 'YOU');
});

test('callsigns are trimmed, uppercased, and capped at 16 characters', () => {
  assert.equal(sanitizeName('  cleo  '), 'CLEO');
  assert.equal(sanitizeName('cleo_99'), 'CLEO_99');
  assert.equal(sanitizeName('hello world'), 'HELLO WORLD');
  assert.equal(sanitizeName('very-long-callsign-here'), 'VERY-LONG-CALLSI');
});

test('PlayerName persists to storage and reloads', () => {
  const storage = fakeStorage();
  const first = new PlayerName({ storage });
  assert.equal(first.display, 'YOU');
  assert.equal(first.set('Corsair'), 'CORSAIR');
  assert.equal(first.display, 'CORSAIR');

  const returning = new PlayerName({ storage });
  assert.equal(returning.display, 'CORSAIR');
});

test('blocked storage still returns a usable name', () => {
  const storage = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
  };
  const name = new PlayerName({ storage });
  assert.equal(name.display, 'YOU');
  assert.equal(name.set('Ada'), 'ADA');
  assert.equal(name.display, 'ADA');
});
