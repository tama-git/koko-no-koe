import type { DisplayPosition } from '../location/displayPosition';
import { RADIUS_METERS } from './filterNearbyPosts';
import { uiColors } from '../shared/uiColors';

export type MapPoint = { latitude: number; longitude: number };
export type MapSnapshot = {
  current: MapPoint | null;
  displayPosition: DisplayPosition | null;
  modeRevision: number;
  pins: (MapPoint & { id: number; nearby: boolean; withinRadius: boolean; isOwn?: boolean })[];
};

const POST_PIN_COLOR = '#627388';
const OUTSIDE_PIN_FILL = '#D1D3D5';
const OUTSIDE_PIN_STROKE = '#686D72';
const DISTANCE_LINE_DURATION_MS = 500;
const RANGE_TRANSITION_MS = 500;
const POST_PIN_CLUSTER_MAX_ZOOM = 16;
const POST_PIN_FOCUS_ZOOM = POST_PIN_CLUSTER_MAX_ZOOM + 1;
const MARKER_PREFETCH_PADDING = 0.25;
const LOCATION_CAMERA_DURATION_MS = 500;
const CURRENT_LOCATION_ZOOM = 16;

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
  <script src="https://unpkg.com/supercluster@8.0.1/dist/supercluster.min.js" crossorigin="anonymous"></script>
  <style>
    html, body, #map { width: 100%; height: 100%; margin: 0; overflow: hidden; background: ${uiColors.background}; }
    #range, #post-distance-overlay { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
    .current-dot { width: 18px; height: 18px; z-index: 2; pointer-events: none; }
    .current-bearing { position: absolute; inset: 0; pointer-events: none; }
    .current-cone { position: absolute; left: 50%; top: 50%; margin: -56px 0 0 -56px;
      width: 112px; height: 112px; transition: transform 160ms cubic-bezier(.22, .61, .36, 1); }
    .current-dot::after { content: ''; position: absolute; inset: 0; border: 2px solid white;
      border-radius: 50%; background: #147df1; box-shadow: 0 0 0 2px #147df14a; }
    .post-pin-selected { z-index: 1; }
    .post-pin-bubble, .cluster-marker {
      width: 44px;
      height: 44px;
      display: grid;
      place-items: center;
      cursor: pointer;
      user-select: none;
    }
    .post-pin-bubble > svg {
      align-self: end;
      display: block;
      width: 32px;
      height: 37px;
      color: ${POST_PIN_COLOR};
      overflow: visible;
      filter: drop-shadow(0 1px 1px rgba(0, 0, 0, .14));
      transform-origin: 50% 100%;
      transition: transform 180ms ease-out, color 180ms ease-out;
    }
    .post-pin-bubble-shape {
      fill: #ffffff;
      stroke: ${POST_PIN_COLOR};
      stroke-width: 1.7px;
      stroke-linejoin: round;
      transition: fill 180ms ease-out;
    }
    .post-pin-bubble.post-pin-selected > svg { transform: scale(1.12); }
    .post-pin-bubble.post-pin-selected:not(.post-pin-outside) > svg { color: #ffffff; }
    .post-pin-bubble.post-pin-selected:not(.post-pin-outside) .post-pin-bubble-shape { fill: ${POST_PIN_COLOR}; }
    .post-pin-bubble.post-pin-outside > svg { color: ${OUTSIDE_PIN_STROKE}; }
    .post-pin-outside .post-pin-bubble-shape { fill: ${OUTSIDE_PIN_FILL}; stroke: ${OUTSIDE_PIN_STROKE}; }
    .post-pin-range-transition > svg { transition: transform 180ms ease-out, color ${RANGE_TRANSITION_MS}ms ease-in-out; }
    .post-pin-range-transition .post-pin-bubble-shape {
      transition: fill ${RANGE_TRANSITION_MS}ms ease-in-out, stroke ${RANGE_TRANSITION_MS}ms ease-in-out;
    }
    @media (prefers-reduced-motion: reduce) {
      .current-cone, .post-pin-bubble > svg, .post-pin-bubble-shape, .post-pin-range-transition .post-pin-bubble-shape {
        transition: none;
      }
    }
    .cluster-marker-count {
      box-sizing: border-box;
      min-width: 34px;
      width: max-content;
      aspect-ratio: 1;
      padding: 0 3px;
      background: #ffffff;
      color: ${POST_PIN_COLOR};
      border-radius: 50%;
      display: grid;
      place-items: center;
      font: 700 14px system-ui, sans-serif;
      box-shadow: 0 1px 2px rgba(0, 0, 0, .14);
      border: 1.7px solid ${POST_PIN_COLOR};
    }
  </style>
</head>
<body>
<div id="map"></div>
<canvas id="range" aria-hidden="true"></canvas>
<svg id="post-distance-overlay" aria-hidden="true">
  <line id="post-distance-line" visibility="hidden" stroke="${OUTSIDE_PIN_STROKE}"
        stroke-width="2.25" stroke-linecap="round" stroke-dasharray="5 6" />
</svg>
<script type="application/json" id="initial-map-snapshot">null</script>
<script>
  const send = message => window.ReactNativeWebView?.postMessage(JSON.stringify(message));
  const mapElement = document.getElementById('map');
  const mask = document.getElementById('range');
  const context = mask.getContext('2d');
  const distanceOverlay = document.getElementById('post-distance-overlay');
  const distanceLine = document.getElementById('post-distance-line');
  const radius = ${RADIUS_METERS};
  const radians = Math.PI / 180;
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
  let trackingMode = 'free';
  let positionTrackingBearing = 0;
  let trackingBottomInset = 0;
  let trackingCameraFrame = null;
  let userCameraMoving = false;
  let mapTouchCount = 0;

  // クラスタリング管理用の変数
  let clusterIndex = null;
  const clusterMarkers = new Map();
  let markerPrefetch = null;
  let markerUpdateFrame = null;
  const activePostPins = new Map();
  const postPinsById = new Map();
  let selectedPostPinId = null;
  let hasExtraSelectedMarker = false;
  let pendingPostPinCenter = null;
  let postPinCenterSuppressed = false;
  let pinModeRevision = initial?.modeRevision ?? 0;
  let appliedPinModeRevision = null;
  let distanceLineId = null;
  let distanceLineProgress = 0;
  let distanceLineOpacity = 0;
  let distanceLineOpacityTarget = 0;
  let distanceLineFrame = null;

  // 背景地図のスタイルを、徒歩で参照しやすい道路・施設の表示に調整する。
  function walkingStyle(style) {
    const poiClass = ['get', 'class'];
    const poiSubclass = ['get', 'subclass'];
    const allowed = ['any',
      ['match', poiClass, ['park', 'garden', 'museum', 'zoo', 'attraction', 'place_of_worship', 'monument', 'historic'], true, false],
      ['match', poiSubclass, ['park', 'garden', 'museum', 'zoo', 'attraction', 'place_of_worship', 'monument', 'temple', 'castle', 'memorial', 'heritage'], true, false],
    ];
    const exits = ['match', poiSubclass, ['subway_entrance', 'train_station_entrance'], true, false];
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

  // 地図上の現在地を中心に閲覧半径を描画する。
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

  // ピンの選択表示を更新する。
  function applyPostPinSelection(id, marker) {
    const element = marker.getElement();
    const selected = id === selectedPostPinId;
    element.classList.toggle('post-pin-selected', selected);
    element.setAttribute('aria-pressed', String(selected));
  }

  // 選択したピンを切り替え、地図の移動と距離表示を更新する。
  function selectPostPin(id) {
    if (id === selectedPostPinId) return;
    const previousId = selectedPostPinId;
    selectedPostPinId = id;
    postPinCenterSuppressed = false;
    const shouldStopCentering = pendingPostPinCenter !== null;
    pendingPostPinCenter = null;
    if (shouldStopCentering) map.stop();
    if (id !== null) releaseLocationCamera();
    if (hasExtraSelectedMarker || (postPinsById.has(id) && !activePostPins.has(id))) {
      updateClusterMarkers();
    } else {
      const previous = activePostPins.get(previousId);
      if (previous) applyPostPinSelection(previousId, previous);
      const selected = activePostPins.get(id);
      if (selected) applyPostPinSelection(id, selected);
    }
    syncDistanceLine();
  }

  // 距離を表示する条件を満たす選択中のピンを返す。
  function distancePin() {
    const pin = postPinsById.get(selectedPostPinId);
    return current && pin && !pin.isOwn && !pin.withinRadius ? pin : null;
  }

  // 基準の角度から最も近い360度周期の値へ寄せる。
  function wrapLongitude(longitude, reference) {
    return longitude + 360 * Math.round((reference - longitude) / 360);
  }

  // 現在地と投稿地点を、破線を引くための座標へ変換する。
  function distanceEndpoints(pin) {
    // 地図上の青い現在地マーカーの補間にも合わせ、日付変更線をまたぐ場合は近い世界のコピーを使う。
    const origin = displayedPosition ?? current;
    const longitude = wrapLongitude(origin.longitude, map.getCenter().lng);
    return [[longitude, origin.latitude], [wrapLongitude(pin.longitude, longitude), pin.latitude]];
  }

  // アニメーションの進み具合と透明度を使い、現在地から投稿地点への破線を描く。
  function drawDistanceLine() {
    const pin = postPinsById.get(distanceLineId);
    if (!current || !pin || distanceLineId !== selectedPostPinId || distanceLineProgress <= 0 || distanceLineOpacity <= 0) {
      distanceLine.setAttribute('visibility', 'hidden');
      return;
    }
    const [origin, target] = distanceEndpoints(pin).map(point => map.project(point));
    distanceLine.setAttribute('x1', origin.x);
    distanceLine.setAttribute('y1', origin.y);
    distanceLine.setAttribute('x2', origin.x + (target.x - origin.x) * distanceLineProgress);
    distanceLine.setAttribute('y2', origin.y + (target.y - origin.y) * distanceLineProgress);
    distanceLine.setAttribute('opacity', distanceLineOpacity);
    distanceLine.setAttribute('visibility', 'visible');
  }

  // 破線のアニメーションの次フレームを取り消す。
  function cancelDistanceLineAnimation() {
    if (distanceLineFrame !== null) cancelAnimationFrame(distanceLineFrame);
    distanceLineFrame = null;
  }

  // 破線の長さと透明度を時間に合わせて変化させる。
  function animateDistanceLine(toProgress, toOpacity, duration) {
    cancelDistanceLineAnimation();
    distanceLineOpacityTarget = toOpacity;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      distanceLineProgress = toProgress;
      distanceLineOpacity = toOpacity;
      return;
    }
    const startedAt = performance.now();
    const startProgress = distanceLineProgress;
    const startOpacity = distanceLineOpacity;
    function frame(now) {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = toOpacity === startOpacity ? 1 - (1 - progress) ** 2
        : (1 - Math.cos(progress * Math.PI)) / 2;
      distanceLineProgress = startProgress + (toProgress - startProgress) * eased;
      distanceLineOpacity = startOpacity + (toOpacity - startOpacity) * eased;
      drawDistanceLine();
      distanceLineFrame = progress < 1 ? requestAnimationFrame(frame) : null;
    }
    distanceLineFrame = requestAnimationFrame(frame);
  }

  // 選択中の投稿と圏内外の状態に合わせて破線を表示、更新、または解除する。
  function syncDistanceLine() {
    const outside = distancePin();
    if (outside) {
      if (outside.id !== distanceLineId) {
        distanceLineId = outside.id;
        distanceLineProgress = 0;
        distanceLineOpacity = 1;
        animateDistanceLine(1, 1, ${DISTANCE_LINE_DURATION_MS});
      } else if (distanceLineOpacityTarget === 0) {
        animateDistanceLine(1, 1, ${RANGE_TRANSITION_MS});
      }
    } else if (current && distanceLineId === selectedPostPinId && postPinsById.get(distanceLineId)?.withinRadius) {
      if (distanceLineOpacityTarget !== 0) animateDistanceLine(distanceLineProgress, 0, ${RANGE_TRANSITION_MS});
    } else if (distanceLineId !== null) {
      cancelDistanceLineAnimation();
      distanceLineId = null;
      distanceLineProgress = 0;
      distanceLineOpacity = 0;
      distanceLineOpacityTarget = 0;
    }
    drawDistanceLine();
  }

  // 選択したピンに合わせて地図を移動し、圏外案内では現在地も見える範囲に収める。
  function centerPostPin(id, bottomInset) {
    if (id !== selectedPostPinId || postPinCenterSuppressed || trackingMode !== 'free') return;
    const pin = postPinsById.get(id);
    if (!pin) return;

    const inset = Math.max(0, bottomInset);
    const visibleHeight = mapElement.clientHeight - inset;
    if (visibleHeight < 80) return;

    if (distancePin()) {
      const [[fromLng, fromLat], [toLng, toLat]] = distanceEndpoints(pin);
      const margin = Math.min(36, visibleHeight / 4, mapElement.clientWidth / 4);
      const camera = map.cameraForBounds([
        [Math.min(fromLng, toLng), Math.min(fromLat, toLat)],
        [Math.max(fromLng, toLng), Math.max(fromLat, toLat)],
      ], {
        bearing: map.getBearing(), maxZoom: ${POST_PIN_FOCUS_ZOOM},
        padding: { top: margin, bottom: inset + margin, left: margin, right: margin },
      });
      if (camera) {
        const target = { id };
        pendingPostPinCenter = target;
        map.easeTo({ ...camera, duration: 500 }, { postPinCenter: target });
        return;
      }
    }

    const coordinates = activePostPins.get(id)?.getLngLat() ?? [pin.longitude, pin.latitude];
    const target = { id, coordinates, x: mapElement.clientWidth / 2, y: visibleHeight / 2 };
    const point = map.project(coordinates);
    const [dx, dy] = [point.x - target.x, point.y - target.y];
    const alreadyAtZoom = Math.abs(map.getZoom() - ${POST_PIN_FOCUS_ZOOM}) < 0.001;
    if (alreadyAtZoom && !map.isMoving() && Math.abs(dx) < 1 && Math.abs(dy) < 1) return;

    pendingPostPinCenter = target;
    const eventData = { postPinCenter: target };
    if (alreadyAtZoom) {
      map.panBy([dx, dy], { duration: 420 }, eventData);
    } else {
      map.easeTo({ center: coordinates, zoom: ${POST_PIN_FOCUS_ZOOM}, offset: [0, -inset / 2], duration: 500 },
        eventData);
    }
  }

  // ピンへ移動し終えたとき、その移動の保留状態を解除する。
  function finishPostPinCenter(event) {
    if (pendingPostPinCenter && event.postPinCenter === pendingPostPinCenter) pendingPostPinCenter = null;
  }

  // 投稿とクラスタのマーカーを地図から取り除く。
  function clearMarkers() {
    clearClusterMarkers();
    markerPrefetch = null;
    for (const marker of activePostPins.values()) marker.remove();
    activePostPins.clear();
    hasExtraSelectedMarker = false;
  }

  // クラスタのマーカーを地図から取り除く。
  function clearClusterMarkers() {
    for (const marker of clusterMarkers.values()) marker.remove();
    clusterMarkers.clear();
  }

  // 地図に重ねる投稿ピンの要素を組み立てる。
  function createPostMarker({ isOwn }) {
    const element = document.createElement('div');
    element.className = 'post-pin post-pin-bubble';
    if (!isOwn) element.classList.add('post-pin-range-transition');
    const symbol = isOwn
      ? '<circle cx="16" cy="11.5" r="3.5"/>' +
        '<path d="M9.5 23v-2.8a6.5 6.5 0 0 1 13 0V23Z"/>'
      : '<path d="M9.5 13h13m-13 5.5h9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';
    element.innerHTML = '<svg viewBox="0 0 32 37" aria-hidden="true" fill="currentColor">' +
      '<path class="post-pin-bubble-shape" d="M7 2h18a6 6 0 0 1 6 6v15a6 6 0 0 1-6 6h-4l-5 7.15-5-7.15H7a6 6 0 0 1-6-6V8a6 6 0 0 1 6-6Z"/>' +
      symbol + '</svg>';
    // MapLibreは要素の下端を座標に合わせ、拡大は内側のSVGにだけ適用する。
    return new maplibregl.Marker({ element, anchor: 'bottom' });
  }

  // 投稿の所有者と閲覧圏内外に合わせてピンの見た目を更新する。
  function updatePostPinAppearance(pin, marker) {
    const element = marker.getElement();
    element.classList.toggle('post-pin-outside', !pin.withinRadius && !pin.isOwn);
    const label = pin.isOwn || (pin.withinRadius && pin.nearby) ? '投稿詳細を開く' : '投稿までの距離を表示';
    element.setAttribute('aria-label', pin.isOwn ? '自分の投稿：' + label : label);
    applyPostPinSelection(pin.id, marker);
  }

  // 描画対象の投稿ピンを既存のマーカーに反映するか、新しく追加する。
  function showPostPinMarker(pin, renderedModeRevision) {
    const existing = activePostPins.get(pin.id);
    if (existing) {
      const position = existing.getLngLat();
      if (position.lat !== pin.latitude || (position.lng - pin.longitude) % 360 !== 0) {
        existing.setLngLat([pin.longitude, pin.latitude]);
      }
      updatePostPinAppearance(pin, existing);
      return;
    }

    const marker = createPostMarker(pin);
    const element = marker.getElement();
    element.setAttribute('role', 'button');
    element.tabIndex = 0;

    const select = () => {
      if (renderedModeRevision !== pinModeRevision || activePostPins.get(pin.id) !== marker) return;
      send({ type: 'pin', id: pin.id, modeRevision: renderedModeRevision });
    };
    element.addEventListener('click', select);
    element.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        select();
      }
    });

    updatePostPinAppearance(pin, marker);
    marker.setLngLat([pin.longitude, pin.latitude]).addTo(map);
    activePostPins.set(pin.id, marker);
  }

  // 画面に指定の余白を加えた領域を地図座標へ変換する。
  function markerBounds(paddingRatio) {
    const { clientWidth: width, clientHeight: height } = mapElement;
    const padX = width * paddingRatio;
    const padY = height * paddingRatio;
    // 画面の四隅を座標に変換し、地図が回転していても各辺の外側に余裕を取る。
    const corners = [
      [-padX, -padY], [width + padX, -padY],
      [-padX, height + padY], [width + padX, height + padY],
    ].map(point => map.unproject(point));
    const longitudes = corners.map(point => point.lng);
    const latitudes = corners.map(point => point.lat);
    return [Math.min(...longitudes), Math.min(...latitudes), Math.max(...longitudes), Math.max(...latitudes)];
  }

  // 表示中の地図領域が、すでに先読みした範囲に収まっているか判定する。
  function containsMarkerBounds([west, south, east, north], [viewWest, viewSouth, viewEast, viewNorth]) {
    if (viewSouth < south || viewNorth > north) return false;
    if (east - west >= 360) return true;
    // 日付変更線を越えて地図の中心が折り返しても、同じ世界のコピーで比較する。
    const viewCenter = (viewWest + viewEast) / 2;
    const offset = wrapLongitude(viewCenter, (west + east) / 2) - viewCenter;
    return viewWest + offset >= west && viewEast + offset <= east;
  }

  // ズームや表示範囲が先読み条件を外れたらマーカーを更新する。
  function refreshMarkerViewport() {
    cancelMarkerViewportFrame();
    if (!map || !clusterIndex) return;
    if (markerPrefetch?.zoom === Math.floor(map.getZoom()) &&
        containsMarkerBounds(markerPrefetch.refreshBounds, markerBounds(0))) return;
    updateClusterMarkers();
  }

  // 移動中の描画範囲チェックを次の描画フレームにまとめる。
  function scheduleMarkerViewportCheck() {
    if (markerUpdateFrame !== null) return;
    markerUpdateFrame = requestAnimationFrame(() => {
      markerUpdateFrame = null;
      refreshMarkerViewport();
    });
  }

  // 保留している描画範囲チェックを止める。
  function cancelMarkerViewportFrame() {
    if (markerUpdateFrame === null) return;
    cancelAnimationFrame(markerUpdateFrame);
    markerUpdateFrame = null;
  }

  // 複数投稿をまとめた件数マーカーを配置し、タップに応じて地図を拡大する。
  function showClusterMarker(cluster, renderedModeRevision) {
    const id = cluster.id;
    if (clusterMarkers.has(id)) return;
    const coordinates = cluster.geometry.coordinates;
    const pointCount = cluster.properties.point_count;
    const element = document.createElement('div');
    element.className = 'cluster-marker';
    const count = document.createElement('span');
    count.className = 'cluster-marker-count';
    count.textContent = String(pointCount);
    element.appendChild(count);
    element.setAttribute('role', 'button');
    element.setAttribute('aria-label', pointCount + '件の投稿を拡大表示');
    element.tabIndex = 0;

    const expand = () => {
      if (renderedModeRevision !== pinModeRevision || clusterMarkers.get(id) !== marker) return;
      releaseLocationCamera();
      const nextZoom = Math.min(clusterIndex.getClusterExpansionZoom(id), 20);
      map.flyTo({ center: coordinates, zoom: nextZoom, duration: 500 });
    };
    element.addEventListener('click', expand);
    element.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        expand();
      }
    });

    const marker = new maplibregl.Marker({ element }).setLngLat(coordinates).addTo(map);
    clusterMarkers.set(id, marker);
  }

  // 先読み領域のピンとクラスタを描画し、範囲を出たマーカーを取り除く。
  function updateClusterMarkers() {
    if (!map || !clusterIndex || !mapElement.clientWidth || !mapElement.clientHeight) return;

    const zoom = Math.floor(map.getZoom());
    const clusters = clusterIndex.getClusters(markerBounds(${MARKER_PREFETCH_PADDING}), zoom);
    // 余白の半分が残っている段階で補充し、速いドラッグや慣性移動に備える。
    markerPrefetch = { zoom, refreshBounds: markerBounds(${MARKER_PREFETCH_PADDING} / 2) };
    const visiblePostIds = new Set();
    const visibleClusterIds = new Set();
    const renderedModeRevision = pinModeRevision;

    for (const cluster of clusters) {
      if (cluster.properties.cluster) {
        showClusterMarker(cluster, renderedModeRevision);
        visibleClusterIds.add(cluster.id);
      } else {
        const pin = postPinsById.get(cluster.properties.id);
        if (pin) {
          showPostPinMarker(pin, renderedModeRevision);
          visiblePostIds.add(pin.id);
        }
      }
    }
    // 選択中のピンがクラスタに重なっていても、境界での配色の切り替えを継続して表示する。
    const selected = postPinsById.get(selectedPostPinId);
    hasExtraSelectedMarker = !!selected && !visiblePostIds.has(selected.id);
    if (selected && hasExtraSelectedMarker) {
      showPostPinMarker(selected, renderedModeRevision);
      visiblePostIds.add(selected.id);
    }
    for (const [id, marker] of activePostPins) {
      if (!visiblePostIds.has(id)) {
        marker.remove();
        activePostPins.delete(id);
      }
    }
    for (const [id, marker] of clusterMarkers) {
      if (!visibleClusterIds.has(id)) {
        marker.remove();
        clusterMarkers.delete(id);
      }
    }
  }

  // アプリから受け取ったピンを取り込み、必要に応じてクラスタの索引を更新する。
  function updatePins(snapshot) {
    const geometryChanged = !clusterIndex || snapshot.pins.length !== postPinsById.size || snapshot.pins.some(pin => {
      const previous = postPinsById.get(pin.id);
      return previous?.latitude !== pin.latitude || previous?.longitude !== pin.longitude;
    });
    postPinsById.clear();
    for (const pin of snapshot.pins) postPinsById.set(pin.id, pin);

    if (!geometryChanged) {
      // 距離だけが変わった場合は同じDOM要素を使い、進行中の色の補間を継続させる。
      for (const [id, marker] of activePostPins) updatePostPinAppearance(postPinsById.get(id), marker);
      return;
    }

    const points = snapshot.pins.map(pin => ({
      type: 'Feature',
      properties: {
        cluster: false,
        id: pin.id,
      },
      geometry: {
        type: 'Point',
        coordinates: [pin.longitude, pin.latitude],
      },
    }));

    if (!clusterIndex) {
      clusterIndex = new Supercluster({
        radius: 50,
        maxZoom: ${POST_PIN_CLUSTER_MAX_ZOOM},
      });
    }
    // 索引を作り直すと同じクラスタIDでも別の集合になり得るため、旧クラスタだけを破棄する。
    clearClusterMarkers();
    markerPrefetch = null;
    clusterIndex.load(points);
    updateClusterMarkers();
  }

  // 保留している追従カメラの更新を取り消す。
  function cancelTrackingCameraFrame() {
    if (trackingCameraFrame === null) return;
    cancelAnimationFrame(trackingCameraFrame);
    trackingCameraFrame = null;
  }

  // 追従モードを切り替え、現在地ボタンの表示に使う状態をアプリへ通知する。
  function setTrackingMode(mode) {
    if (mode === trackingMode) return;
    trackingMode = mode;
    if (mode === 'free') cancelTrackingCameraFrame();
    send({ type: 'location-tracking', mode });
  }

  // 地図の向きを記録し、その向きを保つ現在地追従へ切り替える。
  function startPositionTracking(bearing = map.getBearing()) {
    positionTrackingBearing = bearing;
    setTrackingMode('position');
  }

  // 自由操作に戻し、操作中のジェスチャーを妨げない条件でカメラを止める。
  function releaseLocationCamera() {
    if (trackingMode === 'free') return;
    setTrackingMode('free');
    // MapLibre がジェスチャーを処理中なら、その操作と慣性移動を止めない。
    if (!userCameraMoving && mapTouchCount === 0) map.stop();
  }

  // シートを除いた地図の中央へ現在地を移し、追従モードに応じて地図の向きを調整する。
  function moveTrackingCamera(zoom = map.getZoom()) {
    if (!markerTarget || trackingMode === 'free' || userCameraMoving || mapTouchCount > 0) return;
    const height = mapElement.clientHeight;
    const inset = Math.min(Math.max(0, trackingBottomInset), height);
    if (height - inset < 48) return;
    const center = [markerTarget.longitude, markerTarget.latitude];
    const previousBearing = map.getBearing();
    const bearing = wrapLongitude(trackingMode === 'heading' ? headingAngle : positionTrackingBearing, previousBearing);
    const { x, y } = map.project(center);
    const angleDelta = Math.abs(bearing - previousBearing);
    if (Math.abs(x - mapElement.clientWidth / 2) < 0.5 && Math.abs(y - (height - inset) / 2) < 0.5 &&
        angleDelta < 0.25 && Math.abs(zoom - map.getZoom()) < 0.001 && !map.isMoving()) return;

    map.easeTo({ center, bearing, zoom, offset: [0, -inset / 2], duration: ${LOCATION_CAMERA_DURATION_MS},
      easeId: 'location-tracking' });
  }

  // 位置や方角の変更によるカメラ更新を次の描画フレームにまとめる。
  function scheduleTrackingCamera() {
    if (trackingMode === 'free' || userCameraMoving || mapTouchCount > 0 || trackingCameraFrame !== null) return;
    trackingCameraFrame = requestAnimationFrame(() => {
      trackingCameraFrame = null;
      moveTrackingCamera();
    });
  }

  // 現在地ボタンに応じて追従を切り替える。指が地図に触れている間は処理しない。
  function cycleLocationTracking(bottomInset) {
    if (!markerTarget || mapTouchCount > 0) return;
    const wasFree = trackingMode === 'free';
    if (trackingMode === 'position' && headingAngle === null) return;
    trackingBottomInset = bottomInset;
    postPinCenterSuppressed = true;
    pendingPostPinCenter = null;
    // 指を離した後の慣性移動は、ボタン操作で中断して現在地へ移動する。
    if (userCameraMoving || map.isMoving()) {
      userCameraMoving = false;
      map.stop();
    }
    cancelTrackingCameraFrame();
    if (trackingMode === 'position') setTrackingMode('heading');
    else startPositionTracking();
    moveTrackingCamera(wasFree ? Math.max(map.getZoom(), ${CURRENT_LOCATION_ZOOM}) : map.getZoom());
  }

  // 地図に触れている指の本数を記録し、すべて離れたら追従カメラの更新を予約する。
  function updateTrackingTouches(event) {
    mapTouchCount = event.originalEvent?.touches?.length ?? 0;
    if (mapTouchCount === 0) scheduleTrackingCamera();
  }

  // 地図操作中の追従の停止・解除・再開に必要なイベントを登録する。
  function bindLocationTrackingEvents() {
    map.on('touchstart', updateTrackingTouches);
    map.on('touchend', updateTrackingTouches);
    map.on('touchcancel', updateTrackingTouches);
    map.on('movestart', event => {
      if (event.originalEvent) userCameraMoving = true;
    });
    map.on('drag', event => {
      // ピンチ中は MapLibre が拡大と一緒に平行移動も報告する。
      if (event.originalEvent && (event.originalEvent.touches?.length ?? 0) < 2) setTrackingMode('free');
    });
    map.on('rotatestart', event => {
      if (event.originalEvent) setTrackingMode('free');
    });
    map.on('moveend', () => {
      if (!userCameraMoving) return;
      userCameraMoving = false;
      scheduleTrackingCamera();
    });
  }

  // 地図の回転に合わせて、現在地マーカーの方角表示を補正する。
  function updateBearing() {
    if (bearingLayer) bearingLayer.style.transform = 'rotate(' + -map.getBearing() + 'deg)';
  }

  // 端末の方角が取得できているときに、現在地マーカーの方向を表示する。
  function drawHeading() {
    if (!cone) return;
    bearingLayer.hidden = headingAngle === null;
    if (headingAngle !== null) cone.style.transform = 'rotate(' + headingAngle + 'deg)';
  }

  // 最新の端末方角を反映し、方角追従中は地図の回転も更新する。
  function updateHeading(degrees) {
    const previous = headingAngle;
    if (degrees === null || headingAngle === null) {
      headingAngle = degrees;
    } else {
      const delta = ((degrees - headingAngle) % 360 + 540) % 360 - 180;
      headingAngle += delta;
    }
    drawHeading();
    if (trackingMode === 'heading' && headingAngle !== previous) {
      if (headingAngle === null) startPositionTracking();
      scheduleTrackingCamera();
    }
  }

  // 現在地マーカーの保留中の移動アニメーションを止める。
  function cancelPositionAnimation() {
    if (positionFrame === null) return;
    cancelAnimationFrame(positionFrame);
    positionFrame = null;
  }

  // 現在地マーカーを新しい座標へ滑らかに移動させる。
  function animatePosition(point) {
    cancelPositionAnimation();
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
      drawDistanceLine();
      positionFrame = progress < 1 ? requestAnimationFrame(frame) : null;
    }
    positionFrame = requestAnimationFrame(frame);
  }

  // 現在地マーカーを作成・移動・解除し、追従中のカメラを更新する。
  function updateCurrent(point, displayPoint) {
    current = point;
    if (current) {
      const target = displayPoint ?? { ...current, durationMs: 450 };
      const targetChanged = markerTarget?.latitude !== target.latitude || markerTarget?.longitude !== target.longitude;
      if (!currentMarker) {
        const dot = document.createElement('div');
        dot.className = 'current-dot';
        dot.setAttribute('aria-label', '現在地');
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
      } else if (targetChanged) {
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
        centered = true;
        map.flyTo({ center: [target.longitude, target.latitude], zoom: ${CURRENT_LOCATION_ZOOM}, duration: 750 });
      }
      if (targetChanged) scheduleTrackingCamera();
    } else {
      releaseLocationCamera();
      cancelPositionAnimation();
      displayedPosition = null;
      markerTarget = null;
      currentMarker?.remove();
      currentMarker = undefined;
      bearingLayer = undefined;
      cone = undefined;
    }
  }

  // アプリから受け取った現在地・閲覧範囲・投稿ピンを地図に反映する。
  function applySnapshot(snapshot) {
    if (snapshot.modeRevision !== pinModeRevision) {
      pinModeRevision = snapshot.modeRevision;
      clusterIndex = null;
      postPinsById.clear();
      selectPostPin(null);
      clearMarkers();
    }
    let issue;
    try { updateCurrent(snapshot.current, snapshot.displayPosition); } catch { issue = 'position'; }
    try { drawRange(); } catch { issue ||= 'range'; }
    try {
      updatePins(snapshot);
      appliedPinModeRevision = pinModeRevision;
    } catch {
      appliedPinModeRevision = null;
      issue ||= 'pins';
    }
    syncDistanceLine();
    return issue;
  }

  window.receiveKokoMapCommand = command => {
    if (!ready) return;
    if (command?.type === 'cycle-location-tracking') {
      if (!Number.isFinite(command.bottomInset)) return;
      try { cycleLocationTracking(command.bottomInset); } catch { send({ type: 'recenter-failed' }); }
      return;
    }
    if (command?.type === 'tracking-inset') {
      if (trackingMode === 'free' || !Number.isFinite(command.bottomInset) || command.bottomInset === trackingBottomInset) return;
      trackingBottomInset = command.bottomInset;
      scheduleTrackingCamera();
      return;
    }
    if (command?.type === 'reset-bearing') {
      if (trackingMode === 'free') map.easeTo({ bearing: 0, duration: ${LOCATION_CAMERA_DURATION_MS} });
      else {
        startPositionTracking(0);
        scheduleTrackingCamera();
      }
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
    if (command?.type === 'select-post-pin') {
      if (command.modeRevision !== appliedPinModeRevision) return;
      if (command.id === null || Number.isSafeInteger(command.id)) selectPostPin(command.id);
      return;
    }
    if (command?.type === 'center-post-pin') {
      if (command.modeRevision !== appliedPinModeRevision) return;
      if (Number.isSafeInteger(command.id) && Number.isFinite(command.bottomInset)) {
        centerPostPin(command.id, command.bottomInset);
      }
      return;
    }
    if (command?.type !== 'snapshot' || !Array.isArray(command.snapshot?.pins)) return;
    if (!Number.isSafeInteger(command.snapshot.modeRevision) || command.snapshot.modeRevision < pinModeRevision) return;
    if (!Number.isSafeInteger(command.requestId) || command.requestId < latestRequestId) return;
    latestRequestId = command.requestId;
    const issue = applySnapshot(command.snapshot);
    send({ type: issue ? 'overlay-error' : 'overlay-applied', issue, requestId: command.requestId,
      modeRevision: appliedPinModeRevision });
  };

  // アプリから地図へ送られたメッセージを読み取る。
  function receiveCommand(event) {
    if (typeof event.data !== 'string') return;
    let command;
    try { command = JSON.parse(event.data); } catch { return; }
    window.receiveKokoMapCommand(command);
  }

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
        zoom: point ? ${CURRENT_LOCATION_ZOOM} : 4.5,
        attributionControl: false, bearing: 0, dragRotate: true, pitchWithRotate: false, maxPitch: 0,
      });
      mapElement.insertBefore(mask, map.getCanvasContainer().nextSibling);
      mapElement.insertBefore(distanceOverlay, mask.nextSibling);
      map.on('move', drawRange);
      map.on('move', drawDistanceLine);
      map.on('move', scheduleMarkerViewportCheck);
      map.on('moveend', refreshMarkerViewport);
      map.on('moveend', finishPostPinCenter);
      bindLocationTrackingEvents();
      map.on('resize', () => {
        drawRange();
        drawDistanceLine();
        cancelMarkerViewportFrame();
        updateClusterMarkers();
        scheduleTrackingCamera();
      });
      map.on('rotate', () => {
        send({ type: 'bearing-change', bearing: map.getBearing() });
      });
      map.on('rotate', updateBearing);
      const viewportObserver = new ResizeObserver(() => map.resize());
      viewportObserver.observe(mapElement);
      map.once('remove', () => {
        viewportObserver.disconnect();
        cancelPositionAnimation();
        cancelDistanceLineAnimation();
        cancelMarkerViewportFrame();
        cancelTrackingCameraFrame();
      });
      map.once('load', () => {
        ready = true;
        clearTimeout(timer);
        centered = Boolean(point);
        const issue = initial ? applySnapshot(initial) : undefined;
        send({ type: 'ready', issue, modeRevision: appliedPinModeRevision });
      });
    } catch {
      clearTimeout(timer);
      send({ type: 'map-error' });
    }
  })();
</script>
</body>
</html>`;

// 現在地と投稿データを初期値とする、ホーム地図のWebView用HTMLを生成する。
export function createOpenFreeMapDocument(snapshot: MapSnapshot, heading: number | null = null): string {
  const json = JSON.stringify({ ...snapshot, heading }).replace(/</g, '\\u003c');
  return openFreeMapDocument.replace(
    '<script type="application/json" id="initial-map-snapshot">null</script>',
    () => `<script type="application/json" id="initial-map-snapshot">${json}</script>`,
  );
}
