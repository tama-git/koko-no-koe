import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';

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

function makeMapDocument(snapshot: MapSnapshot, json: string) {
  return { source: { html: createOpenFreeMapDocument(snapshot) }, json, point: snapshot.current };
}
const POSITION_NOTICE_DISTANCE_METERS = 25;
const POSITION_NOTICE_DELAY_MS = 12000;
const creditUrls = new Set([
  'https://openfreemap.org/',
  'https://www.openmaptiles.org/',
  'https://www.openstreetmap.org/copyright',
]);

export function HomeMap({ posts, postsLoading, nearbyPostIds, location, heading, onSelectPost, onShowDistance }: {
  posts: readonly SavedPost[];
  postsLoading: boolean;
  nearbyPostIds: ReadonlySet<number>;
  location: LocationState;
  heading: number | null;
  onSelectPost: (id: number) => void;
  onShowDistance: (distance: number | null) => void;
}) {
  const webView = useRef<WebView>(null);
  const [mapState, setMapState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [overlayIssue, setOverlayIssue] = useState<OverlayIssue | null>(null);
  const [appliedPoint, setAppliedPoint] = useState<MapPoint | null>(null);
  const [showPositionNotice, setShowPositionNotice] = useState(false);
  const [document, setDocument] = useState<ReturnType<typeof makeMapDocument> | null>(null);
  const [headingWaitElapsed, setHeadingWaitElapsed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const appliedJson = useRef<string | null>(null);
  const requestId = useRef(0);
  const pending = useRef<{ id: number; json: string; point: MapPoint | null } | null>(null);
  const coordinates = location.status === 'ready' ? location.coordinates : null;
  const latitude = coordinates?.latitude ?? null;
  const longitude = coordinates?.longitude ?? null;
  const pins = useMemo(() => posts.flatMap(({ id, latitude, longitude, is_published }) =>
    is_published === true && latitude !== null && longitude !== null
      ? [{ id, latitude, longitude, nearby: nearbyPostIds.has(id) }]
      : []
  ), [posts, nearbyPostIds]);

  // 地図へは座標・ピンID・圏内フラグだけを渡す。
  const snapshot: MapSnapshot = useMemo(() => ({
    current: latitude !== null && longitude !== null ? { latitude, longitude, heading } : null,
    pins,
  }), [latitude, longitude, heading, pins]);
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
    if (document || location.status !== 'ready' || heading !== null) return;
    const timer = setTimeout(() => setHeadingWaitElapsed(true), 1000);
    return () => clearTimeout(timer);
  }, [document, location.status, heading]);

  useEffect(() => {
    if (document || postsLoading || location.status === 'loading') return;
    // 初回の方角が間に合えば、地図を開いた時点から矢印を表示する。
    if (location.status === 'ready' && heading === null && !headingWaitElapsed) return;
    setDocument(makeMapDocument(snapshot, snapshotJson));
  }, [document, postsLoading, location.status, heading, headingWaitElapsed, snapshot, snapshotJson]);

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

  const reloadMap = useCallback(() => {
    pending.current = null;
    appliedJson.current = null;
    setMapState('loading');
    setOverlayIssue(null);
    setAppliedPoint(null);
    setShowPositionNotice(false);
    setDocument(makeMapDocument(snapshot, snapshotJson));
    setReloadKey(key => key + 1);
  }, [snapshot, snapshotJson]);

  // 初期HTMLや外部スクリプトが読み込めない場合も、再試行できるようにする。
  useEffect(() => {
    if (mapState !== 'loading' || !document) return;
    const timer = setTimeout(() => setMapState('error'), 25000);
    return () => clearTimeout(timer);
  }, [mapState, document, reloadKey]);

  const onMapMessage = ({ nativeEvent }: WebViewMessageEvent) => {
    if (nativeEvent.data.length > 1024) return;
    let message: { type?: unknown; id?: unknown; url?: unknown; issue?: unknown; requestId?: unknown } | null;
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
    } else if (message.type === 'credit' && typeof message.url === 'string' && creditUrls.has(message.url)) {
      void Linking.openURL(message.url).catch(() => {});
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
    <View style={StyleSheet.absoluteFill}>
      {document && <WebView
        key={reloadKey}
        source={document.source}
        style={styles.map}
        originWhitelist={['*']}
        onShouldStartLoadWithRequest={request => request.url === 'about:blank'}
        onMessage={onMapMessage}
        onError={() => setMapState('error')}
        onContentProcessDidTerminate={() => setMapState('error')}
        scrollEnabled={false}
        bounces={false}
        geolocationEnabled={false}
        allowFileAccess={false}
        setSupportMultipleWindows={false}
      />}
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
  map: { flex: 1, backgroundColor: '#EDF0EC' },
  noticeArea: { position: 'absolute', top: 0, left: 0, right: 0 },
  notice: { margin: 12, marginTop: 100, padding: 12, borderRadius: 10, backgroundColor: '#FFFFFFEE' },
  noticeText: { fontSize: 13, lineHeight: 20, color: '#1D4030' },
  retry: { minHeight: 44, justifyContent: 'center' },
  retryText: { fontWeight: '700', color: '#2C6049' },
});
