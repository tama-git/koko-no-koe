import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Linking, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent, WebViewProps } from 'react-native-webview';

import type { DisplayPosition } from '../../location/displayPosition';
import type { LocationState } from '../../location/useCurrentLocation';
import type { SavedPost } from '../../posts/postService';
import { distanceMeters } from '../filterNearbyPosts';
import { createOpenFreeMapDocument } from '../openFreeMapDocument';
import type { MapPoint, MapSnapshot } from '../openFreeMapDocument';

const overlayMessages = {
  position: '地図に現在地の点を表示できませんでした。',
  range: '地図に250mの範囲を表示できませんでした。',
  pins: '地図に投稿ピンを表示できませんでした。',
} as const;

type OverlayIssue = keyof typeof overlayMessages;

function readOverlayIssue(issue: unknown): OverlayIssue | null {
  return issue === 'position' || issue === 'range' || issue === 'pins' ? issue : null;
}

function makeMapDocument(snapshot: MapSnapshot, json: string, heading: number | null) {
  return { source: { html: createOpenFreeMapDocument(snapshot, heading) }, json, point: snapshot.current };
}
const INITIAL_HEADING_WAIT_MS = 1000;
const POSITION_NOTICE_DISTANCE_METERS = 25;
const POSITION_NOTICE_DELAY_MS = 12000;
const mapCredits = [
  { label: 'OpenFreeMap', url: 'https://openfreemap.org/' },
  { label: '© OpenMapTiles', url: 'https://www.openmaptiles.org/' },
  { label: '© OpenStreetMap', url: 'https://www.openstreetmap.org/copyright' },
];

export function HomeMap({ posts, postsLoading, nearbyPostIds, location, displayPosition, heading, controlsInset, onSelectPost, onShowDistance }: {
  posts: readonly SavedPost[];
  postsLoading: boolean;
  nearbyPostIds: ReadonlySet<number>;
  location: LocationState;
  displayPosition: DisplayPosition | null;
  heading: number | null;
  controlsInset: ReturnType<typeof Animated.add>;
  onSelectPost: (id: number) => void;
  onShowDistance: (distance: number | null) => void;
}) {
  const webView = useRef<WebView<WebViewProps>>(null);
  const latestControlsInset = useRef(0);
  const [mapState, setMapState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [overlayIssue, setOverlayIssue] = useState<OverlayIssue | null>(null);
  const [appliedPoint, setAppliedPoint] = useState<MapPoint | null>(null);
  const [showPositionNotice, setShowPositionNotice] = useState(false);
  const [document, setDocument] = useState<ReturnType<typeof makeMapDocument> | null>(null);
  const [headingWaitElapsed, setHeadingWaitElapsed] = useState(false);
  const [webViewLoaded, setWebViewLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const appliedJson = useRef<string | null>(null);
  const requestId = useRef(0);
  const pendingHeading = useRef<number | null>(null);
  const pending = useRef<{ id: number; json: string; point: MapPoint | null } | null>(null);
  const coordinates = location.status === 'ready' ? location.coordinates : null;
  const latitude = coordinates?.latitude ?? null;
  const longitude = coordinates?.longitude ?? null;
  const pins = useMemo(() => posts.flatMap(({ id, latitude, longitude, is_published }) =>
    is_published === true && latitude !== null && longitude !== null
      ? [{ id, latitude, longitude, nearby: nearbyPostIds.has(id) }]
      : []
  ), [posts, nearbyPostIds]);

  // 円の中心となる取得座標と、マーカーの表示座標を分けて渡す。
  const snapshot: MapSnapshot = useMemo(() => ({
    current: latitude !== null && longitude !== null ? { latitude, longitude } : null,
    displayPosition: latitude !== null && longitude !== null ? displayPosition : null,
    pins,
  }), [latitude, longitude, displayPosition, pins]);
  const snapshotJson = JSON.stringify(snapshot);
  const positionNeedsUpdate = mapState === 'ready' && coordinates !== null &&
    (appliedPoint === null || distanceMeters(
      coordinates.latitude, coordinates.longitude, appliedPoint.latitude, appliedPoint.longitude,
    ) >= POSITION_NOTICE_DISTANCE_METERS);

  useEffect(() => {
    if (!positionNeedsUpdate) {
      setShowPositionNotice(false);
      return;
    }
    // 方角や細かな測位の変化が続いても、案内までの時間は座標のずれだけで判定する。
    const timer = setTimeout(() => setShowPositionNotice(true), POSITION_NOTICE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [positionNeedsUpdate]);

  useEffect(() => {
    if (document || postsLoading || location.status !== 'ready' || heading !== null) return;
    const timer = setTimeout(() => setHeadingWaitElapsed(true), INITIAL_HEADING_WAIT_MS);
    return () => clearTimeout(timer);
  }, [document, postsLoading, location.status, heading]);

  useEffect(() => {
    if (document || postsLoading || location.status === 'loading') return;
    // 起動時だけ、取得済みの方位をHTMLに入れる。以降は地図を作り直さない。
    if (location.status === 'ready' && heading === null && !headingWaitElapsed) return;
    setDocument(makeMapDocument(snapshot, snapshotJson, heading));
  }, [document, postsLoading, location.status, snapshot, snapshotJson, heading, headingWaitElapsed]);

  useEffect(() => {
    if (mapState !== 'ready' || !document || snapshotJson === appliedJson.current) return;
    const id = ++requestId.current;
    pending.current = { id, json: snapshotJson, point: snapshot.current };
    const command = `{"type":"snapshot","requestId":${id},"snapshot":${snapshotJson}}`;
    webView.current?.injectJavaScript(`window.receiveKokoMapCommand(${command}); true;`);
    const retry = setTimeout(() => {
      if (pending.current?.id === id) webView.current?.postMessage(command);
    }, 1000);
    return () => {
      clearTimeout(retry);
      if (pending.current?.id === id) pending.current = null;
    };
  }, [mapState, document, snapshotJson, snapshot.current]);

  useEffect(() => {
    if (mapState !== 'ready') return;
    const id = ++requestId.current;
    const command = JSON.stringify({ type: 'heading', requestId: id, heading });
    pendingHeading.current = id;
    webView.current?.injectJavaScript(`window.receiveKokoMapCommand(${command}); true;`);
    // 地図から受信確認が届かないときだけ、別の経路でも送る。
    const retry = setTimeout(() => {
      if (pendingHeading.current === id) webView.current?.postMessage(command);
    }, 300);
    return () => {
      clearTimeout(retry);
      if (pendingHeading.current === id) pendingHeading.current = null;
    };
  }, [mapState, webViewLoaded, heading]);

  useEffect(() => {
    const listener = controlsInset.addListener(({ value }) => { latestControlsInset.current = value; });
    return () => controlsInset.removeListener(listener);
  }, [controlsInset]);

  const recenter = () => {
    const command = JSON.stringify({ type: 'recenter', bottomInset: latestControlsInset.current });
    webView.current?.injectJavaScript(`window.receiveKokoMapCommand(${command}); true;`);
  };

  const reloadMap = useCallback(() => {
    pending.current = null;
    appliedJson.current = null;
    setMapState('loading');
    setOverlayIssue(null);
    setAppliedPoint(null);
    setShowPositionNotice(false);
    setWebViewLoaded(false);
    setDocument(makeMapDocument(snapshot, snapshotJson, heading));
    setReloadKey(key => key + 1);
  }, [snapshot, snapshotJson, heading]);

  // 初期HTMLや外部スクリプトが読み込めない場合も、再試行できるようにする。
  useEffect(() => {
    if (mapState !== 'loading' || !document) return;
    const timer = setTimeout(() => setMapState('error'), 25000);
    return () => clearTimeout(timer);
  }, [mapState, document, reloadKey]);

  const onMapMessage = ({ nativeEvent }: WebViewMessageEvent) => {
    if (nativeEvent.data.length > 1024) return;
    let message: { type?: unknown; id?: unknown; issue?: unknown; requestId?: unknown } | null;
    try {
      message = JSON.parse(nativeEvent.data);
    } catch {
      return;
    }
    if (!message || typeof message !== 'object') return;
    if (message.type === 'ready') {
      const issue = readOverlayIssue(message.issue);
      appliedJson.current = document?.json ?? null;
      setAppliedPoint(issue === 'position' || issue === 'range' ? null : document?.point ?? null);
      setOverlayIssue(issue);
      setMapState('ready');
    } else if (message.type === 'map-error') {
      setMapState('error');
    } else if (message.type === 'recenter-failed') {
      reloadMap();
    } else if (message.type === 'heading-applied') {
      if (pendingHeading.current === message.requestId) pendingHeading.current = null;
    } else if (message.type === 'overlay-applied' || message.type === 'overlay-error') {
      const currentRequest = pending.current;
      if (!currentRequest || message.requestId !== currentRequest.id) return;
      pending.current = null;
      if (message.type === 'overlay-applied') {
        appliedJson.current = currentRequest.json;
        setOverlayIssue(null);
      }
      if (message.type === 'overlay-applied' || message.issue === 'pins') {
        const next = currentRequest.point;
        setAppliedPoint(previous =>
          previous?.latitude === next?.latitude && previous?.longitude === next?.longitude ? previous : next);
      }
    } else if (message.type === 'pin' && Number.isSafeInteger(message.id)) {
      const pin = pins.find(pin => pin.id === message.id);
      if (!pin) return;
      if (!coordinates) onShowDistance(null);
      else if (pin.nearby) onSelectPost(pin.id);
      else onShowDistance(distanceMeters(coordinates.latitude, coordinates.longitude, pin.latitude, pin.longitude));
    }
  };

  const locationMessage = location.status === 'denied' ? '位置情報が許可されていません。許可する場合はiPhoneの設定をご確認ください。'
    : location.status === 'disabled' ? '端末の位置情報がオフです。'
    : location.status === 'timeout' ? '現在地の取得に時間がかかっています。'
    : location.status === 'error' ? '現在地を取得できませんでした。'
    : '';
  const positionNotice = positionNeedsUpdate && showPositionNotice;
  const canRetryMap = mapState === 'error' || overlayIssue !== null || positionNotice;
  const notice = !document ? '地図の表示を準備中…'
    : mapState === 'error' ? '地図を読み込めませんでした。'
    : mapState === 'loading' ? '地図を読み込み中…'
    : overlayIssue ? overlayMessages[overlayIssue]
    : positionNotice ? '地図の現在地を更新できます。'
    : locationMessage;

  return (
    <View style={[StyleSheet.absoluteFill, styles.mapArea]}>
      {document && <WebView<WebViewProps>
        ref={webView}
        key={reloadKey}
        source={document.source}
        style={styles.map}
        originWhitelist={['*']}
        onShouldStartLoadWithRequest={request => request.url === 'about:blank'}
        onMessage={onMapMessage}
        onLoad={() => setWebViewLoaded(true)}
        onError={() => setMapState('error')}
        onContentProcessDidTerminate={() => setMapState('error')}
        scrollEnabled={false}
        bounces={false}
        geolocationEnabled={false}
        allowFileAccess={false}
        setSupportMultipleWindows={false}
      />}
      {mapState === 'ready' && (
        <Animated.View pointerEvents="box-none" style={[styles.controls, { bottom: controlsInset }]}>
          <Text style={styles.credits}>
            {mapCredits.map(({ label, url }, index) => (
              <Text key={url}>
                {index > 0 ? ' · ' : ''}
                <Text accessibilityRole="link" style={styles.creditLink}
                  onPress={() => { void Linking.openURL(url).catch(() => {}); }}>{label}</Text>
              </Text>
            ))}
          </Text>
          {appliedPoint && coordinates && (
            <Pressable accessibilityRole="button" accessibilityLabel="現在地に戻る"
              style={styles.recenter} onPress={recenter}>
              <Text style={styles.recenterText}>現在地</Text>
            </Pressable>
          )}
        </Animated.View>
      )}
      {notice ? (
        <SafeAreaView pointerEvents="box-none" style={styles.noticeArea}>
          <View style={styles.notice}>
            <Text accessibilityLiveRegion="polite" style={styles.noticeText}>
              {notice}
            </Text>
            {canRetryMap && (
              <Pressable accessibilityRole="button" style={styles.retry} onPress={reloadMap}>
                <Text style={styles.retryText}>{positionNotice && !overlayIssue ? '地図の位置を更新' : '地図を再読み込み'}</Text>
              </Pressable>
            )}
          </View>
        </SafeAreaView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  mapArea: { overflow: 'hidden' },
  controls: { position: 'absolute', left: 8, right: 12, paddingBottom: 8,
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 },
  credits: { flexShrink: 1, backgroundColor: '#FFFFFFCC', borderRadius: 4,
    paddingVertical: 3, paddingHorizontal: 5, color: '#334039', fontSize: 10 },
  creditLink: { textDecorationLine: 'underline' },
  recenter: { minHeight: 44, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 22,
    backgroundColor: '#FFFFFF', elevation: 2 },
  recenterText: { color: '#1D4030', fontSize: 14, fontWeight: '700' },
  map: { flex: 1, backgroundColor: '#EDF0EC' },
  noticeArea: { position: 'absolute', top: 0, left: 0, right: 0 },
  notice: { margin: 12, marginTop: 100, padding: 12, borderRadius: 10, backgroundColor: '#FFFFFFEE' },
  noticeText: { fontSize: 13, lineHeight: 20, color: '#1D4030' },
  retry: { minHeight: 44, justifyContent: 'center' },
  retryText: { fontWeight: '700', color: '#2C6049' },
});
