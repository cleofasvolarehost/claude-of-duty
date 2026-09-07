import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { aimDeathCamera } from '../export/web/death-camera.js';

function pitchFrom(camera) {
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const horiz = Math.hypot(forward.x, forward.z);
  return Math.atan2(forward.y, Math.max(horiz, 1e-8));
}

test('a close killer at eye height does not pitch the death camera into the floor', () => {
  const camera = new THREE.PerspectiveCamera();
  camera.rotation.order = 'YXZ';
  camera.position.set(0, 60, 0);

  aimDeathCamera(camera, camera.position, new THREE.Vector3(8, 61, 3));

  const pitch = pitchFrom(camera);
  assert.ok(Math.abs(pitch) <= 0.55 + 1e-6, `death cam pitched into the deck: ${pitch}`);
});

test('a killer far below cannot bury the view past the pitch clamp', () => {
  const camera = new THREE.PerspectiveCamera();
  camera.rotation.order = 'YXZ';
  camera.position.set(0, 60, 0);

  aimDeathCamera(camera, camera.position, new THREE.Vector3(8, -40, 3));

  const pitch = pitchFrom(camera);
  assert.ok(pitch >= -0.55 - 1e-6, `clamp failed: ${pitch}`);
  assert.ok(pitch < 0, `expected to look down toward a lower killer, got ${pitch}`);
});

test('death camera looks toward the killer on the horizontal', () => {
  const camera = new THREE.PerspectiveCamera();
  camera.rotation.order = 'YXZ';
  camera.position.set(0, 60, 0);
  aimDeathCamera(camera, camera.position, new THREE.Vector3(0, 61, -200));

  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  assert.ok(forward.z < -0.9, `expected to look down -Z, got ${forward.toArray()}`);
  assert.ok(Math.abs(forward.y) < 0.15, `level killer should not tilt the view: y=${forward.y}`);
});

test('missing killer leaves the camera where it was', () => {
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(10, 60, -4);
  camera.quaternion.setFromEuler(new THREE.Euler(-0.2, 1.1, 0, 'YXZ'));
  const quaternion = camera.quaternion.clone();
  aimDeathCamera(camera, camera.position, null);
  assert.deepEqual(camera.quaternion.toArray(), quaternion.toArray());
});
