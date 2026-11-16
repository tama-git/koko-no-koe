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

test('public feed sends viewer coordinates when supplied and returns pins separately', async (t) => {
  const service = await loadService('http://localhost:9999');
  const post = { id: 7, message: 'public', image: null, latitude: 35, longitude: 139, is_published: true, created_at: '2026-11-05T00:00:00Z' };
  const pins = [{ id: 7, latitude: 35, longitude: 139 }, { id: 8, latitude: 36, longitude: 139 }];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'http://localhost:9999/api/posts/public/');
    assert.equal(options.method, 'GET');
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.body, undefined);
    const latitude = options.headers['X-Viewer-Latitude'];
    const longitude = options.headers['X-Viewer-Longitude'];
    assert.deepEqual([latitude, longitude], latitude === undefined ? [undefined, undefined] : ['35', '139']);
    return Response.json({ pins, posts: latitude === undefined ? [] : [post] });
  });
  assert.deepEqual(await service.loadPublicPosts('test-token'), { pins, posts: [] });
  assert.deepEqual(await service.loadPublicPosts('test-token', { latitude: 35, longitude: 139 }), { pins, posts: [post] });
});

test('visibility update sends a JSON boolean and checks the saved setting', async (t) => {
  const service = await loadService('http://localhost:9999');
  let response = Response.json({ is_published: false });
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'http://localhost:9999/api/posts/7/visibility/');
    assert.equal(options.method, 'PATCH');
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    assert.equal(options.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(options.body), { is_published: false });
    return response;
  });
  await service.updatePostVisibility(7, 'test-token', false);
  response = Response.json({ is_published: true });
  await assert.rejects(service.updatePostVisibility(7, 'test-token', false), /選択した公開設定と一致しません/);
  response = Response.json({ detail: '管理者により非表示のため、公開設定を変更できません。' }, { status: 403 });
  await assert.rejects(service.updatePostVisibility(7, 'test-token', false), error => error.status === 403);
});

test('visibility changes work in both directions and distinguish transport and invalid responses', async (t) => {
  const service = await loadService('http://localhost:9999');
  let reply;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    if (reply instanceof Error) throw reply;
    return reply ?? Response.json(JSON.parse(options.body));
  });
  for (const choice of [true, false]) {
    reply = undefined;
    await service.updatePostVisibility(7, 'test-token', choice);
    reply = new TypeError('Network request failed');
    await assert.rejects(service.updatePostVisibility(7, 'test-token', choice), /通信が途切れました/);
    for (const status of [200, 404, 500]) {
      reply = new Response('<html>not JSON</html>', { status });
      await assert.rejects(service.updatePostVisibility(7, 'test-token', choice),
        error => error.status === status && error.message.includes(`HTTP ${status}`));
    }
    for (const value of [null, {}, { is_published: String(choice) }, { is_published: !choice }]) {
      reply = Response.json(value);
      await assert.rejects(service.updatePostVisibility(7, 'test-token', choice), /選択した公開設定と一致しません/);
    }
  }
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

test('photo is attached as a named multipart file and detail uses the configured API', async (t) => {
  const post = { id: 2, message: '', image: 'https://untrusted.invalid/photo', latitude: 35, longitude: 139, is_published: false, created_at: '2026-11-05T00:00:00Z' };
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    if (url === 'file:///camera.png') {
      return new Response('camera bytes', { headers: { 'Content-Type': 'image/png' } });
    }
    return Response.json(post, { status: options.method === 'POST' ? 201 : 200 });
  });
  const service = await loadService('http://localhost:9999');
  await service.createPost({ image: 'file:///camera.png', imageFileName: 'camera.png', imageMimeType: 'image/png',
    latitude: 35, longitude: 139, is_published: false }, 'test-token');

  assert.deepEqual(calls.map(call => call.url), ['file:///camera.png', 'http://localhost:9999/api/posts/']);
  const file = calls[1].options.body.get('image');
  assert.equal(file.name, 'camera.png');
  assert.equal(file.type, 'image/png');
  assert.equal(await file.text(), 'camera bytes');

  const detail = await service.getPostById(2, 'test-token');
  assert.equal(calls[2].url, 'http://localhost:9999/api/posts/2/');
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

test('detail, image and thumbnail use their own viewer coordinates and bypass cached responses', async (t) => {
  const calls = [];
  const post = { id: 7, message: 'public', image: 'https://example.com/photo', latitude: 35,
    longitude: 139, is_published: true, created_at: '2026-11-05T00:00:00Z' };
  const service = await loadService('http://localhost:9999');
  const reader = class {
    readAsDataURL(blob) {
      assert.equal(blob.type, 'image/jpeg');
      this.result = 'data:image/jpeg;base64,dGVzdA==';
      this.onload();
    }
  };
  const previousReader = Object.getOwnPropertyDescriptor(globalThis, 'FileReader');
  Object.defineProperty(globalThis, 'FileReader', { value: reader, configurable: true });
  t.after(() => {
    if (previousReader) Object.defineProperty(globalThis, 'FileReader', previousReader);
    else delete globalThis.FileReader;
  });
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('image/') || url.endsWith('thumbnail/')) {
      return options.headers['X-Viewer-Latitude'] === '36'
        ? Response.json({ detail: 'Not found' }, { status: 404 })
        : new Response('test', { headers: { 'Content-Type': 'image/jpeg' } });
    }
    return Response.json(post);
  });

  await service.getPostById(7, 'token');
  await service.getPostById(7, 'token', { latitude: 35, longitude: 139 });
  assert.equal(await service.getPostImage(7, 'token', { latitude: 35.0001, longitude: 139 }),
    'data:image/jpeg;base64,dGVzdA==');
  await assert.rejects(service.getPostImage(7, 'token', { latitude: 36, longitude: 139 }),
    error => error instanceof service.PostApiError && error.status === 404);
  assert.equal(await service.getPostImage(7, 'token'), 'data:image/jpeg;base64,dGVzdA==');
  assert.equal(await service.getPostThumbnail(7, 'token', { latitude: 35.0001, longitude: 139 }),
    'data:image/jpeg;base64,dGVzdA==');
  await assert.rejects(service.getPostThumbnail(7, 'token', { latitude: 36, longitude: 139 }),
    error => error instanceof service.PostApiError && error.status === 404);
  assert.equal(await service.getPostThumbnail(7, 'token'), 'data:image/jpeg;base64,dGVzdA==');

  assert.deepEqual(calls.map(({ url }) => url), [
    'http://localhost:9999/api/posts/7/', 'http://localhost:9999/api/posts/7/',
    ...Array(3).fill('http://localhost:9999/api/posts/7/image/'),
    ...Array(3).fill('http://localhost:9999/api/posts/7/thumbnail/'),
  ]);
  assert.deepEqual(calls.map(({ options }) => options.headers['X-Viewer-Latitude']),
    [undefined, '35', '35.0001', '36', undefined, '35.0001', '36', undefined]);
  assert.deepEqual(calls.map(({ options }) => options.headers['X-Viewer-Longitude']),
    [undefined, '139', '139', '139', undefined, '139', '139', undefined]);
  for (const { options } of calls) {
    assert.equal(options.headers.Authorization, 'Bearer token');
    assert.equal(options.headers['Cache-Control'], 'no-cache, no-store');
    assert.equal(options.cache, 'no-store');
  }
});

test('thumbnail requests can be cancelled without retrying the request', async (t) => {
  const service = await loadService('http://localhost:9999');
  const controller = new AbortController();
  const fetch = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'http://localhost:9999/api/posts/7/thumbnail/');
    return new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true });
    });
  });

  const pending = service.getPostThumbnail(7, 'token', undefined, controller.signal);
  controller.abort();
  await assert.rejects(pending, service.PostApiError);
  await assert.rejects(service.getPostThumbnail(7, 'token', undefined, controller.signal), service.PostApiError);
  assert.equal(fetch.mock.callCount(), 1);
});
