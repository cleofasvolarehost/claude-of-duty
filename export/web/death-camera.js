import * as THREE from 'three';

const _euler = new THREE.Euler(0, 0, 0, 'YXZ');

// Keep the kill look on the killer without pitching the eye into the deck
// when they are standing on top of the body.
const MAX_PITCH = 0.55;

/**
 * Aim the first-person camera at a killer. Pitch is clamped so a close
 * attacker at torso height cannot bury the view in the floor.
 */
export function aimDeathCamera(camera, eye, target, { maxPitch = MAX_PITCH } = {}) {
  if (!camera || !eye || !target) return camera;
  const dx = target.x - eye.x;
  const dy = target.y - eye.y;
  const dz = target.z - eye.z;
  const horiz = Math.hypot(dx, dz);
  if (horiz < 1e-5 && Math.abs(dy) < 1e-5) return camera;
  const yaw = Math.atan2(-dx, -dz);
  const pitch = THREE.MathUtils.clamp(
    Math.atan2(dy, Math.max(horiz, 1e-4)),
    -maxPitch,
    maxPitch,
  );
  _euler.set(pitch, yaw, 0, 'YXZ');
  camera.quaternion.setFromEuler(_euler);
  return camera;
}

export default aimDeathCamera;
