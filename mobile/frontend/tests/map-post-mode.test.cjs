const assert = require('node:assert/strict');
const { registerHooks } = require('node:module');
const test = require('node:test');
const vm = require('node:vm');

// アプリの拡張子なしimportを、Nodeのテストでは直接.tsに解決する。
const hooks = registerHooks({
  resolve(specifier, context, next) {
    const localModule = specifier === './filterNearbyPosts' || specifier === '../shared/uiColors';
    return next(localModule ? specifier + '.ts' : specifier, context);
  },
});
const { ownPostsToPins, resolvePostPinTap } = require('../src/map/postPins.ts');
const { createOpenFreeMapDocument } = require('../src/map/openFreeMapDocument.ts');
const { getPostProximity, formatPostDistance, canOpenSelectedPost } = require('../src/map/postProximity.ts');
const { isWithinPostRadius } = require('../src/map/filterNearbyPosts.ts');
hooks.deregister();

const point = { latitude: 36.6, longitude: 138.2 };
const ownPin = { id: 1, ...point, isOwn: true, nearby: false, withinRadius: false };
const otherPin = { id: 2, ...point, isOwn: false, nearby: true, withinRadius: true };
const privatePin = { id: 3, ...point, isOwn: true, nearby: false, withinRadius: true };

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

test('pin taps keep the selected coordinates and reject absent or old-mode pins', () => {
  assert.deepEqual(resolvePostPinTap([ownPin, otherPin], 1, 0, 0), { id: 1, own: true, point });
  assert.deepEqual(resolvePostPinTap([ownPin, privatePin], 3, 1, 1), { id: 3, own: true, point });
  assert.equal(resolvePostPinTap([ownPin, privatePin], 2, 1, 1), null);
  assert.equal(resolvePostPinTap([ownPin, otherPin], 1, 0, 2), null);
  assert.deepEqual(resolvePostPinTap([otherPin], 2, 0, 0), { id: 2, own: false, point });
});

test('moving through 250 m changes the distance and access gate without widening server permissions', () => {
  const far = getPostProximity({ latitude: 36.602, longitude: 138.202 }, point);
  assert.equal(far.direction, '南西');
  assert.equal(far.arrowRotation, 225);
  assert.ok(far.remaining > 0);
  assert.equal(far.withinRadius, false);
  assert.equal(canOpenSelectedPost(false, far.withinRadius, true), false);
  const near = getPostProximity({ latitude: 36.601, longitude: 138.201 }, point);
  assert.equal(near.withinRadius, true);
  assert.equal(near.remaining, 0);
  assert.equal(canOpenSelectedPost(false, near.withinRadius, false), false);
  assert.equal(canOpenSelectedPost(false, near.withinRadius, true), true);
  assert.equal(canOpenSelectedPost(true, false, false), true);
  assert.equal(getPostProximity(undefined, point), null);
  assert.equal(isWithinPostRadius(250), true);
  assert.equal(isWithinPostRadius(250.01), false);
  assert.deepEqual(formatPostDistance(280), { value: '280', unit: 'm' });
  assert.deepEqual(formatPostDistance(0.1, true), { value: '1', unit: 'm' });
  assert.deepEqual(formatPostDistance(1000), { value: '1', unit: 'km' });
});

test('the direction follows all eight compass sectors, including across the date line', () => {
  const origin = { latitude: 0, longitude: 0 };
  const targets = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  assert.deepEqual(targets.map(([latitude, longitude]) => getPostProximity(origin, { latitude, longitude }).direction),
    ['北', '北東', '東', '南東', '南', '南西', '西', '北西']);
  assert.equal(getPostProximity({ ...origin, longitude: 179.9 }, { ...origin, longitude: -179.9 }).direction, '東');
});

function mountMap(pins, location = null, reduceMotion = false, viewport = {}) {
  const snapshot = (modeRevision, pins, current = location) =>
    ({ current, displayPosition: current && { ...current, durationMs: 0 }, modeRevision, pins });
  const html = createOpenFreeMapDocument(snapshot(0, pins));
  const initialJson = html.match(/id="initial-map-snapshot">([^<]*)<\/script>/)[1];
  const script = html.match(/<script>\s*([\s\S]+?)<\/script>/)[1];
  const loadedIds = [];
  const queries = [];
  const networkRequests = [];
  const messages = [];
  const camera = [];
  const trackingCamera = [];
  const mapEvents = new Map();
  const fits = [];
  const visible = new Set();
  const frames = new Map();
  let frameId = 0;
  let now = 0;
  const view = { lng: 90, lat: 45, longitudeSpan: 180, latitudeSpan: 90, angle: 0, ...viewport };
  const map = {
    zoom: viewport.zoom ?? 16, getZoom() { return this.zoom; }, isMoving: () => false,
    bearing: 27, getCenter: () => ({ lng: 138.2 }), getBearing() { return this.bearing; },
    on(type, callback) { mapEvents.set(type, [...(mapEvents.get(type) ?? []), callback]); },
    unproject: ([x, y]) => {
      const east = (x / 400 - 0.5) * view.longitudeSpan;
      const north = (0.5 - y / 600) * view.latitudeSpan;
      const angle = view.angle * Math.PI / 180;
      return {
        lng: view.lng + east * Math.cos(angle) - north * Math.sin(angle),
        lat: view.lat + east * Math.sin(angle) + north * Math.cos(angle),
      };
    },
    project: () => ({ x: 200, y: 220 }),
    easeTo(options) {
      if (options.easeId === 'location-tracking') {
        trackingCamera.push({ ...options, center: Array.from(options.center), offset: Array.from(options.offset) });
        this.zoom = options.zoom;
        this.bearing = options.bearing;
      } else {
        camera.push('focus');
      }
    },
    panBy: () => camera.push('focus'),
    cameraForBounds: (bounds, options) => { fits.push({ bounds, options }); return { zoom: 14, bearing: options.bearing }; },
    stop: () => camera.push('stop'), flyTo: () => camera.push('cluster'),
  };
  const makeNode = () => {
    const events = new Map();
    const attributes = new Map();
    const classes = new Set();
    const children = [];
    return {
      events, attributes, children, style: { setProperty() {} }, textContent: '', innerHTML: '',
      set className(value) { classes.clear(); value.split(' ').forEach(name => classes.add(name)); },
      classList: {
        add: name => classes.add(name),
        toggle: (name, on) => on ? classes.add(name) : classes.delete(name),
        contains: name => classes.has(name),
        remove: name => classes.delete(name),
      },
      appendChild: node => children.push(node),
      querySelector: () => makeNode(),
      setAttribute: (name, value) => attributes.set(name, value),
      addEventListener: (type, fn) => events.set(type, fn),
    };
  };
  const line = makeNode();
  const world = vm.createContext({
    window: { ReactNativeWebView: { postMessage: raw => messages.push(JSON.parse(raw)) },
      addEventListener() {}, matchMedia: () => ({ matches: reduceMotion }) },
    document: {
      getElementById(id) {
        if (id === 'map') return { clientWidth: 400, clientHeight: 600 };
        if (id === 'range') return { getContext: () => null };
        if (id === 'post-distance-line') return line;
        return { textContent: initialJson };
      },
      createElement: makeNode,
      addEventListener() {},
    },
    mapForTest: map,
    performance: { now: () => now },
    requestAnimationFrame: callback => { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame: id => frames.delete(id),
    fetch: url => {
      networkRequests.push(url);
      return new Promise(() => {});
    },
    setTimeout() {},
    maplibregl: { Marker: class {
      constructor(options = {}) {
        this.element = options.element ?? makeNode();
        this.element.marker = this;
        this.anchor = options.anchor;
        this.color = options.color;
      }
      setLngLat(coordinates) { this.coordinates = coordinates; return this; }
      getLngLat() { return { lng: this.coordinates[0], lat: this.coordinates[1] }; }
      addTo() { visible.add(this.element); return this; }
      getElement() { return this.element; }
      remove() { visible.delete(this.element); }
    } },
    Supercluster: class {
      load(points) { this.points = points; loadedIds.push(Array.from(points, p => p.properties.id)); }
      getClusters(bbox, zoom) {
        queries.push({ bbox: Array.from(bbox), zoom });
        const candidates = zoom > 16 || this.points.length < 2 ? this.points
          : [{ id: 42, geometry: this.points[0].geometry, properties: { cluster: true, point_count: this.points.length } }];
        const [west, south, east, north] = bbox;
        return candidates.filter(marker => {
          const [lng, lat] = marker.geometry.coordinates;
          const longitude = lng + 360 * Math.round(((west + east) / 2 - lng) / 360);
          return longitude >= west && longitude <= east && lat >= south && lat <= north;
        });
      }
      getClusterExpansionZoom() { return 17; }
    },
  });
  vm.runInContext(script, world);
  vm.runInContext('map = mapForTest; ready = true; centered = !!initial.current; bindLocationTrackingEvents(); applySnapshot(initial);', world);
  const command = data => world.window.receiveKokoMapCommand(data);
  const refresh = (requestId, modeRevision, pins, current) =>
    command({ type: 'snapshot', requestId, snapshot: snapshot(modeRevision, pins, current) });
  const zoomToPins = () => {
    map.zoom = 17;
    vm.runInContext('updateClusterMarkers();', world);
  };
  const advance = time => {
    now = time;
    for (const [id, next] of [...frames]) {
      if (frames.delete(id)) next(now);
    }
  };
  const move = ({ zoom = map.zoom, ...position } = {}) => {
    map.zoom = zoom;
    Object.assign(view, position);
    vm.runInContext('scheduleMarkerViewportCheck();', world);
  };
  const moveEnd = () => vm.runInContext('refreshMarkerViewport();', world);
  const reproject = project => {
    map.project = project;
    vm.runInContext('drawDistanceLine();', world);
  };
  const trackingEvent = (type, originalEvent) => {
    for (const callback of mapEvents.get(type) ?? []) callback({ originalEvent });
  };
  return { loadedIds, queries, networkRequests, messages, camera, visible, command, refresh, zoomToPins, html, line, fits,
    advance, reproject, move, moveEnd, trackingCamera, trackingEvent };
}

test('the location control preserves map bearing when entering position follow and leaving heading follow', () => {
  const { command, messages, trackingCamera, advance, move } = mountMap([], point, false, { zoom: 14 });
  const press = () => command({ type: 'cycle-location-tracking', bottomInset: 180 });
  const heading = (requestId, degrees) => command({ type: 'heading', requestId, heading: degrees });
  const modes = () => messages.filter(message => message.type === 'location-tracking').map(message => message.mode);

  press();
  assert.deepEqual(modes(), ['position']);
  assert.deepEqual(trackingCamera[0], { center: [point.longitude, point.latitude], bearing: 27, zoom: 16,
    offset: [0, -90], duration: 500, easeId: 'location-tracking' });
  press();
  assert.equal(trackingCamera.length, 1, 'heading mode waits for a valid heading');

  heading(1, 357);
  move({ zoom: 17.5 });
  press();
  assert.deepEqual(modes(), ['position', 'heading']);
  assert.equal(trackingCamera.at(-1).bearing, -3, 'rotate the short way across north');
  assert.equal(trackingCamera.at(-1).zoom, 17.5);

  heading(2, 1);
  heading(3, 5);
  heading(2, 98);
  advance(16);
  assert.equal(trackingCamera.length, 3, 'use only the latest heading in the animation frame');
  assert.equal(trackingCamera.at(-1).bearing, 5);
  press();
  assert.deepEqual(modes(), ['position', 'heading', 'position']);
  assert.equal(trackingCamera.at(-1).bearing, 5);
  assert.equal(trackingCamera.at(-1).zoom, 17.5);
});

test('the location button ignores an active touch and immediately interrupts inertia after release', () => {
  const { command, messages, camera, trackingCamera, trackingEvent, advance } = mountMap([], point);
  const drag = { touches: [{}] };
  const press = () => command({ type: 'cycle-location-tracking', bottomInset: 180 });
  const modes = () => messages.filter(message => message.type === 'location-tracking').map(message => message.mode);

  trackingEvent('touchstart', drag);
  trackingEvent('movestart', drag);
  trackingEvent('drag', drag);
  press();
  assert.deepEqual(modes(), []);
  assert.deepEqual(camera, []);
  assert.deepEqual(trackingCamera, []);

  trackingEvent('touchend', { touches: [] });
  advance(16);
  assert.deepEqual(trackingCamera, [], 'a tap made during a drag does not run later');

  press();
  assert.deepEqual(camera, ['stop']);
  assert.deepEqual(modes(), ['position']);
  assert.equal(trackingCamera.length, 1, 'the camera starts before the old moveend');
  assert.deepEqual(trackingCamera[0].center, [point.longitude, point.latitude]);
  assert.equal(trackingCamera[0].bearing, 27);

  trackingEvent('moveend', { touches: [] });
  advance(32);
  assert.equal(trackingCamera.length, 1);
});

test('the separate compass resets the map to north without ending position follow', () => {
  const { command, messages, trackingCamera, refresh, advance } = mountMap([], point);
  command({ type: 'cycle-location-tracking', bottomInset: 180 });
  assert.equal(trackingCamera.at(-1).bearing, 27);
  command({ type: 'reset-bearing' });
  advance(16);
  assert.equal(trackingCamera.at(-1).bearing, 0);
  const nextPoint = { ...point, latitude: point.latitude + 0.0001 };
  command({ type: 'tracking-inset', bottomInset: 200 });
  refresh(1, 0, [], nextPoint);
  advance(32);
  assert.deepEqual(trackingCamera.at(-1).center, [nextPoint.longitude, nextPoint.latitude]);
  assert.equal(trackingCamera.at(-1).bearing, 0);
  assert.deepEqual(messages.filter(message => message.type === 'location-tracking').map(message => message.mode), ['position']);
});

test('pinching preserves location follow and the new zoom while a drag cancels pending camera updates', () => {
  const { command, messages, trackingCamera, trackingEvent, refresh, move, advance } = mountMap([], point);
  command({ type: 'cycle-location-tracking', bottomInset: 180 });
  const pinch = { touches: [{}, {}] };
  trackingEvent('touchstart', pinch);
  trackingEvent('movestart', pinch);
  trackingEvent('drag', pinch);
  move({ zoom: 17.25 });
  const nextPoint = { ...point, latitude: point.latitude + 0.0001 };
  refresh(1, 0, [], nextPoint);
  command({ type: 'tracking-inset', bottomInset: 200 });
  advance(16);
  assert.equal(trackingCamera.length, 1);

  // 測位とシートの高さの変更は、慣性移動が終わってからまとめて反映する。
  trackingEvent('touchend', { touches: [] });
  advance(32);
  assert.equal(trackingCamera.length, 1);
  trackingEvent('moveend', { touches: [] });
  advance(48);
  assert.equal(trackingCamera.at(-1).zoom, 17.25);
  assert.deepEqual(trackingCamera.at(-1).center, [nextPoint.longitude, nextPoint.latitude]);
  assert.deepEqual(trackingCamera.at(-1).offset, [0, -100]);
  assert.equal(trackingCamera.at(-1).bearing, 27);

  refresh(2, 0, [], point);
  const drag = { touches: [{}] };
  trackingEvent('movestart', drag);
  trackingEvent('drag', drag);
  trackingEvent('moveend', drag);
  advance(64);
  assert.equal(trackingCamera.length, 2);
  assert.deepEqual(messages.filter(message => message.type === 'location-tracking').map(message => message.mode), ['position', 'free']);
});

test('only manual rotation releases heading follow, and loss of heading or position backs out safely', () => {
  const { command, messages, trackingEvent, trackingCamera, refresh, advance } = mountMap([], point);
  const press = () => command({ type: 'cycle-location-tracking', bottomInset: 150 });
  const modes = () => messages.filter(message => message.type === 'location-tracking').map(message => message.mode);
  command({ type: 'heading', requestId: 1, heading: 92 });
  press();
  press();
  trackingEvent('rotatestart');
  assert.deepEqual(modes(), ['position', 'heading']);
  trackingEvent('rotatestart', { touches: [{}, {}] });
  command({ type: 'heading', requestId: 2, heading: 105 });
  advance(16);
  assert.deepEqual(modes(), ['position', 'heading', 'free']);
  assert.equal(trackingCamera.length, 2);

  press();
  press();
  command({ type: 'heading', requestId: 3, heading: null });
  advance(32);
  assert.equal(modes().at(-1), 'position');
  assert.equal(trackingCamera.at(-1).bearing, 105);
  refresh(4, 0, [], null);
  press();
  assert.equal(modes().at(-1), 'free');
  assert.equal(trackingCamera.length, 5);
});

test('post selection releases follow, but a newer location action cancels delayed pin centering', () => {
  const { command, messages, camera, trackingCamera, trackingEvent, refresh, advance, reproject } = mountMap([ownPin], point);
  const press = () => command({ type: 'cycle-location-tracking', bottomInset: 180 });
  press();
  command({ type: 'select-post-pin', id: ownPin.id, modeRevision: 0 });
  assert.equal(messages.at(-1).mode, 'free');
  command({ type: 'center-post-pin', id: ownPin.id, modeRevision: 0, bottomInset: 180 });
  assert.deepEqual(camera, ['stop', 'focus']);
  reproject(() => ({ x: 220, y: 250 }));
  press();
  command({ type: 'center-post-pin', id: ownPin.id, modeRevision: 0, bottomInset: 180 });
  assert.deepEqual(camera, ['stop', 'focus']);
  refresh(1, 0, [ownPin], { ...point, longitude: point.longitude + 0.0001 });
  advance(16);
  assert.equal(trackingCamera.length, 3);
  trackingEvent('drag', { touches: [{}] });
  command({ type: 'center-post-pin', id: ownPin.id, modeRevision: 0, bottomInset: 180 });
  assert.deepEqual(camera, ['stop', 'focus']);
});

test('the existing WebView rebuilds clusters by mode and cancels only the old pin focus', () => {
  const { loadedIds, messages, camera, visible, command, refresh, zoomToPins } = mountMap([ownPin, otherPin]);
  const oldClusterTap = [...visible][0].events.get('click');
  assert.deepEqual(loadedIds, [[1, 2]]);

  refresh(1, 1, [ownPin, privatePin]);
  assert.deepEqual(loadedIds.at(-1), [1, 3]);
  assert.equal(messages.at(-1).modeRevision, 1);
  oldClusterTap();
  assert.deepEqual(camera, []);

  zoomToPins();
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

test('panning preloads markers beyond the screen and replenishes the buffer before movement ends', () => {
  const pins = [0, 2.5, 4, 9].map((longitude, id) => ({ ...otherPin, latitude: 0, longitude, id: id + 10 }));
  const { html, loadedIds, queries, networkRequests, visible, move, moveEnd, advance } = mountMap(pins, null, false, {
    lng: 0, lat: 0, longitudeSpan: 4, latitudeSpan: 2, zoom: 17,
  });
  const markerAt = longitude => [...visible].find(element => element.marker.getLngLat().lng === longitude);

  assert.match(html, /map\.on\('move', scheduleMarkerViewportCheck\)/);
  assert.match(html, /map\.on\('moveend', refreshMarkerViewport\)/);
  assert.deepEqual(queries[0].bbox, [-3, -1.5, 3, 1.5]);
  const lastVisible = markerAt(0);
  const prefetched = markerAt(2.5);
  assert.ok(prefetched);
  assert.equal(markerAt(4), undefined);

  move({ lng: 0.4 });
  advance(16);
  assert.equal(queries.length, 1);
  assert.equal(markerAt(2.5), prefetched);

  move({ lng: 0.8 });
  move({ lng: 1.2 });
  advance(32);
  assert.equal(queries.length, 2);
  assert.equal(markerAt(0), lastVisible);
  assert.equal(markerAt(2.5), prefetched);
  const next = markerAt(4);
  assert.ok(next);

  // Simulate a fast inertial step that brings a different section into view before moveend.
  move({ lng: 5.5 });
  advance(48);
  assert.equal(queries.length, 3);
  assert.equal(markerAt(4), next);
  assert.equal(markerAt(0), undefined);

  // A final viewport that overtakes the previous buffer is filled and the pending frame is cancelled.
  move({ lng: 7 });
  moveEnd();
  assert.equal(queries.length, 4);
  assert.equal(markerAt(4), next);
  assert.ok(markerAt(9));
  assert.equal(markerAt(0), undefined);
  advance(64);
  moveEnd();
  assert.equal(queries.length, 4);
  assert.equal(loadedIds.length, 1);
  assert.deepEqual(networkRequests, ['https://tiles.openfreemap.org/styles/liberty']);
});

test('clusters keep their DOM elements while panning and switch before zoom motion ends at an integer level', () => {
  const pins = [{ ...otherPin, latitude: 0, longitude: 0 }, { ...ownPin, latitude: 0, longitude: 0.1 }];
  const { queries, visible, move, advance, loadedIds, camera } = mountMap(pins, null, false, {
    lng: 0, lat: 0, longitudeSpan: 4, latitudeSpan: 2,
  });
  const [cluster] = visible;

  move({ lng: 0.8, zoom: 16.9 });
  advance(16);
  assert.equal(queries.length, 2);
  assert.equal(queries[1].zoom, 16);
  assert.ok(visible.has(cluster));
  cluster.events.get('click')();
  assert.deepEqual(camera, ['cluster']);

  move({ zoom: 17 });
  advance(32);
  assert.equal(queries[2].zoom, 17);
  assert.equal(visible.size, 2);
  assert.ok([...visible].every(element => element.classList.contains('post-pin-bubble')));
  assert.equal(loadedIds.length, 1);
});

test('a viewport rotation refreshes its expanded corners and longitude wrapping does not discard the buffer', () => {
  const acrossDateLine = { ...otherPin, latitude: 0, longitude: -179 };
  const afterRotation = { ...ownPin, latitude: 2.5, longitude: -179.9 };
  const { queries, visible, move, advance } = mountMap([acrossDateLine, afterRotation], null, false, {
    lng: 179.9, lat: 0, longitudeSpan: 4, latitudeSpan: 2, zoom: 17,
  });
  const [marker] = visible;
  assert.equal(marker.marker.getLngLat().lng, -179);
  move({ lng: -179.95 });
  advance(16);
  assert.equal(queries.length, 1);
  assert.ok(visible.has(marker));

  move({ angle: 90 });
  advance(32);
  assert.equal(queries.length, 2);
  assert.ok(visible.has(marker));
  assert.ok([...visible].some(element => element.marker.getLngLat().lat === 2.5));
});

test('every pin uses the same anchored bubble and only non-owner out-of-range pins use gray', () => {
  const farOtherPin = { ...otherPin, id: 4, nearby: false, withinRadius: false };
  const { html, camera, messages, visible, command, zoomToPins } = mountMap([otherPin, privatePin, ownPin, farOtherPin]);
  const [cluster] = visible;
  assert.equal(cluster.children[0].textContent, '4');
  assert.equal(cluster.attributes.get('aria-label'), '4件の投稿を拡大表示');
  cluster.events.get('click')();
  assert.deepEqual(camera, ['cluster']);

  zoomToPins();
  const [other, owner, farOwner, farOther] = visible;
  assert.match(other.innerHTML, /M9\.5 13h13m-13 5\.5h9/);
  assert.match(owner.innerHTML, /<circle/);
  for (const element of [other, owner, farOwner, farOther]) {
    assert.ok(element.classList.contains('post-pin-bubble'));
    assert.equal(element.marker.anchor, 'bottom');
    const position = element.marker.getLngLat();
    assert.equal(position.lng, point.longitude);
    assert.equal(position.lat, point.latitude);
  }
  assert.match(html, /fill: #D1D3D5; stroke: #686D72/);
  assert.match(html, /fill 500ms ease-in-out, stroke 500ms ease-in-out/);
  assert.match(html, /post-pin-selected:not\(\.post-pin-outside\)/);
  assert.ok(!farOwner.classList.contains('post-pin-outside'));
  assert.ok(!farOwner.classList.contains('post-pin-range-transition'));
  assert.ok(farOther.classList.contains('post-pin-outside'));
  assert.ok(farOther.classList.contains('post-pin-range-transition'));
  assert.equal(farOther.attributes.get('aria-label'), '投稿までの距離を表示');
  command({ type: 'select-post-pin', modeRevision: 0, id: 4 });
  assert.ok(farOther.classList.contains('post-pin-selected'));
  assert.ok(farOther.classList.contains('post-pin-outside'));

  owner.events.get('click')();
  assert.deepEqual(messages.at(-1), { type: 'pin', id: 3, modeRevision: 0 });
  const ownerIcon = owner.innerHTML;
  command({ type: 'select-post-pin', modeRevision: 0, id: 3 });
  assert.ok(owner.classList.contains('post-pin-selected'));
  assert.equal(owner.attributes.get('aria-pressed'), 'true');
  assert.equal(owner.innerHTML, ownerIcon);
  command({ type: 'select-post-pin', modeRevision: 0, id: null });
  assert.ok(!owner.classList.contains('post-pin-selected'));
  assert.equal(owner.attributes.get('aria-pressed'), 'false');
});

test('the straight line grows from the displayed location, fits both points and follows movement and map projection', () => {
  const first = { ...otherPin, id: 4, latitude: 36.61, nearby: false, withinRadius: false };
  const second = { ...first, id: 5, longitude: 138.21 };
  const { visible, line, command, refresh, fits, advance, reproject, loadedIds } = mountMap([first, second], point);
  const project = ([longitude, latitude]) => ({ x: longitude, y: latitude });
  const select = id => command({ type: 'select-post-pin', id, modeRevision: 0 });
  reproject(project);
  select(first.id);
  assert.equal(line.attributes.get('visibility'), 'hidden');
  assert.ok([...visible].some(element => element.classList.contains('post-pin-selected')));
  advance(250);
  assert.equal(line.attributes.get('visibility'), 'visible');
  assert.equal(line.attributes.get('y1'), point.latitude);
  assert.ok(line.attributes.get('y2') > point.latitude && line.attributes.get('y2') < first.latitude);
  advance(500);
  assert.equal(line.attributes.get('y2'), first.latitude);
  command({ type: 'center-post-pin', id: first.id, modeRevision: 0, bottomInset: 200 });
  assert.deepEqual(JSON.parse(JSON.stringify(fits[0].bounds)), [[138.2, 36.6], [138.2, 36.61]]);
  assert.equal(fits[0].options.bearing, 27);
  assert.ok(fits[0].options.padding.bottom > 200);

  const moved = { latitude: 36.602, longitude: 138.201 };
  refresh(1, 0, [first, second], moved);
  assert.equal(line.attributes.get('y1'), moved.latitude);
  assert.equal(line.attributes.get('y2'), first.latitude);
  reproject(([longitude, latitude]) => ({ x: latitude * 2, y: -longitude * 2 }));
  assert.equal(line.attributes.get('x1'), moved.latitude * 2);
  assert.equal(line.attributes.get('y2'), -first.longitude * 2);

  select(second.id);
  assert.equal(line.attributes.get('visibility'), 'hidden');
  advance(1000);
  assert.equal(line.attributes.get('y2'), -second.longitude * 2);
  const selectedMarker = [...visible].find(element => element.classList.contains('post-pin-selected'));
  refresh(2, 0, [first, { ...second, withinRadius: true }], moved);
  assert.ok(visible.has(selectedMarker));
  assert.equal(loadedIds.length, 1);
  assert.equal(line.attributes.get('visibility'), 'visible');
  advance(1250);
  assert.ok(Math.abs(line.attributes.get('opacity') - 0.5) < 0.001);
  refresh(3, 0, [first, { ...second, withinRadius: true }], moved);
  advance(1500);
  assert.equal(line.attributes.get('visibility'), 'hidden');
  assert.ok(![...visible].some(element => element.classList.contains('post-pin-selected') &&
    element.classList.contains('post-pin-outside')));

  select(first.id);
  advance(1750);
  select(null);
  advance(2000);
  assert.equal(line.attributes.get('visibility'), 'hidden');
  select(first.id);
  refresh(4, 0, [first, second], null);
  advance(2500);
  assert.equal(line.attributes.get('visibility'), 'hidden');
});

test('returning outside mid-fade reverses from the current opacity and keeps the same marker', () => {
  const far = { ...otherPin, latitude: 36.61, nearby: false, withinRadius: false };
  const { line, visible, command, refresh, advance } = mountMap([far], point);
  const selected = [...visible].find(element => element.classList.contains('post-pin-bubble'));
  command({ type: 'select-post-pin', id: far.id, modeRevision: 0 });
  advance(500);
  refresh(1, 0, [{ ...far, withinRadius: true }]);
  advance(750);
  assert.ok(Math.abs(line.attributes.get('opacity') - 0.5) < 0.001);
  refresh(2, 0, [far]);
  advance(1000);
  assert.ok(line.attributes.get('opacity') > 0.5);
  assert.equal(line.attributes.get('visibility'), 'visible');
  advance(1250);
  assert.equal(line.attributes.get('opacity'), 1);
  assert.ok(visible.has(selected));
  assert.ok(selected.classList.contains('post-pin-outside'));
});

test('reduced motion displays the full line immediately and selecting own posts clears it', () => {
  const far = { ...otherPin, latitude: 36.61, nearby: false, withinRadius: false };
  const { line, command, reproject } = mountMap([far, ownPin], point, true);
  reproject(([longitude, latitude]) => ({ x: longitude, y: latitude }));
  command({ type: 'select-post-pin', id: far.id, modeRevision: 0 });
  assert.equal(line.attributes.get('visibility'), 'visible');
  assert.equal(line.attributes.get('y2'), far.latitude);
  command({ type: 'select-post-pin', id: ownPin.id, modeRevision: 0 });
  assert.equal(line.attributes.get('visibility'), 'hidden');
});
