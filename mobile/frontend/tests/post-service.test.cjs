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
  await assert.rejects(service.loadPosts('test-token'), /接続先が設定されていません/);
  await assert.rejects(service.createPost({ message: 'test', latitude: 35, longitude: 139, is_published: true }, 'test-token'),
    /接続先が設定されていません/);
});

test('existing list and create endpoints and form fields are preserved', async (t) => {
  const calls = [];
  const post = { id: 1, message: 'test', image: null, latitude: 35, longitude: 139, is_published: true, created_at: '2026-11-05T00:00:00Z' };
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    return Response.json(options.body ? post : [], { status: options.body ? 201 : 200 });
  });
  const service = await loadService('http://localhost:9999/');
  assert.deepEqual(await service.loadPosts('test-token'), []);
  assert.deepEqual(await service.createPost({ message: 'test', latitude: 35, longitude: 139, is_published: true }, 'test-token'), post);
  assert.equal(calls[0].url, 'http://localhost:9999/api/posts/');
  assert.equal(calls[1].url, calls[0].url);
  assert.equal(calls[1].options.method, 'POST');
  assert.equal(calls[1].options.headers.Authorization, 'Bearer test-token');
  assert.equal(calls[1].options.headers['Content-Type'], undefined);
  assert.deepEqual(Object.fromEntries(calls[1].options.body.entries()), {
    latitude: '35.0000000', longitude: '139.0000000', is_published: 'true', message: 'test',
  });
});

test('public list uses the authenticated API without sending device coordinates', async (t) => {
  const service = await loadService('http://localhost:9999');
  const post = { id: 7, message: 'public', image: null, latitude: 35, longitude: 139, is_published: true, created_at: '2026-11-05T00:00:00Z' };
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'http://localhost:9999/api/posts/public/');
    assert.equal(options.method, 'GET');
    assert.deepEqual(options.headers, { Authorization: 'Bearer test-token' });
    assert.equal(options.body, undefined);
    return Response.json([post]);
  });
  assert.deepEqual(await service.loadPublicPosts('test-token'), [post]);
});

test('delete accepts an empty 204 and distinguishes permission and uncertain results', async (t) => {
  const service = await loadService('http://localhost:9999');
  let response = new Response(null, { status: 204 });
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'http://localhost:9999/api/posts/7/');
    assert.equal(options.method, 'DELETE');
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    assert.equal(options.body, undefined);
    if (response instanceof Error) throw response;
    return response;
  });
  await service.deletePost(7, 'test-token');
  response = Response.json({ detail: 'Not found' }, { status: 404 });
  await assert.rejects(service.deletePost(7, 'test-token'), error => error.status === 404);
  response = Response.json({ detail: '写真を削除できませんでした' }, { status: 503 });
  await assert.rejects(service.deletePost(7, 'test-token'), /写真を削除できませんでした/);
  response = Response.json({ ok: true });
  await assert.rejects(service.deletePost(7, 'test-token'), /削除結果を確認できませんでした/);
  response = new TypeError('Network error');
  await assert.rejects(service.deletePost(7, 'test-token'), /削除結果を確認できませんでした/);
});

test('older posts with empty coordinates and publication status can be opened', async (t) => {
  const service = await loadService('http://localhost:9999');
  const post = { id: 7, message: 'legacy', image: null, latitude: null, longitude: null, is_published: null, created_at: '2026-11-05T00:00:00Z' };
  t.mock.method(globalThis, 'fetch', async (url) => Response.json(url.endsWith('/7/') ? post : [post]));
  assert.deepEqual(await service.loadPosts('test-token'), [post]);
  assert.deepEqual(await service.getPostById(7, 'test-token'), post);
});

test('native photo is attached as a file descriptor and detail uses the configured API', async (t) => {
  const parts = [];
  const post = { id: 2, message: '', image: 'https://untrusted.invalid/photo', latitude: 35, longitude: 139, is_published: false, created_at: '2026-11-05T00:00:00Z' };
  const originalFormData = globalThis.FormData;
  t.after(() => { globalThis.FormData = originalFormData; });
  globalThis.FormData = class { append(name, value) { parts.push([name, value]); } };
  let calledUrl;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calledUrl = url;
    return Response.json(post, { status: options.body ? 201 : 200 });
  });
  const service = await loadService('http://localhost:9999');
  await service.createPost({ image: 'file:///camera.png', imageFileName: 'camera.png', imageMimeType: 'image/png',
    latitude: 35, longitude: 139, is_published: false }, 'test-token');
  assert.deepEqual(parts.find(([name]) => name === 'image')[1], { uri: 'file:///camera.png', name: 'camera.png', type: 'image/png' });
  const detail = await service.getPostById(2, 'test-token');
  assert.equal(calledUrl, 'http://localhost:9999/api/posts/2/');
  assert.equal(detail.image, 'http://localhost:9999/api/posts/2/image/');
});

test('missing auth, invalid responses and server validation errors never report success', async (t) => {
  let response;
  t.mock.method(globalThis, 'fetch', async () => response);
  const service = await loadService('http://localhost:9999');
  await assert.rejects(service.loadPosts(''), error => error.status === 401);
  for (const data of [null, {}, { id: 1 }, { id: 1, latitude: 'bad' }]) {
    response = Response.json(data);
    await assert.rejects(service.getPostById(1, 'test-token'), service.PostApiError);
  }
  response = Response.json({ message: ['入力内容を確認してください'] }, { status: 400 });
  await assert.rejects(service.createPost({ message: 'test', latitude: 35, longitude: 139, is_published: true }, 'test-token'),
    error => error.status === 400 && error.message.includes('入力内容'));
  response = new Response('not json', { status: 201 });
  await assert.rejects(service.createPost({ message: 'test', latitude: 35, longitude: 139, is_published: true }, 'test-token'), service.PostApiError);
});
