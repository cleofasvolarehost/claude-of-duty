import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { deathRootPose } from '../export/web/enemy-system.js';

test('the faceplant clip plants the body; death blend does not bury it in the floor', () => {
  // pb_death_faceplant already rotates the authored body onto the navmesh.
  // Extra root roll plus a 10-inch sink drives the torso through the deck.
  const start = deathRootPose(0);
  const end = deathRootPose(1);

  assert.equal(start.rotationZ, 0);
  assert.equal(start.positionY, 0);
  assert.equal(end.rotationZ, 0);
  assert.equal(end.positionY, 0);
  assert.ok(Math.abs(end.rotationZ) < 0.2, `death root roll ${end.rotationZ} would swing the body into the floor`);
  assert.ok(end.positionY > -2, `death root sink ${end.positionY} would bury the corpse`);
});

test('deathRootPose can be applied to a model root without leaving it underground', () => {
  const root = new THREE.Group();
  const pose = deathRootPose(1);
  root.rotation.z = pose.rotationZ;
  root.position.y = pose.positionY;
  assert.equal(root.rotation.z, 0);
  assert.equal(root.position.y, 0);
});
