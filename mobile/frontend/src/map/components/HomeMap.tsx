import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Linking, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Polygon } from 'react-native-svg';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent, WebViewProps } from 'react-native-webview';

import type { DisplayPosition } from '../../location/displayPosition';
import type { LocationState } from '../../location/useCurrentLocation';
import type { PostPin } from '../../posts/postService';
import { distanceMeters, isWithinPostRadius } from '../filterNearbyPosts';
import { createOpenFreeMapDocument } from '../openFreeMapDocument';
import type { MapPoint, MapSnapshot } from '../openFreeMapDocument';
import { resolvePostPinTap } from '../postPins';
import type { MapPinSelection } from '../postPins';
import { uiColors } from '../../shared/uiColors';

const overlayMessages = {
  position: '地図に現在地の点を表示できませんでした。',
  range: '地図に250mの範囲を表示できませんでした。',
  pins: '地図に投稿ピンを表示できませんでした。',
} as const;

type OverlayIssue = keyof typeof overlayMessages;
type LocationTrackingMode = 'free' | 'position' | 'heading';

// 地図から届いたエラー種別を、画面で表示できる値に絞る。
function readOverlayIssue(issue: unknown): OverlayIssue | null {
  return issue === 'position' || issue === 'range' || issue === 'pins' ? issue : null;
}

// 現在地・投稿ピン・端末の方角から、WebViewに渡す初期地図データを組み立てる。
function makeMapDocument(snapshot: MapSnapshot, json: string, heading: number | null) {
  return { source: { html: createOpenFreeMapDocument(snapshot, heading) }, json, point: snapshot.current };
}
const INITIAL_HEADING_WAIT_MS = 1000;
const POSITION_NOTICE_DISTANCE_METERS = 25;
const POSITION_NOTICE_DELAY_MS = 12000;
const LOCATION_ICON_COLOR = '#292B28';
const mapCredits = [
  { label: 'OpenFreeMap', url: 'https://openfreemap.org/' },
  { label: '© OpenMapTiles', url: 'https://www.openmaptiles.org/' },
  { label: '© OpenStreetMap', url: 'https://www.openstreetmap.org/copyright' },
];

// 追従状態に合わせて現在地ボタンの矢印と切り替えアニメーションを表示する。
function LocationTrackingIcon({ mode }: { mode: LocationTrackingMode }) {
  const [visibleMode, setVisibleMode] = useState(mode);
  const visibility = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(true);

  useEffect(() => {
    let active = true;
    let changed = false;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', enabled => {
      changed = true;
      setReduceMotion(enabled);
    });
    void AccessibilityInfo.isReduceMotionEnabled().then(enabled => {
      if (active && !changed) setReduceMotion(enabled);
    }, () => {});
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const isRevealing = visibleMode === mode;
    if (reduceMotion || (!isRevealing && visibleMode !== 'heading' && mode !== 'heading')) {
      visibility.setValue(1);
      if (!isRevealing) setVisibleMode(mode);
      return;
    }

    // 縮みきってから図形を切り替え、次の描画で同じ中心から広げる。
    let active = true;
    const animation = Animated.timing(visibility, {
      toValue: isRevealing ? 1 : 0,
      duration: isRevealing ? 330 : 270,
      easing: isRevealing ? Easing.out(Easing.quad) : Easing.in(Easing.quad),
      useNativeDriver: true, isInteraction: false,
    });
    animation.start(({ finished }) => {
      if (active && finished && !isRevealing) setVisibleMode(mode);
    });
    return () => {
      active = false;
      animation.stop();
    };
  }, [mode, reduceMotion, visibility, visibleMode]);

  const isHeading = visibleMode === 'heading';
  return (
    <Animated.View pointerEvents="none"
      style={[styles.iconContainer, { opacity: visibility, transform: [{ scale: visibility }] }]}>
      <Svg width={24} height={24} viewBox="0 0 24 24" stroke={LOCATION_ICON_COLOR}
        strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        {isHeading && <Path d="M12 2.5v1.5" fill="none" />}
        <Path d={isHeading ? 'M12 7 19 21.5 12 17.5 5 21.5Z'
          : 'M19.601 4.399 14.298 19.601 12.177 11.823 4.399 9.702Z'}
          fill={LOCATION_ICON_COLOR} fillOpacity={visibleMode === 'free' ? 0 : 1} />
      </Svg>
    </Animated.View>
  );
}

// ホームの地図を表示し、地図内の描画処理とアプリの操作をつなぐ。
export function HomeMap({
  postPins, modeRevision, nearbyPostIds, selectedPin, location, displayPosition, heading, controlsInset, onSelectPin, onOpenSettings,
}: {
  postPins: readonly PostPin[];
  modeRevision: number;
  nearbyPostIds: ReadonlySet<number>;
  selectedPin: { id: number } | null;
  location: LocationState;
  displayPosition: DisplayPosition | null;
  heading: number | null;
  controlsInset: ReturnType<typeof Animated.add>;
  onSelectPin: (selection: MapPinSelection, revision: number) => void;
  onOpenSettings: () => void;
}) {
  const webView = useRef<WebView<WebViewProps>>(null);
  
  // コンパス回転用のAnimated値
  const compassRotation = useRef(new Animated.Value(0)).current;
  const compassRotationStyle = useMemo(() => compassRotation.interpolate({
    inputRange: [-360, 360],
    outputRange: ['-360deg', '360deg'],
  }), [compassRotation]);

  const latestControlsInset = useRef(0);
  const [trackingMode, setTrackingMode] = useState<LocationTrackingMode>('free');
  const [mapState, setMapState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [overlayIssue, setOverlayIssue] = useState<OverlayIssue | null>(null);
  const [appliedPoint, setAppliedPoint] = useState<MapPoint | null>(null);
  const [showPositionNotice, setShowPositionNotice] = useState(false);
  const [document, setDocument] = useState<ReturnType<typeof makeMapDocument> | null>(null);
  const [headingWaitElapsed, setHeadingWaitElapsed] = useState(false);
  const [webViewLoaded, setWebViewLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [appliedModeRevision, setAppliedModeRevision] = useState<number | null>(null);
  const pinModeApplied = appliedModeRevision === modeRevision;
  const appliedJson = useRef<string | null>(null);
  const requestId = useRef(0);
  const pendingHeading = useRef<number | null>(null);
  const pending = useRef<{ id: number; json: string; point: MapPoint | null } | null>(null);
  const coordinates = location.status === 'ready' ? location.coordinates : null;
  const latitude = coordinates?.latitude ?? null;
  const longitude = coordinates?.longitude ?? null;
  
  const pins = useMemo(() => (postPins ?? []).map(pin => ({
    ...pin,
    nearby: nearbyPostIds.has(pin.id),
  })), [postPins, nearbyPostIds]);

  const snapshot: MapSnapshot = useMemo(() => ({
    current: latitude !== null && longitude !== null ? { latitude, longitude } : null,
    displayPosition: latitude !== null && longitude !== null ? displayPosition : null,
    modeRevision,
    pins: pins.map(pin => ({
      ...pin,
      // 配色と破線は、サーバーから一覧が届く前でも現在の距離に追従させる。
      withinRadius: latitude !== null && longitude !== null &&
        isWithinPostRadius(distanceMeters(latitude, longitude, pin.latitude, pin.longitude)),
    })),
  }), [latitude, longitude, displayPosition, modeRevision, pins]);
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
    if (document || location.status !== 'ready' || heading !== null) return;
    const timer = setTimeout(() => setHeadingWaitElapsed(true), INITIAL_HEADING_WAIT_MS);
    return () => clearTimeout(timer);
  }, [document, location.status, heading]);

  useEffect(() => {
    if (document || location.status === 'loading') return;
    if (location.status === 'ready' && heading === null && !headingWaitElapsed) return;
    setDocument(makeMapDocument(snapshot, snapshotJson, heading));
  }, [document, location.status, snapshot, snapshotJson, heading, headingWaitElapsed]);

  useEffect(() => {
    if (mapState !== 'ready' || !document || snapshotJson === appliedJson.current) return;
    const id = ++requestId.current;
    // 送信後に内容が前回と同じ状態へ戻っても、送り直して移動中の更新を上書きする。
    appliedJson.current = null;
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
    let timer: ReturnType<typeof setTimeout> | undefined;
    const listener = controlsInset.addListener(({ value }) => {
      latestControlsInset.current = value;
      if (trackingMode === 'free') return;
      // シートが動くたびに地図のアニメーションを始め直さず、高さが落ち着いてから中央を合わせる。
      clearTimeout(timer);
      timer = setTimeout(() => {
        const command = JSON.stringify({ type: 'tracking-inset', bottomInset: latestControlsInset.current });
        webView.current?.injectJavaScript(`window.receiveKokoMapCommand(${command}); true;`);
      }, 100);
    });
    return () => {
      clearTimeout(timer);
      controlsInset.removeListener(listener);
    };
  }, [controlsInset, trackingMode]);

  useEffect(() => {
    if (mapState !== 'ready' || !pinModeApplied) return;
    const selection = JSON.stringify({ type: 'select-post-pin', id: selectedPin?.id ?? null, modeRevision });
    webView.current?.injectJavaScript(`window.receiveKokoMapCommand(${selection}); true;`);
    if (!selectedPin) return;

    // シートの移動が落ち着いてから、見えている地図の中央にピンを合わせる。
    const timer = setTimeout(() => {
      const focus = JSON.stringify({
        type: 'center-post-pin', id: selectedPin.id, bottomInset: latestControlsInset.current, modeRevision,
      });
      webView.current?.injectJavaScript(`window.receiveKokoMapCommand(${focus}); true;`);
    }, 300);
    return () => clearTimeout(timer);
  }, [mapState, modeRevision, pinModeApplied, selectedPin]);

  // 現在地ボタンの操作と、シートで隠れている範囲を地図へ渡す。
  const cycleLocationTracking = () => {
    const command = JSON.stringify({ type: 'cycle-location-tracking', bottomInset: latestControlsInset.current });
    webView.current?.injectJavaScript(`window.receiveKokoMapCommand(${command}); true;`);
  };

  // コンパスの操作を地図へ送り、北を上にする。
  const resetBearing = () => {
    const command = JSON.stringify({ type: 'reset-bearing' });
    webView.current?.injectJavaScript(`window.receiveKokoMapCommand(${command}); true;`);
  };

  // 追従状態と描画済みデータを初期化し、最新の座標と投稿データで地図を読み直す。
  const reloadMap = useCallback(() => {
    pending.current = null;
    appliedJson.current = null;
    setAppliedModeRevision(null);
    setTrackingMode('free');
    compassRotation.setValue(0);
    setMapState('loading');
    setOverlayIssue(null);
    setAppliedPoint(null);
    setShowPositionNotice(false);
    setWebViewLoaded(false);
    setDocument(makeMapDocument(snapshot, snapshotJson, heading));
    setReloadKey(key => key + 1);
  }, [compassRotation, snapshot, snapshotJson, heading]);

  useEffect(() => {
    if (mapState !== 'loading' || !document) return;
    const timer = setTimeout(() => setMapState('error'), 25000);
    return () => clearTimeout(timer);
  }, [mapState, document, reloadKey]);

  // 地図から準備完了・追従状態・更新結果・ピン選択などを受け取って反映する。
  const onMapMessage = ({ nativeEvent }: WebViewMessageEvent) => {
    if (nativeEvent.data.length > 1024) return;
    let message: { type?: unknown; id?: unknown; issue?: unknown; requestId?: unknown;
      bearing?: unknown; modeRevision?: unknown; mode?: unknown } | null;
    try {
      message = JSON.parse(nativeEvent.data);
    } catch {
      return;
    }
    if (!message || typeof message !== 'object') return;

    if (message.type === 'bearing-change' && typeof message.bearing === 'number' && Number.isFinite(message.bearing)) {
      // 地図側で補間済みの角度を使い、±180度の境界でコンパスが一周するのを防ぐ。
      compassRotation.setValue(-message.bearing);
      return;
    }

    if (message.type === 'location-tracking') {
      // 開発中の更新で再利用された地図からは、以前の状態名が届くことがある。
      const mode = message.mode === 'north' ? 'position' : message.mode;
      if (mode === 'free' || mode === 'position' || mode === 'heading') {
        setTrackingMode(mode);
      }
    } else if (message.type === 'ready') {
      const issue = readOverlayIssue(message.issue);
      appliedJson.current = issue === null ? document?.json ?? null : null;
      setAppliedModeRevision(message.modeRevision === modeRevision ? modeRevision : null);
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
      setAppliedModeRevision(message.modeRevision === modeRevision ? modeRevision : null);
      if (message.type === 'overlay-applied') {
        appliedJson.current = currentRequest.json;
        setOverlayIssue(null);
      } else {
        setOverlayIssue(readOverlayIssue(message.issue));
      }
      if (message.type === 'overlay-applied' || message.issue === 'pins') {
        const next = currentRequest.point;
        setAppliedPoint(previous =>
          previous?.latitude === next?.latitude && previous?.longitude === next?.longitude ? previous : next);
      }
    } else if (message.type === 'pin' && pinModeApplied) {
      const selection = resolvePostPinTap(postPins, message.id, message.modeRevision, modeRevision);
      if (selection) onSelectPin(selection, modeRevision);
    }
  };

  const locationMessage = location.status === 'denied' ? '位置情報が許可されていません。許可する場合はiPhoneの設定をご確認ください。'
    : location.status === 'disabled' ? '端末の位置情報がオフです。'
    : location.status === 'timeout' ? '現在地の取得に時間がかかっています。'
    : location.status === 'error' ? '現在地を取得できませんでした。'
    : '';
  const positionNotice = positionNeedsUpdate && showPositionNotice;
  const locationButtonLabel = trackingMode === 'heading' ? '現在地を方角に合わせて追従中'
    : trackingMode === 'position' ? '現在地を追従中' : '現在地に戻る';
  const locationButtonHint = trackingMode === 'heading' ? '地図の向きを保つ現在地追従に切り替えます'
    : trackingMode === 'position' ? (heading === null ? '端末の方角を取得できません' : '方角追従に切り替えます')
    : '地図の向きを保ったまま、現在地へ移動します';
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
        pointerEvents={pinModeApplied ? 'auto' : 'none'}
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
      <Animated.View pointerEvents="box-none" style={[styles.controls, { bottom: controlsInset }]}>
        {mapState === 'ready' && (
          <View pointerEvents="box-none" style={styles.creditArea}>
            <View pointerEvents="box-none" style={styles.credits}>
              {mapCredits.map(({ label, url }) => (
                <Text key={url} accessibilityRole="link" style={styles.creditLink}
                  onPress={() => { void Linking.openURL(url).catch(() => {}); }}>{label}</Text>
              ))}
            </View>
          </View>
        )}
        <View style={styles.mapButtons}>
          <Pressable accessibilityRole="button" accessibilityLabel="設定を開く" style={styles.mapButton}
            onPress={onOpenSettings}>
            <View style={styles.iconContainer}>
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={uiColors.text}
                strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="m9.5 4 .7-2h3.6l.7 2 1.6.9 2.1-.4 1.8 3.1-1.4 1.6v1.8L20 12.6l-1.8 3.1-2.1-.4-1.6.9-.7 2h-3.6l-.7-2-1.6-.9-2.1.4L4 12.6 5.4 11V9.2L4 7.6l1.8-3.1 2.1.4 1.6-.9Z" transform="translate(0 1.9)" />
                <Circle cx={12} cy={12} r={2.5} />
              </Svg>
            </View>
          </Pressable>
          {mapState === 'ready' && (
            <Pressable accessibilityRole="button" accessibilityLabel="北を上に戻す"
              style={styles.mapButton} onPress={resetBearing}>
              <Animated.View style={[styles.iconContainer, { transform: [{ rotate: compassRotationStyle }] }]}>
                <Svg width={26} height={26} viewBox="0 0 24 24">
                  <Polygon points="12,3 15.5,12 8.5,12" fill="#E53935" />
                  <Polygon points="12,21 15.5,12 8.5,12" fill={uiColors.neutral} />
                  <Circle cx="12" cy="12" r="2" fill={uiColors.surface} />
                </Svg>
              </Animated.View>
            </Pressable>
          )}

          {mapState === 'ready' && appliedPoint && coordinates && (
            <Pressable accessibilityRole="button" accessibilityLabel={locationButtonLabel}
              accessibilityHint={locationButtonHint} accessibilityState={{ selected: trackingMode !== 'free' }}
              style={styles.mapButton} onPress={cycleLocationTracking}>
              <LocationTrackingIcon mode={trackingMode} />
            </Pressable>
          )}
        </View>
      </Animated.View>
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
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 6 },
  creditArea: { flex: 1, minWidth: 0, alignItems: 'flex-start' },
  credits: { flexDirection: 'row', flexWrap: 'wrap', maxWidth: '100%', columnGap: 3,
    backgroundColor: '#FFFFFFCC', borderRadius: 4, paddingVertical: 2, paddingHorizontal: 3 },
  creditLink: { flexShrink: 1, color: uiColors.text, fontSize: 10, textDecorationLine: 'underline' },
  iconContainer: {
    width: 26,
    height: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapButtons: {
    marginLeft: 'auto',
    flexDirection: 'column',
    gap: 10,
  },
  mapButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: uiColors.surface,
    elevation: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
  },
  map: { flex: 1, backgroundColor: uiColors.background },
  noticeArea: { position: 'absolute', top: 0, left: 0, right: 0 },
  notice: { margin: 12, marginTop: 100, padding: 12, borderRadius: 10, backgroundColor: '#FFFFFFEE' },
  noticeText: { fontSize: 13, lineHeight: 20, color: uiColors.text },
  retry: { minHeight: 44, justifyContent: 'center' },
  retryText: { fontWeight: '700', color: uiColors.primary },
});
