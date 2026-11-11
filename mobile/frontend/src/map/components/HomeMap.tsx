import { useCallback, useEffect, useRef, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import type { Region } from 'react-native-maps';
import Svg, { Defs, Mask, Rect, Circle } from 'react-native-svg';
import type { LocationState } from '../../location/useCurrentLocation';
import type { SavedPost } from '../../posts/postService';
import { distanceMeters, RADIUS_METERS } from '../filterNearbyPosts';

// Phase 1の仮設定。現在地ではなく、日本全体を見渡すための初期範囲。
const INITIAL_JAPAN_REGION: Region = {
  latitude: 36,
  longitude: 138,
  latitudeDelta: 36,
  longitudeDelta: 36,
};

/** トップ画面の地図。iPhoneの既定プロバイダー（Apple Maps）を使う。 */
export function HomeMap({ posts, nearbyPostIds, location, onSelectPost, onShowDistance, onRecenterReady }: {
  posts: readonly SavedPost[];
  nearbyPostIds: ReadonlySet<number>;
  location: LocationState;
  onSelectPost: (id: number) => void;
  onShowDistance: (distance: number | null) => void;
  onRecenterReady?: (recenter: () => void) => void;
}) {
  const map = useRef<MapView>(null);
  const [mapReady, setMapReady] = useState(false);
  const centered = useRef(false);

  // 現在地の画面上のピクセル座標
  const [circleCenter, setCircleCenter] = useState<{ x: number; y: number } | null>(null);
  // SVGオーバーレイのサイズ
  const [layout, setLayout] = useState<{ width: number; height: number } | null>(null);
  // 250mが何ピクセルに相当するか
  const [radiusPx, setRadiusPx] = useState<number>(0);

  // 現在地のピクセル座標と半径を再計算する（地図移動時・現在地取得時・地図準備完了時に呼ぶ）
  const updateCircle = useCallback(async () => {
    if (location.status !== 'ready' || !map.current || !layout) return;
    try {
      const point = await map.current.pointForCoordinate({
        latitude: location.coordinates.latitude,
        longitude: location.coordinates.longitude,
      });
      setCircleCenter({ x: point.x, y: point.y });
      const edgePoint = await map.current.pointForCoordinate({
        latitude: location.coordinates.latitude + (RADIUS_METERS / 111320),
        longitude: location.coordinates.longitude,
      });
      setRadiusPx(Math.abs(point.y - edgePoint.y));
    } catch {
      // 地図の準備ができていない場合は無視
    }
  }, [location, layout]);

  // 現在地取得直後・地図準備完了時に丸を即時表示する
  useEffect(() => {
    if (!mapReady || location.status !== 'ready') return;
    void updateCircle();
    if (centered.current || !map.current) return;
    centered.current = true;
    map.current.animateToRegion({
      latitude: location.coordinates.latitude,
      longitude: location.coordinates.longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    }, 600);
  }, [mapReady, location, updateCircle]);

  // 現在地に戻るボタンを押したときの処理
  const handleRecenter = useCallback(() => {
    if (location.status !== 'ready' || !map.current) return;
    map.current.animateToRegion({
      latitude: location.coordinates.latitude,
      longitude: location.coordinates.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    }, 600);
  }, [location]);

  // 現在地に戻る関数を親コンポーネントに渡す
  useEffect(() => {
    onRecenterReady?.(handleRecenter);
  }, [handleRecenter, onRecenterReady]);

  const selectMarker = (id: number, latitude: number, longitude: number) => {
    if (location.status !== 'ready') {
      onShowDistance(null);
      return;
    }
    if (nearbyPostIds.has(id)) {
      onSelectPost(id);
      return;
    }
    const distance = distanceMeters(
      location.coordinates.latitude, location.coordinates.longitude, latitude, longitude,
    );
    onShowDistance(distance);
  };

  const message = location.status === 'loading' ? '現在地を取得しています…'
    : location.status === 'denied' ? '位置情報が許可されていません。地図はそのまま利用できます。許可する場合はiPhoneの設定をご確認ください。'
    : location.status === 'disabled' ? '端末の位置情報がオフです。地図はそのまま利用できます。'
    : location.status === 'timeout' ? '現在地の取得に時間がかかっています。地図はそのまま利用できます。再取得する場合は画面を開き直してください。'
    : location.status === 'error' ? '現在地を取得できませんでした。地図はそのまま利用できます。'
    : '';

  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={e => setLayout({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
      <MapView
        ref={map}
        style={StyleSheet.absoluteFill}
        initialRegion={INITIAL_JAPAN_REGION}
        onMapReady={() => setMapReady(true)}
        onRegionChange={() => { void updateCircle(); }}
        onRegionChangeComplete={() => { void updateCircle(); }}
        scrollEnabled
        zoomEnabled
        showsUserLocation={location.status === 'ready'}
        showsMyLocationButton={false}
      >
        {posts.map(({ id, latitude, longitude, is_published }) => {
          if (is_published !== true || latitude === null || longitude === null) return null;
          return (
            <Marker key={id} coordinate={{ latitude, longitude }}
              pinColor={nearbyPostIds.has(id) ? '#B43A37' : '#446C9A'}
              onPress={() => selectMarker(id, latitude, longitude)} />
          );
        })}
      </MapView>

      {/* 地図の上にSVGオーバーレイを重ねる。現在地が取れていて座標計算済みの場合のみ表示。 */}
      {location.status === 'ready' && circleCenter && layout && radiusPx > 0 && (
        <Svg
          style={StyleSheet.absoluteFill}
          width={layout.width}
          height={layout.height}
          pointerEvents="none"
        >
          <Defs>
            {/* マスク：白=表示、黒=非表示。全体を白にして円を黒にすることで円の中が透明になる */}
            <Mask id="hole">
              <Rect width={layout.width} height={layout.height} fill="white" />
              <Circle cx={circleCenter.x} cy={circleCenter.y} r={radiusPx} fill="black" />
            </Mask>
          </Defs>
          {/* マスクを適用した半透明オーバーレイ。円の部分だけ穴が開く。 */}
          <Rect
            width={layout.width}
            height={layout.height}
            fill="#000000"
            fillOpacity={0.3}
            mask="url(#hole)"
          />
          {/* 円の境界線 */}
          <Circle
            cx={circleCenter.x}
            cy={circleCenter.y}
            r={radiusPx}
            fill="none"
            stroke="#000000"
            strokeWidth={2}
          />
        </Svg>
      )}

      {message ? (
        <SafeAreaView pointerEvents="box-none" style={styles.noticeArea}>
          <View pointerEvents="none" style={styles.notice}>
            <Text accessibilityLiveRegion="polite" style={styles.noticeText}>{message}</Text>
          </View>
        </SafeAreaView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  noticeArea: { position: 'absolute', top: 0, left: 0, right: 64 },
  notice: { margin: 12, marginTop: 64, padding: 12, borderRadius: 10, backgroundColor: '#FFFFFFEE' },
  noticeText: { fontSize: 13, lineHeight: 20, color: '#1D4030' },
  recenterArea: { position: 'absolute', bottom: 100, right: 12 },
  recenterButton: { backgroundColor: '#FFFFFF', borderRadius: 22, paddingHorizontal: 16, minHeight: 44, justifyContent: 'center', elevation: 3 },
  recenterButtonPressed: { opacity: 0.7 },
  recenterText: { color: '#1D4030', fontSize: 14, fontWeight: '700' },
});
