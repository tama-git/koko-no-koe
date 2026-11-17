import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Linking, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Polygon } from 'react-native-svg';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent, WebViewProps } from 'react-native-webview';

import type { DisplayPosition } from '../../location/displayPosition';
import type { LocationState } from '../../location/useCurrentLocation';
import type { PostPin } from '../../posts/postService';
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

export function HomeMap({ postPins, postsLoading, nearbyPostIds, selectedPin, location, displayPosition, heading, controlsInset, onSelectPost, onShowDistance }: {
  postPins: readonly PostPin[];
  postsLoading: boolean;
  nearbyPostIds: ReadonlySet<number>;
  selectedPin: { id: number } | null;
  location: LocationState;
  displayPosition: DisplayPosition | null;
  heading: number | null;
  controlsInset: ReturnType<typeof Animated.add>;
  onSelectPost: (id: number) => void;
  onShowDistance: (id: number, distance: number | null) => void;
}) {
  const webView = useRef<WebView<WebViewProps>>(null);
  
  // コンパス回転用のAnimated値
  const compassRotation = useRef(new Animated.Value(0)).current;
  const compassRotationStyle = useMemo(() => compassRotation.interpolate({
    inputRange: [-360, 360],
    outputRange: ['-360deg', '360deg'],
  }), [compassRotation]);

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
  
  const pins = useMemo(() => (postPins ?? []).map(pin => ({ ...pin, nearby: nearbyPostIds.has(pin.id) })),
    [postPins, nearbyPostIds]);

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

  useEffect(() => {
    if (mapState !== 'ready') return;
    const selection = JSON.stringify({ type: 'select-post-pin', id: selectedPin?.id ?? null });
    webView.current?.injectJavaScript(`window.receiveKokoMapCommand(${selection}); true;`);
    if (!selectedPin) return;

    // シートの移動が落ち着いてから、見えている地図の中央にピンを合わせる。
    const timer = setTimeout(() => {
      const focus = JSON.stringify({
        type: 'center-post-pin', id: selectedPin.id, bottomInset: latestControlsInset.current,
      });
      webView.current?.injectJavaScript(`window.receiveKokoMapCommand(${focus}); true;`);
    }, 300);
    return () => clearTimeout(timer);
  }, [mapState, selectedPin]);

  const recenter = () => {
    const command = JSON.stringify({ type: 'recenter', bottomInset: latestControlsInset.current });
    webView.current?.injectJavaScript(`window.receiveKokoMapCommand(${command}); true;`);
  };

  const resetBearing = () => {
    const command = JSON.stringify({ type: 'reset-bearing' });
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

  useEffect(() => {
    if (mapState !== 'loading' || !document) return;
    const timer = setTimeout(() => setMapState('error'), 25000);
    return () => clearTimeout(timer);
  }, [mapState, document, reloadKey]);

  const onMapMessage = ({ nativeEvent }: WebViewMessageEvent) => {
    if (nativeEvent.data.length > 1024) return;
    let message: { type?: unknown; id?: unknown; issue?: unknown; requestId?: unknown; bearing?: unknown } | null;
    try {
      message = JSON.parse(nativeEvent.data);
    } catch {
      return;
    }
    if (!message || typeof message !== 'object') return;

    if (message.type === 'bearing-change' && typeof message.bearing === 'number') {
      Animated.timing(compassRotation, {
        toValue: -message.bearing,
        duration: 50,
        useNativeDriver: true,
      }).start();
      return;
    }

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
      if (!coordinates) onShowDistance(pin.id, null);
      else if (pin.nearby) onSelectPost(pin.id);
      else onShowDistance(pin.id, distanceMeters(coordinates.latitude, coordinates.longitude, pin.latitude, pin.longitude));
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
          <View style={styles.mapButtons}>
            {/* 2枚目の画像：方角（赤とグレーのコンパス針）ボタン */}
            <Pressable accessibilityRole="button" accessibilityLabel="北を上に戻す"
              style={styles.mapButton} onPress={resetBearing}>
              <Animated.View style={[styles.iconContainer, { transform: [{ rotate: compassRotationStyle }] }]}>
                <Svg width={26} height={26} viewBox="0 0 24 24">
                  <Polygon points="12,3 15.5,12 8.5,12" fill="#E53935" />
                  <Polygon points="12,21 15.5,12 8.5,12" fill="#BDBDBD" />
                  <Circle cx="12" cy="12" r="2" fill="#FFFFFF" />
                </Svg>
              </Animated.View>
            </Pressable>

            {/* 1枚目の画像：現在位置に戻る（黒枠のナビゲーション矢印）ボタン */}
            {appliedPoint && coordinates && (
              <Pressable accessibilityRole="button" accessibilityLabel="現在地に戻る"
                style={styles.mapButton} onPress={recenter}>
                <View style={styles.iconContainer}>
                  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M21 3L3 10.53V11.51L9.84 14.16L12.48 21H13.46L21 3Z"
                      stroke="#1F1F1F"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </View>
              </Pressable>
            )}
          </View>
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
  iconContainer: {
    width: 26,
    height: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapButtons: {
    flexDirection: 'column',
    gap: 10,
  },
  mapButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    elevation: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
  },
  map: { flex: 1, backgroundColor: '#EDF0EC' },
  noticeArea: { position: 'absolute', top: 0, left: 0, right: 0 },
  notice: { margin: 12, marginTop: 100, padding: 12, borderRadius: 10, backgroundColor: '#FFFFFFEE' },
  noticeText: { fontSize: 13, lineHeight: 20, color: '#1D4030' },
  retry: { minHeight: 44, justifyContent: 'center' },
  retryText: { fontWeight: '700', color: '#2C6049' },
});