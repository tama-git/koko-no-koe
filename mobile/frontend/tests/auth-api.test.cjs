const assert = require('node:assert/strict');
const test = require('node:test');

// 実通信しない。環境ファイルを読み書きせず、fetchをテストごとに差し替える。
process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:9999/';
const api = require('../src/auth/api.ts');
const credentials = ['user@example.com', 'Example123'];
const registrationId = 'a'.repeat(64);
const operations = {
  'register/start': () => api.startRegistration(...credentials),
  'register/resend': () => api.resendRegistration(credentials[0], registrationId),
  register: () => api.register(credentials[0], registrationId, '012345'),
  login: () => api.login(...credentials),
  logout: () => api.logout('test-token'),
};

test('registration, login and logout requests use the agreed format', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    const operation = url.split('/api/mobile/')[1].slice(0, -1);
    const result = operation === 'login' ? { token: 'test-token' } : { message: '完了', registration_id: registrationId };
    return Response.json(result, { status: operation === 'register' ? 201 : 200 });
  });
  assert.equal(await api.startRegistration(' user@example.com ', 'Example123'), registrationId);
  await api.resendRegistration(credentials[0], registrationId);
  await api.register(credentials[0], registrationId, '012345');
  assert.equal(await api.login(...credentials), 'test-token');
  await api.logout('test-token');
  assert.deepEqual(calls.map(({ url }) => url), Object.keys(operations).map((name) => `http://localhost:9999/api/mobile/${name}/`));
  assert.equal(calls[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].options.body), { email: credentials[0], password: credentials[1] });
  assert.equal(calls[0].options.headers.Authorization, undefined);
  assert.deepEqual(JSON.parse(calls[1].options.body), { email: credentials[0], registration_id: registrationId });
  assert.deepEqual(JSON.parse(calls[2].options.body), { email: credentials[0], registration_id: registrationId, code: '012345' });
  assert.equal(calls[4].options.headers.Authorization, 'Bearer test-token');
  assert.deepEqual(JSON.parse(calls[4].options.body), {});
});

test('malformed successful responses are ApiError for all operations', async (t) => {
  let response;
  t.mock.method(globalThis, 'fetch', async () => response);
  for (const operation of Object.keys(operations)) {
    const field = operation === 'login' ? 'token' : 'message';
    for (const body of ['<html>error</html>', '', 'null', '[]', 'true', '123', '"text"', '{}',
      JSON.stringify({ [field]: 123 }), JSON.stringify({ [field]: '' }), JSON.stringify({ [field]: ' ' })]) {
      response = new Response(body, { status: operation === 'register' ? 201 : 200 });
      await assert.rejects(operations[operation](), (error) => error instanceof api.ApiError &&
        error.message.includes('応答') && error.status === undefined);
    }
    response = new Response('invalid json', { status: 200 });
    await assert.rejects(operations[operation](), api.ApiError);
  }
});

test('registration requires a valid ID that stays the same after resend', async (t) => {
  let id;
  t.mock.method(globalThis, 'fetch', async () => Response.json({ message: '完了', registration_id: id }));
  for (id of [undefined, null, '', 123, 'b'.repeat(63)]) {
    await assert.rejects(operations['register/start'](), api.ApiError);
  }
  id = 'b'.repeat(64);
  await assert.rejects(operations['register/resend'](), api.ApiError);
});

test('unexpected success status is rejected even with otherwise valid JSON', async (t) => {
  let response;
  t.mock.method(globalThis, 'fetch', async () => response);
  for (const operation of Object.keys(operations)) {
    response = Response.json({ token: 'test-token', message: '完了', registration_id: registrationId }, { status: 202 });
    await assert.rejects(operations[operation](), api.ApiError);
  }
});

test('HTTP errors retain status for duplicate registration and expired sessions', async (t) => {
  let response;
  t.mock.method(globalThis, 'fetch', async () => response);
  for (const status of [400, 401, 403, 409, 500]) {
    for (const body of ['null', '[]', '{}', '<html>error</html>', '{"error":"拒否されました"}']) {
      response = new Response(body, { status });
      await assert.rejects(api.logout('test-token'), (error) => error instanceof api.ApiError && error.status === status);
    }
  }
  response = Response.json({ error: '登録済みです' }, { status: 409 });
  await assert.rejects(api.startRegistration(...credentials), (error) => error instanceof api.ApiError &&
    error.status === 409 && error.message === '登録済みです');
});

test('connection failure becomes ApiError', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('network failure'); });
  await assert.rejects(api.login(...credentials), (error) => error instanceof api.ApiError &&
    error.status === undefined && error.message.includes('接続できません'));
});

test('timeout aborts fetch and becomes ApiError', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let signal;
  t.mock.method(globalThis, 'fetch', (_url, options) => {
    signal = options.signal;
    return new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    });
  });
  const rejected = assert.rejects(api.login(...credentials), api.ApiError);
  t.mock.timers.tick(15000);
  await rejected;
  assert.equal(signal.aborted, true);
});
