import type { DisplayPosition } from '../location/displayPosition';
import { RADIUS_METERS } from './filterNearbyPosts';

export type MapPoint = { latitude: number; longitude: number };
export type MapSnapshot = {
  current: MapPoint | null;
  displayPosition: DisplayPosition | null;
  pins: (MapPoint & { id: number; nearby: boolean })[];
};

// 固定バージョンとハッシュで、WebView内で実行する配信ファイルを限定する。
export const openFreeMapDocument = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' https://unpkg.com; style-src 'unsafe-inline' https://unpkg.com; connect-src https://tiles.openfreemap.org; img-src data: blob: https://tiles.openfreemap.org; worker-src blob:">
  <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@5.6.0/dist/maplibre-gl.css"
        integrity="sha384-Nq6PQ+9vJPvw7U/VfDELyrWoGQMsy0gi6QShhaSrGzkpF5KkM40csg2leky+YMTd" crossorigin="anonymous">
  <script src="https://unpkg.com/maplibre-gl@5.6.0/dist/maplibre-gl.js"
          integrity="sha384-GfxBM9x46BaAFxtCq39Fxir8fNZ4VDnwgfi6Kzi5/F1tAFsm0amuuV8kd+Pxzuf/" crossorigin="anonymous"></script>
  <style>
    html, body, #map { width: 100%; height: 100%; margin: 0; overflow: hidden; background: #edf0ec; }
    #range { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
    .current-dot { width: 18px; height: 18px; }
    .current-bearing { position: absolute; inset: 0; pointer-events: none; }
    .current-cone { position: absolute; left: 50%; top: 50%; margin: -56px 0 0 -56px;
      width: 112px; height: 112px; transition: transform 160ms cubic-bezier(.22, .61, .36, 1); }
    .current-dot::after { content: ''; position: absolute; inset: 0; border: 2px solid white;
      border-radius: 50%; background: #147df1; box-shadow: 0 0 0 2px #147df14a; }
  </style>
</head>
<body>
<div id="map"></div>
<canvas id="range" aria-hidden="true"></canvas>
<script type="application/json" id="initial-map-snapshot">null</script>
<script>
  const send = message => window.ReactNativeWebView?.postMessage(JSON.stringify(message));
  const mapElement = document.getElementById('map');
  const mask = document.getElementById('range');
  const context = mask.getContext('2d');
  const radius = ${RADIUS_METERS};
  const radians = Math.PI / 180;
  const pins = new Map();
  const initial = JSON.parse(document.getElementById('initial-map-snapshot').textContent);
  let map;
  let ready = false;
  let latestRequestId = 0;
  let current = null;
  let displayedPosition = null;
  let markerTarget = null;
  let positionFrame = null;
  let currentMarker;
  let bearingLayer;
  let cone;
  let headingAngle = Number.isFinite(initial?.heading) ? initial.heading : null;
  let latestHeadingRequestId = 0;
  let centered = false;

  function walkingStyle(style) {
    const poiClass = ['get', 'class'];
    const poiSubclass = ['get', 'subclass'];
    const allowed = ['any',
      ['match', poiClass, ['park', 'garden', 'museum', 'zoo', 'attraction', 'place_of_worship', 'monument', 'historic'], true, false],
      ['match', poiSubclass, ['park', 'garden', 'museum', 'zoo', 'attraction', 'place_of_worship', 'monument', 'temple', 'castle', 'memorial', 'heritage'], true, false],
    ];
    const exits = ['match', poiSubclass, ['subway_entrance', 'train_station_entrance'], true, false];
    // 現行タイルの railway/station と、Liberty の従来の rail 分類に対応する。
    const station = ['all', ['!', exits], ['any', ['==', poiClass, 'rail'],
      ['all', ['==', poiClass, 'railway'], ['match', poiSubclass, ['station', 'halt'], true, false]],
    ]];
    const label = ['coalesce', ['get', 'name:ja'], ['get', 'name:nonlatin'], ['get', 'name']];
    const layers = style.layers.filter(layer => layer['source-layer'] !== 'poi');
    const transit = style.layers.find(layer => layer.id === 'poi_transit');
    if (!transit) throw new Error('Missing POI source');
    layers.push(
      { ...transit, id: 'walking-stations', minzoom: 12, filter: station,
        layout: { ...transit.layout, 'icon-image': 'railway', 'icon-optional': true,
          'text-field': label, 'text-font': ['Noto Sans Regular'] } },
      { ...transit, id: 'walking-landmarks', minzoom: 13, filter: ['all', allowed, ['has', 'name'], ['!', station], ['!', exits]],
        layout: { ...transit.layout, 'icon-image': ['to-string', poiClass],
          'icon-optional': true, 'text-field': label, 'text-font': ['Noto Sans Regular'] } },
      { ...transit, id: 'walking-station-exits', minzoom: 17, filter: exits,
        layout: { ...transit.layout, 'icon-image': 'railway_metro', 'icon-size': 0.5, 'icon-optional': true,
          'text-field': ['concat', ['coalesce', ['get', 'ref'], label, '駅'], ' 入口'],
          'text-font': ['Noto Sans Regular'], 'text-size': 11 } },
    );
    return { ...style, layers };
  }

  function drawRange() {
    if (!context || !map) return;
    const width = mapElement.clientWidth;
    const height = mapElement.clientHeight;
    const scale = window.devicePixelRatio || 1;
    const pixelsWide = Math.round(width * scale);
    const pixelsHigh = Math.round(height * scale);
    if (mask.width !== pixelsWide) mask.width = pixelsWide;
    if (mask.height !== pixelsHigh) mask.height = pixelsHigh;
    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.clearRect(0, 0, width, height);
    if (!current) return;

    // 円周上の座標を地球上の距離で求めて投影し、ズーム・画面移動に追従させる。
    const { latitude, longitude } = current;
    const lat = latitude * radians;
    const lon = longitude + 360 * Math.round((map.getCenter().lng - longitude) / 360);
    const angular = radius / 6371000;
    const ring = Array.from({ length: 64 }, (_, index) => {
      const bearing = index * 2 * Math.PI / 64;
      const nextLat = Math.asin(Math.sin(lat) * Math.cos(angular) +
        Math.cos(lat) * Math.sin(angular) * Math.cos(bearing));
      const deltaLon = Math.atan2(Math.sin(bearing) * Math.sin(angular) * Math.cos(lat),
        Math.cos(angular) - Math.sin(lat) * Math.sin(nextLat));
      return map.project([lon + deltaLon / radians, nextLat / radians]);
    });
    const traceCircle = () => {
      context.moveTo(ring[0].x, ring[0].y);
      for (const point of ring.slice(1)) context.lineTo(point.x, point.y);
      context.closePath();
    };
    // 円が画面外に出ても、描画領域内の円の外側だけに色を載せる。
    context.beginPath();
    context.rect(0, 0, width, height);
    traceCircle();
    context.fillStyle = 'rgba(105, 113, 117, .16)';
    context.fill('evenodd');
    context.beginPath();
    traceCircle();
    context.strokeStyle = 'rgba(62, 84, 81, .66)';
    context.lineWidth = 1.5;
    context.stroke();
  }

  function makePin(pin) {
    const marker = new maplibregl.Marker({ color: pin.nearby ? '#B43A37' : '#446C9A' });
    const element = marker.getElement();
    element.setAttribute('role', 'button');
    element.setAttribute('aria-label', pin.nearby ? '投稿詳細を開く' : '投稿までの距離を表示');
    element.tabIndex = 0;
    const select = () => send({ type: 'pin', id: pin.id });
    element.addEventListener('click', select);
    element.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        select();
      }
    });
    marker.setLngLat([pin.longitude, pin.latitude]).addTo(map);
    return marker;
  }

  function updatePins(snapshot) {
    const present = new Set(snapshot.pins.map(pin => pin.id));
    for (const [id, entry] of pins) {
      if (!present.has(id)) {
        entry.marker.remove();
        pins.delete(id);
      }
    }
    for (const pin of snapshot.pins) {
      const entry = pins.get(pin.id);
      if (entry && entry.nearby === pin.nearby) {
        entry.marker.setLngLat([pin.longitude, pin.latitude]);
      } else {
        const marker = makePin(pin);
        entry?.marker.remove();
        pins.set(pin.id, { marker, nearby: pin.nearby });
      }
    }
  }

  function recenterMap(bottomInset = 0) {
    if (!current) return;
    // シートに隠れる領域を除いた地図の中央に現在地を置く。
    const inset = Math.min(Math.max(0, bottomInset), mapElement.clientHeight);
    map.flyTo({ center: [current.longitude, current.latitude], zoom: 16, duration: 750, offset: [0, -inset / 2] });
  }

  function updateBearing() {
    if (bearingLayer) bearingLayer.style.transform = 'rotate(' + -map.getBearing() + 'deg)';
  }

  function drawHeading() {
    if (!cone) return;
    bearingLayer.hidden = headingAngle === null;
    if (headingAngle !== null) cone.style.transform = 'rotate(' + headingAngle + 'deg)';
  }

  function updateHeading(degrees) {
    if (degrees === null || headingAngle === null) {
      headingAngle = degrees;
    } else {
      // 359度と1度の間は、北をまたぐ短い経路で回す。
      const delta = ((degrees - headingAngle) % 360 + 540) % 360 - 180;
      headingAngle += delta;
    }
    drawHeading();
  }

  function cancelPositionAnimation() {
    if (positionFrame === null) return;
    cancelAnimationFrame(positionFrame);
    positionFrame = null;
  }

  function animatePosition(point) {
    cancelPositionAnimation();
    // 測位が続いても、画面に出ている位置から次の座標へ移動する。
    const start = displayedPosition;
    const startedAt = performance.now();
    const longitudeDelta = ((point.longitude - start.longitude + 540) % 360) - 180;
    function frame(now) {
      const progress = Math.min(Math.max((now - startedAt) / point.durationMs, 0), 1);
      const eased = 1 - (1 - progress) ** 2;
      displayedPosition = progress === 1 ? point : {
        latitude: start.latitude + (point.latitude - start.latitude) * eased,
        longitude: start.longitude + longitudeDelta * eased,
      };
      currentMarker.setLngLat([displayedPosition.longitude, displayedPosition.latitude]);
      positionFrame = progress < 1 ? requestAnimationFrame(frame) : null;
    }
    positionFrame = requestAnimationFrame(frame);
  }

  function updateCurrent(point, displayPoint) {
    current = point;
    if (current) {
      const target = displayPoint ?? { ...current, durationMs: 450 };
      if (!currentMarker) {
        const dot = document.createElement('div');
        dot.className = 'current-dot';
        dot.setAttribute('aria-label', '現在地');
        // 扇形は青い点の子要素にし、MapLibreの位置更新を共有する。
        dot.innerHTML = '<div class="current-bearing" hidden aria-hidden="true">' +
          '<svg class="current-cone" viewBox="0 0 112 112">' +
          '<defs><radialGradient id="heading-fade" cx="56" cy="56" r="56" gradientUnits="userSpaceOnUse">' +
          '<stop offset="15%" stop-color="#147DF1" stop-opacity=".42"/>' +
          '<stop offset="100%" stop-color="#147DF1" stop-opacity="0"/>' +
          '</radialGradient></defs>' +
          '<path d="M24.69 9.57 A56 56 0 0 1 87.31 9.57 L61.59 47.71 A10 10 0 0 0 50.41 47.71 Z" fill="url(#heading-fade)"/>' +
          '</svg></div>';
        bearingLayer = dot.querySelector('.current-bearing');
        cone = dot.querySelector('.current-cone');
        currentMarker = new maplibregl.Marker({ element: dot, subpixelPositioning: true })
          .setLngLat([target.longitude, target.latitude]).addTo(map);
        displayedPosition = target;
        updateBearing();
        drawHeading();
      } else if (markerTarget.latitude !== target.latitude || markerTarget.longitude !== target.longitude) {
        if (target.durationMs > 0) {
          animatePosition(target);
        } else {
          cancelPositionAnimation();
          currentMarker.setLngLat([target.longitude, target.latitude]);
          displayedPosition = target;
        }
      }
      markerTarget = target;
      if (!centered) {
        recenterMap();
        centered = true;
      }
    } else {
      cancelPositionAnimation();
      displayedPosition = null;
      markerTarget = null;
      currentMarker?.remove();
      currentMarker = undefined;
      bearingLayer = undefined;
      cone = undefined;
    }
  }

  function applySnapshot(snapshot) {
    let issue;
    try { updateCurrent(snapshot.current, snapshot.displayPosition); } catch { issue = 'position'; }
    try { drawRange(); } catch { issue ||= 'range'; }
    try { updatePins(snapshot); } catch { issue ||= 'pins'; }
    return issue;
  }

  window.receiveKokoMapCommand = command => {
    if (!ready) return;
    if (command?.type === 'recenter') {
      if (!Number.isFinite(command.bottomInset)) return;
      try { recenterMap(command.bottomInset); } catch { send({ type: 'recenter-failed' }); }
      return;
    }
    if (command?.type === 'heading') {
      const { requestId, heading } = command;
      if (!Number.isSafeInteger(requestId) || requestId < latestHeadingRequestId) return;
      if (heading !== null && (!Number.isFinite(heading) || heading < 0 || heading >= 360)) return;
      if (requestId > latestHeadingRequestId) {
        latestHeadingRequestId = requestId;
        updateHeading(heading);
      }
      send({ type: 'heading-applied', requestId });
      return;
    }
    if (command?.type !== 'snapshot' || !Array.isArray(command.snapshot?.pins)) return;
    if (!Number.isSafeInteger(command.requestId) || command.requestId < latestRequestId) return;
    latestRequestId = command.requestId;
    const issue = applySnapshot(command.snapshot);
    send({ type: issue ? 'overlay-error' : 'overlay-applied', issue, requestId: command.requestId });
  };

  function receiveCommand(event) {
    if (typeof event.data !== 'string') return;
    let command;
    try { command = JSON.parse(event.data); } catch { return; }
    window.receiveKokoMapCommand(command);
  }

  // react-native-webview は iOS では window、Android では document に送る。
  window.addEventListener('message', event => {
    if (event.target === window) receiveCommand(event);
  });
  document.addEventListener('message', receiveCommand);

  const timer = setTimeout(() => send({ type: 'map-error' }), 20000);
  (async () => {
    try {
      const response = await fetch('https://tiles.openfreemap.org/styles/liberty');
      if (!response.ok) throw new Error('Map style unavailable');
      const style = walkingStyle(await response.json());
      const point = initial?.current;
      map = new maplibregl.Map({
        container: mapElement, style,
        center: point ? [point.longitude, point.latitude] : [138, 36],
        zoom: point ? 16 : 4.5,
        attributionControl: false, bearing: 0, dragRotate: false, pitchWithRotate: false, maxPitch: 0,
      });
      mapElement.insertBefore(mask, map.getCanvasContainer().nextSibling);
      map.on('move', drawRange);
      map.on('resize', drawRange);
      map.on('rotate', updateBearing);
      const viewportObserver = new ResizeObserver(() => map.resize());
      viewportObserver.observe(mapElement);
      map.once('remove', () => {
        viewportObserver.disconnect();
        cancelPositionAnimation();
      });
      map.once('load', () => {
        ready = true;
        clearTimeout(timer);
        centered = Boolean(point);
        const issue = initial ? applySnapshot(initial) : undefined;
        send({ type: 'ready', issue });
      });
    } catch {
      clearTimeout(timer);
      send({ type: 'map-error' });
    }
  })();
</script>
</body>
</html>`;

// 初回描画はネイティブからの実行コマンドが届く前でも行えるようにする。
export function createOpenFreeMapDocument(snapshot: MapSnapshot, heading: number | null = null): string {
  const json = JSON.stringify({ ...snapshot, heading }).replace(/</g, '\\u003c');
  return openFreeMapDocument.replace(
    '<script type="application/json" id="initial-map-snapshot">null</script>',
    () => `<script type="application/json" id="initial-map-snapshot">${json}</script>`,
  );
}
