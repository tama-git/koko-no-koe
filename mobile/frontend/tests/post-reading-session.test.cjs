const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { registerHooks } = require('node:module');
const test = require('node:test');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');

const hooks = registerHooks({
  resolve(specifier, context, next) {
    return next(specifier === './filterNearbyPosts' ? specifier + '.ts' : specifier, context);
  },
});
const proximity = require('../src/map/postProximity.ts');
const { filterNearbyPosts } = require('../src/map/filterNearbyPosts.ts');
hooks.deregister();

const target = { latitude: 36.6, longitude: 138.2 };
const nearbyLocation = { ...target, latitude: 36.601 };
const distantLocation = { ...target, latitude: 36.604 };
const pin = { id: 1, own: false, point: target };

function loadModule(path, modules, globals = {}) {
  const source = readFileSync(join(__dirname, '../src', path), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  const result = {};
  runInNewContext(outputText, { ...globals, exports: result, require: name => modules[name] ?? require(name) });
  return result;
}

function elements(node) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(elements);
  return [node, ...elements(node.props?.children)];
}

function mountHome() {
  const state = [];
  let index = 0;
  let location = { status: 'ready', coordinates: distantLocation };
  const feed = {
    posts: [],
    pins: [{ id: pin.id, ...target }],
    pinStatus: 'verified',
  };
  const props = { token: 'test-token' };
  const react = {
    useState: initial => {
      const slot = index++;
      if (!(slot in state)) state[slot] = initial;
      return [state[slot], value => { state[slot] = typeof value === 'function' ? value(state[slot]) : value; }];
    },
    useRef: initial => {
      const slot = index++;
      if (!(slot in state)) state[slot] = { current: initial };
      return state[slot];
    },
    useCallback: fn => fn,
    useMemo: create => create(),
    useEffect: () => {},
    useLayoutEffect: effect => effect(),
  };
  const native = new Proxy({ StyleSheet: { create: styles => styles }, Animated: { Value: class {}, add: () => null } }, {
    get: (target, name) => target[name] ?? name,
  });
  const modules = {
    react, 'react-native': native,
    '../../shared/components/AppScreen': { AppScreen: 'AppScreen' },
    '../../map/components/HomeMap': { HomeMap: 'HomeMap' },
    '../../location/useCurrentLocation': { useCurrentLocation: () => ({ location }) },
    '../../map/filterNearbyPosts': { filterNearbyPosts },
    '../../map/postPins': { ownPostsToPins: () => [] },
    '../../map/postProximity': proximity,
    '../components/PostBottomSheet': { PostBottomSheet: 'PostBottomSheet' },
    '../components/HomeMenuBar': { HomeMenuBar: 'HomeMenuBar' },
    '../../posts/components/PostComposerModal': { PostComposerModal: 'PostComposerModal' },
    '../../posts/components/PostDetailModal': { PostDistanceNotice: 'PostDistanceNotice' },
    '../../posts/screens/PostDetailScreen': { PostDetailScreen: 'PostDetailScreen' },
    '../../posts/usePostList': { usePostList: (_, scope) => scope === 'public' ? feed : { posts: [] } },
    '../../tutorial/TutorialScreen': { TutorialScreen: 'TutorialScreen' },
    '../../utility/screens/UtilityScreen': { UtilityScreen: 'UtilityScreen' },
    '../../shared/uiColors': { uiColors: {} },
  };
  const component = loadModule('home/screens/HomeScreen.tsx', modules);

  const find = type => {
    index = 0;
    return elements(component.HomeScreen(props)).find(element => element.type === type).props;
  };
  const sheet = () => find('PostBottomSheet');
  return {
    feed,
    sheet,
    move: coordinates => { location = { status: 'ready', coordinates }; },
    select: (selection = pin) => find('HomeMap').onSelectPin(selection, 0),
    guide: () => sheet().detail.distanceNotice.props,
    reader: () => sheet().detail.renderPost({}).props,
    allowNearby: () => { feed.posts = [{ id: pin.id, ...target, is_published: true }]; },
  };
}

test('crossing 250 m prompts an explicit read, cancels unapproved openings and retains only an approved visit', () => {
  const home = mountHome();
  home.select();
  assert.equal(home.guide().arrived, false);
  home.move(nearbyLocation);
  assert.equal(home.guide().arrived, false);
  home.allowNearby();
  const arrived = home.guide();
  assert.equal(arrived.arrived, true);
  home.select();
  assert.equal(home.guide().arrived, true);

  home.move(distantLocation);
  assert.equal(home.guide().arrived, false);
  arrived.onRead();
  assert.equal(home.guide().arrived, false);

  home.move(nearbyLocation);
  home.guide().onRead();
  const pending = home.reader().viewerAccess;
  assert.deepEqual(pending.getCoordinates(), nearbyLocation);
  home.move(distantLocation);
  home.sheet();
  pending.onOpened();
  assert.equal(home.guide().arrived, false);

  home.move(nearbyLocation);
  home.guide().onRead();
  home.reader().viewerAccess.onOpened();
  home.move(distantLocation);
  assert.equal(home.reader().viewerAccess.getCoordinates(), undefined);

  home.sheet().onCloseDetail();
  home.select();
  assert.equal(home.guide().arrived, false);
});

test('no selection stays closed on arrival and revocation removes an already opened post', () => {
  const home = mountHome();
  home.move(nearbyLocation);
  home.allowNearby();
  assert.equal(home.sheet().detail, null);
  home.select();
  const reader = home.reader().viewerAccess;
  reader.onOpened();
  home.move(distantLocation);
  assert.equal(home.reader().viewerAccess.getCoordinates(), undefined);
  home.feed.pins = [];
  assert.equal(home.sheet().detail, null);
  reader.onOpened();
  assert.equal(home.sheet().detail, null);
});

test('stationary reading checks publication without sending old coordinates or requesting the detail again', async () => {
  let tick;
  let now = 0;
  let index = 0;
  let mounted = false;
  const states = [];
  const requests = [];
  const modules = {
    'react-native': { AppState: { currentState: 'active' } },
    './postService': {
      PostApiError: Error,
      loadPublicPosts: async (_, coordinates) => {
        requests.push(coordinates);
        if (requests.length > 1) return { pins: [], posts: [] };
        const publicPin = { id: pin.id, ...target };
        return { pins: [publicPin], posts: [publicPin] };
      },
    },
    react: {
      useState: initial => {
        const slot = index++;
        if (!(slot in states)) states[slot] = initial;
        return [states[slot], value => {
          states[slot] = typeof value === 'function' ? value(states[slot]) : value;
        }];
      },
      useRef: initial => {
        const slot = index++;
        if (!(slot in states)) states[slot] = { current: initial };
        return states[slot];
      },
      useEffect: run => { if (!mounted) run(); },
    },
  };
  const { usePostList } = loadModule('posts/usePostList.ts', modules, {
    Date: { now: () => now }, setInterval: handler => { tick = handler; }, clearInterval: () => {},
  });
  const render = () => {
    index = 0;
    const list = usePostList('test-token', 'public', 0, nearbyLocation, true);
    mounted = true;
    return list;
  };
  render();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(render().posts.length, 1);
  now = 14999;
  tick();
  assert.deepEqual(requests, [nearbyLocation]);
  now = 15000;
  tick();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(requests, [nearbyLocation, undefined]);
  const verified = render();
  assert.equal(verified.pinStatus, 'verified');
  assert.equal(verified.posts.length, 0);
  assert.equal(verified.pins.length, 0);
});
