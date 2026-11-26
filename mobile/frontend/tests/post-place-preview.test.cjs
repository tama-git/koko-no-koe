const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');

function loadComponent(path, modules, react) {
  const { outputText } = ts.transpileModule(readFileSync(join(__dirname, '../src/posts', path), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  const native = new Proxy({ StyleSheet: { create: styles => styles }, Alert: { alert: () => {} } }, {
    get: (target, name) => target[name] ?? name,
  });
  const imports = {
    react, 'react-native': native, 'react-native-svg': { default: 'Svg', Path: 'Path', Circle: 'Circle' },
    '../../shared/uiColors': { uiColors: {} }, ...modules,
  };
  const component = {};
  runInNewContext(outputText, { exports: component, require: name => imports[name] ?? require(name) });
  return component;
}

function elements(node) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(elements);
  return [node, ...elements(node.props?.children)];
}

const draft = { message: '本文', imageUri: null, latitude: 35, longitude: 139, isPublished: true };
const place = label => ({ mode: 'auto', label, attribution: { label: 'Test source', url: null } });

test('a preview from an abandoned draft cannot replace the location of a retaken photo', async () => {
  const pending = new Map();
  const load = ({ latitude }) => new Promise(resolve => pending.set(latitude, resolve));
  const state = [];
  let index = 0;
  const { PostComposerModal } = loadComponent('components/PostComposerModal.tsx', {
    '../../shared/components/AppScreen': { AppScreen: 'AppScreen' },
    '../screens/PostCreateScreen': { PostCreateScreen: 'PostCreateScreen' },
    '../screens/PostConfirmScreen': { PostConfirmScreen: 'PostConfirmScreen' },
    '../screens/PostDetailScreen': { PostDetailScreen: 'PostDetailScreen' },
    '../postService': { createPostPlacePreviewLoader: () => load },
  }, {
    useState: initial => {
      const key = index++;
      if (!(key in state)) state[key] = initial;
      return [state[key], value => { state[key] = typeof value === 'function' ? value(state[key]) : value; }];
    },
    useMemo: create => create(),
  });
  const node = type => {
    index = 0;
    return elements(PostComposerModal({ token: 'test-token' })).find(element => element.type === type);
  };
  const navigation = node('PostCreateScreen').props.navigation;
  const previewDraft = () => node('PostConfirmScreen')?.props.route.params;
  navigation.navigate('PostConfirm', { ...draft });
  navigation.goBack();
  assert.equal(previewDraft(), undefined);

  navigation.navigate('PostConfirm', { ...draft, latitude: 36, imageUri: 'file:///new-photo.jpg' });
  pending.get(35)(place('元の場所周辺'));
  await Promise.resolve();
  assert.equal(previewDraft().placePreview, undefined);
  pending.get(36)(place('撮り直した場所周辺'));
  await Promise.resolve();
  assert.equal(previewDraft().placePreview.label, '撮り直した場所周辺');
});

test('the confirmation disables submission during lookup and allows it after a lookup failure', async () => {
  const submissions = [];
  const { PostConfirmScreen } = loadComponent('screens/PostConfirmScreen.tsx', {
    '../components/PostPlaceCredits': { PostPlaceCredits: 'PostPlaceCredits' },
    '../postService': { createPost: async body => { submissions.push(body); return { id: 1 }; } },
  }, { useState: initial => [initial, () => {}], useRef: current => ({ current }) });

  const render = placePreview => elements(PostConfirmScreen({
    route: { params: { ...draft, placePreview } }, navigation: {}, token: 'test-token', onCreated: () => {},
  }));
  const submit = nodes => nodes.find(node => node.props?.children?.props?.children === 'この声を残す');
  const hasLabel = (nodes, label) => nodes.some(node => node.type === 'Text' && node.props.children === label);
  const loading = render(undefined);
  assert.ok(hasLabel(loading, '投稿場所を取得中…'));
  assert.equal(submit(loading).props.disabled, true);
  await submit(loading).props.onPress();
  assert.equal(submissions.length, 0);

  const failed = render(null);
  assert.ok(hasLabel(failed, 'この付近'));
  assert.equal(submit(failed).props.disabled, false);
  await submit(failed).props.onPress();
  assert.equal(submissions.length, 1);
  assert.equal(submissions[0].latitude, draft.latitude);
  assert.equal(submissions[0].longitude, draft.longitude);
  assert.equal(submissions[0].place_name, undefined);

  const success = render(place('栗田周辺'));
  assert.ok(hasLabel(success, '栗田周辺'));
  assert.equal(success.find(node => node.type === 'PostPlaceCredits').props.sources[0].label, 'Test source');
});
