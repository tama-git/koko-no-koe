const assert = require('node:assert/strict');
const test = require('node:test');
const { formatPostDate } = require('../src/posts/formatPostDate.ts');

test('uses actual elapsed time at each relative date boundary', () => {
  const now = Date.parse('2026-11-17T14:29:00+09:00');
  for (const [elapsed, expected] of [
    [0, 'たった今'],
    [59_999, 'たった今'],
    [60_000, '1分前'],
    [3_599_999, '59分前'],
    [3_600_000, '1時間前'],
    [86_399_999, '23時間前'],
    [86_400_000, '1日前'],
    [604_799_999, '6日前'],
    [604_800_000, '11月10日'],
  ]) {
    assert.equal(formatPostDate(new Date(now - elapsed).toISOString(), now), expected);
  }
  assert.equal(formatPostDate('2026-11-16T23:50:00+09:00', Date.parse('2026-11-17T00:10:00+09:00')), '20分前');
});

test('checks the Japanese calendar year before the elapsed time', () => {
  const newYear = Date.parse('2027-01-01T00:00:00+09:00');
  assert.equal(formatPostDate('2026-12-31T23:59:59+09:00', newYear), '2026年12月31日');
  assert.equal(formatPostDate('2026-12-31T15:00:00Z', newYear), 'たった今');
  assert.equal(formatPostDate('2026-01-01T00:00:00+09:00', Date.parse('2026-11-17T00:00:00+09:00')), '1月1日');
  assert.equal(formatPostDate('2025-12-31T14:59:59Z', newYear), '2025年12月31日');
  assert.equal(formatPostDate('2026-11-01T15:00:00Z', Date.parse('2026-11-17T14:29:00+09:00')), '11月2日');
});

test('does not display an invalid timestamp', () => {
  assert.equal(formatPostDate('invalid'), '');
});
