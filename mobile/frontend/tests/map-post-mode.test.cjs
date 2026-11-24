const assert = require('node:assert/strict');
const { registerHooks } = require('node:module');
const test = require('node:test');
const vm = require('node:vm');

// アプリの拡張子なしimportを、Nodeのテストでは直接.tsに解決する。
const hooks = registerHooks({
  resolve(specifier, context, next) {
    return next(specifier === './filterNearbyPosts' ? specifier + '.ts' : specifier, context);
  },
});
const { ownPostsToPins, resolvePostPinTap } = require('../src/map/postPins.ts');
const { createOpenFreeMapDocument } = require('../src/map/openFreeMapDocument.ts');
hooks.deregister();

const point = { latitude: 36.6, longitude: 138.2 };
const ownPin = { id: 1, ...point, isOwn: true, nearby: false };
const otherPin = { id: 2, ...point, isOwn: false, nearby: true };
const privatePin = { id: 3, ...point, isOwn: true, nearby: false };

test('the owner feed supplies private and moderated pins and skips unusable coordinates', () => {
  const posts = [
    { id: 1, ...point, is_published: true, message: 'public' },
    { id: 3, ...point, is_published: false, message: 'private' },
    { id: 4, ...point, is_admin_hidden: true, message: 'moderated' },
    { id: 5, ...point, latitude: null },
    { id: 6, ...point, longitude: 181 },
    { id: 2, ...point, is_own: false },
  ];
  assert.deepEqual(ownPostsToPins(posts), [1, 3, 4].map(id => ({ id, ...point, isOwn: true })));
});

test('owner pins open without GPS and stale events cannot open a post', () => {
  assert.deepEqual(resolvePostPinTap([ownPin, otherPin], 1, 0, 0, null), { id: 1, own: true });
  assert.deepEqual(resolvePostPinTap([ownPin, privatePin], 3, 1, 1, null), { id: 3, own: true });
  assert.deepEqual(resolvePostPinTap([ownPin, otherPin], 1, 0, 0, { latitude: 0, longitude: 0 }), { id: 1, own: true });
  assert.equal(resolvePostPinTap([ownPin, privatePin], 2, 1, 1, point), null);
  assert.equal(resolvePostPinTap([ownPin, otherPin], 1, 0, 2, point), null);
  assert.deepEqual(resolvePostPinTap([otherPin], 2, 0, 0, null), { id: 2, distanceMeters: null });
  assert.deepEqual(resolvePostPinTap([otherPin], 2, 0, 0, point), { id: 2, own: false });
  const far = resolvePostPinTap([{ ...otherPin, nearby: false }], 2, 0, 0, { ...point, latitude: 36 });
  assert.ok(far.distanceMeters > 250);
});

test('the existing WebView rebuilds clusters by mode and cancels only the old pin focus', () => {
  const snapshot = (modeRevision, pins) => ({ current: null, displayPosition: null, modeRevision, pins });
  const html = createOpenFreeMapDocument(snapshot(0, [ownPin, otherPin]));
  const initialJson = html.match(/id="initial-map-snapshot">([^<]*)<\/script>/)[1];
  const script = html.match(/<script>\s*([\s\S]+?)<\/script>/)[1];
  const loadedIds = [];
  const messages = [];
  const camera = [];
  const visible = new Set();
  const map = {
    zoom: 16, getZoom() { return this.zoom; }, isMoving: () => false,
    getBounds: () => ({ getWest: () => 0, getEast: () => 180, getNorth: () => 90, getSouth: () => 0 }),
    project: () => ({ x: 200, y: 220 }),
    easeTo: () => camera.push('focus'), panBy: () => camera.push('focus'),
    stop: () => camera.push('stop'), flyTo: () => camera.push('cluster'),
  };
  const makeNode = () => {
    const events = new Map();
    return {
      events, style: {}, textContent: '',
      classList: { add() {}, toggle() {}, contains: () => false, remove() {} },
      setAttribute() {}, addEventListener: (type, fn) => events.set(type, fn),
    };
  };
  const world = vm.createContext({
    window: { ReactNativeWebView: { postMessage: raw => messages.push(JSON.parse(raw)) },
      addEventListener() {}, matchMedia: () => ({ matches: false }) },
    document: {
      getElementById(id) {
        if (id === 'map') return { clientWidth: 400, clientHeight: 600 };
        if (id === 'range') return { getContext: () => null };
        return { textContent: initialJson };
      },
      createElement: makeNode,
      addEventListener() {},
    },
    mapForTest: map,
    performance: { now: () => 0 },
    fetch: () => new Promise(() => {}),
    setTimeout() {},
    maplibregl: { Marker: class {
      constructor({ element } = {}) { this.element = element ?? makeNode(); }
      setLngLat(coordinates) { this.coordinates = coordinates; return this; }
      getLngLat() { return this.coordinates; }
      addTo() { visible.add(this.element); return this; }
      getElement() { return this.element; }
      remove() { visible.delete(this.element); }
    } },
    Supercluster: class {
      load(points) { this.points = points; loadedIds.push(Array.from(points, p => p.properties.id)); }
      getClusters(_, zoom) {
        if (zoom > 16 || this.points.length < 2) return this.points;
        return [{ id: 42, geometry: this.points[0].geometry, properties: { cluster: true, point_count: this.points.length } }];
      }
      getClusterExpansionZoom() { return 17; }
    },
  });
  vm.runInContext(script, world);
  vm.runInContext('map = mapForTest; ready = true; applySnapshot(initial);', world);
  const command = data => world.window.receiveKokoMapCommand(data);
  const refresh = (requestId, modeRevision, pins) => command({ type: 'snapshot', requestId, snapshot: snapshot(modeRevision, pins) });
  const oldClusterTap = [...visible][0].events.get('click');
  assert.deepEqual(loadedIds, [[1, 2]]);

  refresh(1, 1, [ownPin, privatePin]);
  assert.deepEqual(loadedIds.at(-1), [1, 3]);
  assert.equal(messages.at(-1).modeRevision, 1);
  oldClusterTap();
  assert.deepEqual(camera, []);

  map.zoom = 17;
  vm.runInContext('updateClusterMarkers();', world);
  const oldOwnTap = [...visible].at(-1).events.get('click');
  oldOwnTap();
  assert.deepEqual(messages.at(-1), { type: 'pin', id: 3, modeRevision: 1 });

  // 前のモードで保留していた選択・中央移動は、同じIDが残っていても適用しない。
  command({ type: 'select-post-pin', modeRevision: 0, id: 1 });
  command({ type: 'center-post-pin', modeRevision: 0, id: 1, bottomInset: 100 });
  assert.deepEqual(camera, []);
  command({ type: 'select-post-pin', modeRevision: 1, id: 3 });
  command({ type: 'center-post-pin', modeRevision: 1, id: 3, bottomInset: 100 });
  assert.deepEqual(camera, ['focus']);

  // 同じモードで詳細を閉じても、強調と保留中の中央移動を解除する。
  command({ type: 'select-post-pin', modeRevision: 1, id: null });
  command({ type: 'center-post-pin', modeRevision: 1, id: 3, bottomInset: 100 });
  assert.deepEqual(camera, ['focus', 'stop']);
  command({ type: 'select-post-pin', modeRevision: 1, id: 3 });
  command({ type: 'center-post-pin', modeRevision: 1, id: 3, bottomInset: 100 });

  refresh(2, 2, [ownPin, otherPin]);
  assert.deepEqual(camera, ['focus', 'stop', 'focus', 'stop']);
  oldOwnTap();
  refresh(3, 1, [ownPin, privatePin]);
  refresh(1, 2, []);
  assert.deepEqual(loadedIds, [[1, 2], [1, 3], [1, 2]]);
  assert.equal(messages.at(-1).modeRevision, 2);
});
