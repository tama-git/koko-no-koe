const assert = require('node:assert/strict');
const test = require('node:test');

process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:8000';
const service = import('../src/reports/reportService.ts');

test('only Other requires details and the limit counts Unicode characters', async () => {
  const { validateReport } = await service;
  assert.match(validateReport(null, ''), /カテゴリ/);
  assert.equal(validateReport('spam', ''), '');
  assert.match(validateReport('other', ' \t '), /理由を入力/);
  assert.equal(validateReport('other', '📍'.repeat(100)), '');
  assert.match(validateReport('spam', '📍'.repeat(101)), /100文字以内/);
});

test('submit sends authenticated JSON and distinguishes success, duplicate and network failure', async t => {
  const { submitReport } = await service;
  let response = Response.json({ status: 'received' }, { status: 201 });
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'http://localhost:8000/api/posts/7/reports/');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    assert.equal(options.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(options.body), { category: 'other', details: '理由' });
    if (response instanceof Error) throw response;
    return response;
  });
  const send = () => submitReport(7, 'test-token', 'other', ' 理由 ');
  assert.equal(await send(), 'received');
  response = Response.json({}, { status: 409 });
  assert.equal(await send(), 'already_reported');
  response = Response.json({}, { status: 401 });
  await assert.rejects(send(), /ログイン/);
  response = Response.json({}, { status: 201 });
  await assert.rejects(send(), /受付結果/);
  response = new TypeError('Network error');
  await assert.rejects(send(), /受付結果/);
});
