import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import * as THREE from 'three';
import { deserializeCollisionWorld } from '../export/web/collision-world.js';
import { PlayerController } from '../export/web/player-controller.js';

test('capsule stops at a wall without gaining launch velocity', () => {
  const world = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.BoxGeometry(2000, 1, 2000));
  floor.position.y = -0.5;
  const wall = new THREE.Mesh(new THREE.BoxGeometry(2000, 120, 1));
  wall.position.set(0, 60, -50);
  world.add(floor, wall);
  world.updateWorldMatrix(true, true);

  const camera = new THREE.PerspectiveCamera();
  const player = new PlayerController(camera, world, {
    spawn: new THREE.Vector3(0, 0.2, 0),
    moveSpeed: 300,
    sprintSpeed: 450,
    gravity: 980,
  });

  let groundedFrames = 0;
  for (let i = 0; i < 360; i += 1) {
    player.update(1 / 120, { forward: true, strafe: 0.35 });
    if (i >= 240 && player.isGrounded) groundedFrames += 1;
    assert.ok(Number.isFinite(player.velocity.length()));
    assert.ok(
      player.velocity.length() < 500,
      `unexpected launch speed ${player.velocity.length()} at frame ${i}; ` +
        `velocity=${player.velocity.toArray()} feet=${player.feetPosition.toArray()}`,
    );
  }

  assert.ok(
    groundedFrames >= 100,
    `grounding was unstable: ${groundedFrames}/120 frames; ` +
      `feet=${player.feetPosition.toArray()} velocity=${player.velocity.toArray()}`,
  );
  assert.ok(Math.abs(player.feetPosition.y) < 1, `capsule left floor: y=${player.feetPosition.y}`);
  assert.ok(player.feetPosition.z > -35, `capsule crossed wall: z=${player.feetPosition.z}`);
  assert.ok(Math.abs(player.feetPosition.x) < 1000, `wall slide diverged: x=${player.feetPosition.x}`);
});

// The ladder prop is 27 wide, 140 tall and 5 deep, matching the baked Hijacked
// volumes.  The roof it serves sits below the top of the rails, as it does on
// the map, so topping out is a step over the lip rather than a clean landing.
const LADDER_TOP = 140;
const LADDER_Z = -50;
const ROOF_Y = 120;

function ladderWorld() {
  const world = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.BoxGeometry(2000, 1, 2000));
  floor.position.y = -0.5;
  const ladder = new THREE.Mesh(new THREE.BoxGeometry(27, LADDER_TOP, 5));
  ladder.position.set(0, LADDER_TOP / 2, LADDER_Z);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(400, 10, 150));
  roof.position.set(0, ROOF_Y - 5, LADDER_Z - 2.5 - 75);
  world.add(floor, ladder, roof);
  world.updateWorldMatrix(true, true);
  return world;
}

const LADDER_VOLUME = {
  name: 'test_ladder',
  center: [0, LADDER_TOP / 2, LADDER_Z],
  right: [1, 0, 0],
  normal: [0, 0, 1],
  halfWidth: 13.5,
  halfDepth: 2.5,
  bottom: 0,
  top: LADDER_TOP,
};

function ladderPlayer(options = {}) {
  const camera = new THREE.PerspectiveCamera();
  return new PlayerController(camera, ladderWorld(), {
    spawn: new THREE.Vector3(0, 0.2, LADDER_Z + 25),
    ladders: [LADDER_VOLUME],
    ...options,
  });
}

/** Run frames at 120 Hz, stopping early once `until` is satisfied. */
function run(player, seconds, input, until = null) {
  const frames = Math.round(seconds * 120);
  for (let i = 0; i < frames; i += 1) {
    player.update(1 / 120, input);
    if (until && until(player)) return i / 120;
  }
  return seconds;
}

test('walking into a ladder climbs it and steps off at the top', () => {
  const player = ladderPlayer();
  // The camera looks down -Z by default, straight at the ladder face.
  run(player, 0.3, { forward: true });
  assert.ok(player.isOnLadder, 'player did not mount the ladder');
  const mountedAt = player.feetPosition.y;

  run(player, 0.5, { forward: true });
  assert.ok(
    player.feetPosition.y > mountedAt + 50,
    `climb stalled: rose ${player.feetPosition.y - mountedAt} in half a second`,
  );

  run(player, 3, { forward: true }, (p) => !p.isOnLadder);
  assert.equal(player.isOnLadder, false, 'player never left the ladder at the top');

  // Release the stick so the player settles instead of sprinting off the roof.
  run(player, 2, {});
  assert.ok(
    Math.abs(player.feetPosition.y - ROOF_Y) < 4,
    `did not land on the roof: y=${player.feetPosition.y}`,
  );
  assert.ok(
    player.feetPosition.z < LADDER_Z - 2.5,
    `stepped off on the climbing side: z=${player.feetPosition.z}`,
  );
  assert.ok(player.isGrounded, 'player is not standing on the roof');
});

test('backing down a ladder returns to the floor and lets go', () => {
  const player = ladderPlayer();
  run(player, 0.5, { forward: true });
  assert.ok(player.isOnLadder, 'player did not mount the ladder');
  assert.ok(player.feetPosition.y > 40, `expected to be up the ladder: y=${player.feetPosition.y}`);

  // Still facing the ladder, so pulling back off the face descends.
  run(player, 3, { backward: true }, (p) => !p.isOnLadder);
  assert.equal(player.isOnLadder, false, 'player never reached the bottom');

  run(player, 0.5, {});
  assert.ok(Math.abs(player.feetPosition.y) < 1, `did not settle on the floor: y=${player.feetPosition.y}`);
});

test('jumping off a ladder pushes clear of the face', () => {
  const player = ladderPlayer();
  run(player, 0.5, { forward: true });
  assert.ok(player.isOnLadder, 'player did not mount the ladder');
  const z = player.feetPosition.z;

  player.update(1 / 120, { forward: true, jumpPressed: true });
  assert.equal(player.isOnLadder, false, 'jump did not release the ladder');
  assert.ok(player.velocity.y > 0, `jump gave no lift: vy=${player.velocity.y}`);

  run(player, 0.2, {});
  assert.ok(player.feetPosition.z > z + 10, `did not push away from the ladder: z=${player.feetPosition.z}`);
});

test('strafing past a ladder does not grab it', () => {
  const player = ladderPlayer();
  run(player, 1, { strafe: 1 });
  assert.equal(player.isOnLadder, false, 'brushing past the ladder mounted it');
  assert.ok(Math.abs(player.feetPosition.y) < 1, `left the floor: y=${player.feetPosition.y}`);
});

test('a climb blocked by geometry lets go instead of hanging', () => {
  // One of the Hijacked ladders can be mounted from the face that is bolted to
  // the map, where the climb has nowhere to go.
  const world = ladderWorld();
  const overhang = new THREE.Mesh(new THREE.BoxGeometry(200, 20, 40));
  overhang.position.set(0, 110, LADDER_Z + 18.5);
  world.add(overhang);
  world.updateWorldMatrix(true, true);

  const camera = new THREE.PerspectiveCamera();
  const player = new PlayerController(camera, world, {
    spawn: new THREE.Vector3(0, 0.2, LADDER_Z + 25),
    ladders: [LADDER_VOLUME],
  });

  run(player, 0.3, { forward: true });
  assert.ok(player.isOnLadder, 'player did not mount the ladder');

  const releasedAfter = run(player, 3, { forward: true }, (p) => !p.isOnLadder);
  assert.equal(player.isOnLadder, false, 'player hung on a ladder it could not climb');
  assert.ok(releasedAfter < 1, `took ${releasedAfter}s to give up on a blocked climb`);
  assert.ok(
    player.feetPosition.y < 40,
    `expected to be stopped under the overhang: y=${player.feetPosition.y}`,
  );
});

test('strafing the Hijacked deck does not chatter the eye through the teak', () => {
  const repo = path.join(import.meta.dirname, '..');
  const metadata = JSON.parse(fs.readFileSync(path.join(repo, 'export/web/hijacked_collision_bvh.json'), 'utf8'));
  const file = fs.readFileSync(path.join(repo, 'export/web/hijacked_collision_bvh.bin'));
  const binary = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
  const world = deserializeCollisionWorld(metadata, binary);
  const camera = new THREE.PerspectiveCamera();
  const player = new PlayerController(camera, world, {
    spawn: new THREE.Vector3(2102, 57, 133),
    radius: 16,
    height: 72,
    eyeHeight: 60,
    moveSpeed: 300,
    maxSlopeAngle: 45,
  });

  for (let i = 0; i < 60; i += 1) player.update(1 / 120, {});
  let previous = player.position.y;
  let maxStep = 0;
  const eyes = [];
  for (let i = 0; i < 360; i += 1) {
    player.update(1 / 120, { strafe: Math.sin(i / 20) });
    const y = player.position.y;
    maxStep = Math.max(maxStep, Math.abs(y - previous));
    eyes.push(y);
    previous = y;
  }
  const span = Math.max(...eyes) - Math.min(...eyes);
  assert.ok(player.isGrounded, 'player left the deck');
  assert.ok(
    maxStep < 0.04,
    `deck chatter ${maxStep.toFixed(3)} in/step would shimmer the floor texture`,
  );
  assert.ok(
    span < 0.08,
    `eye Y wandered ${span.toFixed(3)} while strafing a flat deck patch`,
  );
});

test('ground snap does not embed the capsule in a walkable ramp', () => {
  const angle = THREE.MathUtils.degToRad(15);
  const length = 800;
  const rise = Math.tan(angle) * length;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -200, 0, 0,
    200, 0, 0,
    200, rise, -length,
    -200, 0, 0,
    200, rise, -length,
    -200, rise, -length,
  ], 3));
  geometry.computeVertexNormals();
  const world = new THREE.Group();
  world.add(new THREE.Mesh(geometry));
  world.updateWorldMatrix(true, true);

  const camera = new THREE.PerspectiveCamera();
  const player = new PlayerController(camera, world, {
    spawn: new THREE.Vector3(0, 0.2, -20),
    radius: 16,
    height: 72,
    eyeHeight: 60,
    moveSpeed: 300,
    maxSlopeAngle: 45,
  });

  let minClearance = Infinity;
  let groundedFrames = 0;
  for (let i = 0; i < 180; i += 1) {
    player.update(1 / 120, { forward: true });
    if (!player.isGrounded) continue;
    groundedFrames += 1;
    const hit = player.worldOctree.rayIntersect(
      new THREE.Ray(
        new THREE.Vector3(player.collider.start.x, player.collider.start.y + 8, player.collider.start.z),
        new THREE.Vector3(0, -1, 0),
      ),
    );
    if (!hit) continue;
    const normal = hit.triangle.getNormal(new THREE.Vector3());
    const point = hit.position ?? hit.point;
    minClearance = Math.min(minClearance, player.collider.start.clone().sub(point).dot(normal));
  }

  assert.ok(groundedFrames > 30, `never walked the ramp: grounded ${groundedFrames} frames`);
  assert.ok(
    minClearance >= player.radius - 0.25,
    `snap buried the capsule in the ramp: clearance ${minClearance.toFixed(3)} vs radius ${player.radius}`,
  );
});

test('walking a layered floor does not bounce the eye up and down', () => {
  // Sanity: snap must not disturb a simple octree floor. Hijacked chatter is
  // covered by the real-BVH deck test above.
  const world = new THREE.Group();
  const floorA = new THREE.Mesh(new THREE.BoxGeometry(2000, 1, 2000));
  floorA.position.y = -0.5;
  const floorB = new THREE.Mesh(new THREE.BoxGeometry(2000, 1, 2000));
  floorB.position.y = -0.45;
  world.add(floorA, floorB);
  world.updateWorldMatrix(true, true);

  const camera = new THREE.PerspectiveCamera();
  const player = new PlayerController(camera, world, {
    spawn: new THREE.Vector3(0, 0.2, 0),
    moveSpeed: 300,
  });

  const eyes = [];
  for (let i = 0; i < 360; i += 1) {
    player.update(1 / 120, { forward: true });
    if (i >= 120) eyes.push(player.position.y);
  }
  const span = Math.max(...eyes) - Math.min(...eyes);
  assert.ok(player.isGrounded, 'player left the floor');
  assert.ok(
    span < 0.2,
    `camera Y jittered by ${span.toFixed(3)} while walking a layered floor; ` +
      `y=${player.position.y} feet=${player.feetPosition.y}`,
  );
});

test('without ladder volumes the prop is just a wall', () => {
  const camera = new THREE.PerspectiveCamera();
  const player = new PlayerController(camera, ladderWorld(), {
    spawn: new THREE.Vector3(0, 0.2, LADDER_Z + 25),
  });
  run(player, 3, { forward: true });
  assert.equal(player.isOnLadder, false);
  assert.ok(Math.abs(player.feetPosition.y) < 1, `climbed without a volume: y=${player.feetPosition.y}`);
});
