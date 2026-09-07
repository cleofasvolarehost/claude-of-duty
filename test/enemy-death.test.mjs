import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deathGroundOffset } from '../export/web/enemy-system.js';

test('a floating faceplant is lowered onto the floor, not rolled through it', () => {
  // Rebased pb_death_faceplant leaves the mesh about 22" above the navmesh.
  // A constant extra roll/sink buried it; this offset only closes the gap.
  const offset = deathGroundOffset(42, 20);
  assert.ok(offset < -2, `expected a downward plant, got ${offset}`);
  assert.ok(offset > -40, `offset ${offset} would drive the torso through the deck`);
  assert.equal(offset, -22);
});

test('a buried pose is lifted back to the floor', () => {
  assert.equal(deathGroundOffset(-19, 20), 39);
});

test('a pose already on the floor is left alone', () => {
  assert.equal(deathGroundOffset(20, 20), 0);
  assert.equal(deathGroundOffset(Number.NaN, 20), 0);
});
