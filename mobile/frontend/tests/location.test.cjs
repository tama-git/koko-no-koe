const assert = require('node:assert/strict');
const test = require('node:test');
const { requestCurrentLocation } = require('../src/location/locationRequest.ts');

function client(changes = {}) {
  return {
    requestPermission: async () => ({ granted: true, canAskAgain: true }),
    servicesEnabled: async () => true,
    getPosition: async () => ({ coords: { latitude: 35, longitude: 139, accuracy: 100 } }),
    ...changes,
  };
}

test('foreground permission and services are checked before a one-time position request', async () => {
  const calls = [];
  const result = await requestCurrentLocation(client({
    requestPermission: async () => { calls.push('permission'); return { granted: true, canAskAgain: true }; },
    servicesEnabled: async () => { calls.push('services'); return true; },
    getPosition: async () => { calls.push('position'); return { coords: { latitude: 35, longitude: 139, accuracy: 100 } }; },
  }));
  assert.deepEqual(calls, ['permission', 'services', 'position']);
  assert.deepEqual(result, { status: 'ready', coordinates: { latitude: 35, longitude: 139, accuracy: 100 } });
});

test('denial never tries to read a position', async () => {
  for (const canAskAgain of [false, true]) {
    const result = await requestCurrentLocation(client({
      requestPermission: async () => ({ granted: false, canAskAgain }),
      servicesEnabled: async () => assert.fail('services must not be queried'),
      getPosition: async () => assert.fail('position must not be queried'),
    }));
    assert.deepEqual(result, { status: 'denied', canAskAgain });
  }
});

test('disabled services never trigger a position request', async () => {
  assert.deepEqual(await requestCurrentLocation(client({
    servicesEnabled: async () => false,
    getPosition: async () => assert.fail('position must not be queried'),
  })), { status: 'disabled' });
});

test('native errors become a usable error state at every stage', async () => {
  for (const stage of ['requestPermission', 'servicesEnabled', 'getPosition']) {
    assert.deepEqual(await requestCurrentLocation(client({ [stage]: async () => { throw new Error('native failure'); } })),
      { status: 'error' });
  }
});

test('permission prompt has no timeout; position request times out and ignores late results', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let grant;
  let position;
  let completed = false;
  const result = requestCurrentLocation(client({
    requestPermission: () => new Promise(resolve => { grant = resolve; }),
    getPosition: () => new Promise(resolve => { position = resolve; }),
  })).then(value => { completed = true; return value; });
  t.mock.timers.tick(60000);
  await Promise.resolve();
  assert.equal(completed, false);
  grant({ granted: true, canAskAgain: true });
  await Promise.resolve();
  await Promise.resolve();
  t.mock.timers.tick(15000);
  assert.deepEqual(await result, { status: 'timeout' });
  position({ coords: { latitude: 35, longitude: 139, accuracy: 100 } });
  assert.deepEqual(await result, { status: 'timeout' });
});

test('invalid coordinates never reach the map', async () => {
  for (const [latitude, longitude] of [[NaN,139], [91,139], [35,181], [Infinity,139]]) {
    assert.deepEqual(await requestCurrentLocation(client({ getPosition: async () => ({ coords: { latitude, longitude, accuracy: null } }) })),
      { status: 'error' });
  }
});
