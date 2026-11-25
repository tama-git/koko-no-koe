const assert = require('node:assert/strict');
const test = require('node:test');

const { nextTutorialPage, tutorialPages, tutorialSwipeDirection } = require('../src/tutorial/tutorialPages.ts');
const {
  rememberTutorialCompletion, shouldShowTutorial, tutorialCompletionKey,
} = require('../src/tutorial/tutorialCompletion.ts');

test('the six tutorial pages appear in the intended order and navigation stays within their bounds', () => {
  assert.deepEqual(tutorialPages.map(page => page.title), [
    'ようこそ、ここの声へ。', '誰かの声を探そう。', 'その場所で出会う声。',
    'あなたの声を残そう。', '自分の声を振り返ろう。', 'さあ、はじめましょう。',
  ]);
  assert.match(tutorialPages[2].description, /250m以内/);
  assert.equal(nextTutorialPage(0, -1), 0);
  assert.equal(nextTutorialPage(0, 1), 1);
  assert.equal(nextTutorialPage(5, 1), 5);
  assert.equal(nextTutorialPage(5, -1), 4);
});

test('horizontal swipes navigate in both directions while taps and vertical or diagonal gestures do not', () => {
  assert.equal(tutorialSwipeDirection(-60, 14), 1);
  assert.equal(tutorialSwipeDirection(48, 0), -1);
  assert.equal(tutorialSwipeDirection(-47, 0), null);
  assert.equal(tutorialSwipeDirection(50, 80), null);
  assert.equal(tutorialSwipeDirection(60, 40), null);
});

test('completion persists for the same account without marking another account complete', async () => {
  const values = new Map();
  const storage = {
    async getItem(key) { return values.get(key) ?? null; },
    async setItem(key, value) { values.set(key, value); },
  };
  const firstAccount = tutorialCompletionKey(' Account.One@Example.com ');
  const secondAccount = tutorialCompletionKey('account.two@example.com');
  assert.equal(await shouldShowTutorial(storage, firstAccount), true);
  await rememberTutorialCompletion(storage, firstAccount);
  assert.equal(await shouldShowTutorial(storage, tutorialCompletionKey('account.one@example.com')), false);
  assert.equal(await shouldShowTutorial(storage, secondAccount), true);
});

test('local storage errors allow continuing to the home screen', async () => {
  const storageError = async () => { throw new Error('local storage unavailable'); };
  const key = tutorialCompletionKey('account@example.com');
  assert.equal(await shouldShowTutorial({ getItem: storageError }, key), false);
  await assert.doesNotReject(() => rememberTutorialCompletion({ setItem: storageError }, key));
});
