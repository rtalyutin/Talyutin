import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { openDatabase } from '../db.mjs';
import { createHandler } from '../server.mjs';

test('Blender GLB is self-contained and satisfies the physical HTML screen contract', () => {
  const bytes = readFileSync(new URL('../public/assets/rt-phone.glb', import.meta.url));
  assert.equal(bytes.subarray(0, 4).toString(), 'glTF');
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  assert.equal(bytes.readUInt32LE(16), 0x4e4f534a);
  const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  const root = gltf.nodes.find(node => node.name === 'RT_Phone');
  const screen = gltf.nodes.find(node => node.name === 'Screen');
  assert.ok(root && screen);
  assert.equal(root.extras.width, 3.6); assert.equal(root.extras.height, 7.5);
  assert.equal(root.extras.screenZ, .228);
  assert.equal(root.extras.screenWidth, 3.33); assert.equal(root.extras.screenHeight, 7.15);
  assert.deepEqual(screen.translation.map(value => Math.round(value * 1000) / 1000), [0, 0, .222]);
  assert.ok(bytes.length < 500000);
  assert.ok(gltf.nodes.some(node => node.name === 'USB C recessed port'));
  assert.ok(gltf.nodes.some(node => node.name === 'Camera 3 optical glass'));
  assert.ok(gltf.nodes.every(node => !node.camera && !/^Cube$/.test(node.name)));
  assert.ok(gltf.buffers.every(buffer => !buffer.uri));
  assert.equal((gltf.images || []).length, 0);
});

test('global model and viewer remain available when YCS is hidden, while its poster is revoked', async () => {
  const database = openDatabase(':memory:');
  database.prepare('UPDATE works SET show = 0 WHERE slug = ?').run('ycs');
  const server = createServer(createHandler(database));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  try {
    const model = await fetch(origin + '/assets/rt-phone.glb');
    assert.equal(model.status, 200);
    assert.equal(model.headers.get('content-type'), 'model/gltf-binary');
    assert.deepEqual(Buffer.from(await model.arrayBuffer()), readFileSync(new URL('../public/assets/rt-phone.glb', import.meta.url)));
    const viewer = await fetch(origin + '/phone-viewer.js');
    assert.equal(viewer.status, 200); assert.match(viewer.headers.get('content-type'), /text\/javascript/);
    assert.equal((await fetch(origin + '/assets/ycs-backdrop.jpg')).status, 404);
    assert.equal((await fetch(origin + '/models/phone/rt-phone.blend')).status, 404);
    assert.equal((await fetch(origin + '/client/phone-viewer.js')).status, 404);
    assert.equal((await fetch(origin + '/assets/unknown.glb')).status, 404);
  } finally { await new Promise(resolve => server.close(resolve)); database.close(); }
});
