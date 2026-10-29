const assert = require('node:assert/strict');
const test = require('node:test');
const { validateAuth } = require('../src/auth/validation.ts');

test('registration requires email and password using three kinds and matching confirmation', () => {
  assert.deepEqual(validateAuth({ email: 'user@example.com', password: 'Abcdef12', confirmPassword: 'Abcdef12' }, 'register'), {});
  assert.ok(validateAuth({ email: 'bad', password: 'abc12345', confirmPassword: 'different' }, 'register').email);
  assert.ok(validateAuth({ email: 'user@example.com', password: 'abc12345', confirmPassword: 'abc12345' }, 'register').password);
  assert.ok(validateAuth({ email: 'user@example.com', password: 'Abc1!', confirmPassword: 'Abc1!' }, 'register').password);
  assert.ok(validateAuth({ email: 'user@example.com', password: 'Abcdef12', confirmPassword: 'different' }, 'register').confirmPassword);
});

test('login checks required values but does not impose registration rules on existing passwords', () => {
  assert.deepEqual(validateAuth({ email: 'user@example.com', password: 'short', confirmPassword: '' }, 'login'), {});
  assert.ok(validateAuth({ email: '', password: '', confirmPassword: '' }, 'login').email);
  assert.ok(validateAuth({ email: '', password: '', confirmPassword: '' }, 'login').password);
});
