const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');

const { nextTutorialPage, tutorialPages, tutorialSwipeDirection } = require('../src/tutorial/tutorialPages.ts');
const {
  rememberTutorialCompletion, shouldShowTutorial, tutorialCompletionKey,
} = require('../src/tutorial/tutorialCompletion.ts');

test('the app confirms successful registration before opening the tutorial, and normal login goes straight home', () => {
  const auth = {
    mode: 'register', email: 'account@example.com', session: null,
    continueAfterRegistration: () => { auth.session.completionAcknowledged = true; },
  };
  const modules = {
    './src/auth/screens/LoginScreen': { LoginScreen: 'LoginScreen' },
    './src/auth/screens/RegisterScreen': {
      RegisterScreen: 'RegisterScreen', RegistrationCompleteScreen: 'RegistrationCompleteScreen',
    },
    './src/auth/useAuth': { useAuth: () => auth },
    './src/home/screens/HomeScreen': { HomeScreen: 'HomeScreen' },
    './src/tutorial/TutorialEntry': { TutorialEntry: 'TutorialEntry' },
    './src/tutorial/tutorialCompletion': { tutorialCompletionKey },
  };
  const source = readFileSync(join(__dirname, '../App.tsx'), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  const app = {};
  runInNewContext(outputText, { exports: app, require: name => modules[name] ?? require(name) });

  assert.equal(app.default().type, 'RegisterScreen');

  auth.mode = 'login'; // 認証コードで登録が完了すると、認証フックで画面モードもログインに戻る。
  auth.session = { token: 'test-token', source: 'registration', completionAcknowledged: false };
  const confirmation = app.default();
  assert.equal(confirmation.type, 'RegistrationCompleteScreen');
  confirmation.props.onContinue();

  const entry = app.default();
  assert.equal(entry.type, 'TutorialEntry');
  assert.equal(entry.props.children.type, 'HomeScreen');

  auth.session = { token: 'next-token', source: 'login' };
  const home = app.default();
  assert.equal(home.type, 'HomeScreen');
  assert.equal(home.props.token, 'next-token');
});

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
