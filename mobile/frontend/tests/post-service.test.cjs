const assert = require('node:assert/strict');
const test = require('node:test');
const { pathToFileURL } = require('node:url');
let loadCount = 0;

async function loadService(url) {
  if (url === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
  else process.env.EXPO_PUBLIC_API_BASE_URL = url;
  const path = require.resolve('../src/posts/postService.ts');
  return import(pathToFileURL(path).href + '?case=' + (++loadCount));
}

test('loading the form service without an API URL does not crash; actual requests fail clearly', async (t) => {
  t.mock.method(console, 'error', () => {});
  t.mock.method(globalThis, 'fetch', async () => assert.fail('No request without configuration'));
  const service = await loadService(undefined);
  await assert.rejects(service.loadPosts(), /接続先が設定されていません/);
  await assert.rejects(service.createPost({ message: 'test', latitude: 35, longitude: 139, is_published: true }),
    /接続先が設定されていません/);
});

test('existing list and create endpoints and form fields are preserved', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    return Response.json(options ? { id: 1 } : []);
  });
  const service = await loadService('http://localhost:9999/');
  assert.deepEqual(await service.loadPosts(), []);
  assert.deepEqual(await service.createPost({ message: 'test', latitude: 35, longitude: 139, is_published: true }), { id: 1 });
  assert.equal(calls[0].url, 'http://localhost:9999/api/posts/');
  assert.equal(calls[1].url, calls[0].url);
  assert.equal(calls[1].options.method, 'POST');
  assert.deepEqual(Object.fromEntries(calls[1].options.body.entries()), {
    latitude: '35', longitude: '139', is_published: 'true', message: 'test',
  });
});
