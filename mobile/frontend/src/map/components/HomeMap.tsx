import { useEffect, useRef, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import MapView from 'react-native-maps';
import type { Region } from 'react-native-maps';
import { useCurrentLocation } from '../../location/useCurrentLocation';

// Phase 1の仮設定。現在地ではなく、日本全体を見渡すための初期範囲。
const INITIAL_JAPAN_REGION: Region = {
  latitude: 36,
  longitude: 138,
  latitudeDelta: 36,
  longitudeDelta: 36,
};

/** トップ画面の地図。iPhoneの既定プロバイダー（Apple Maps）を使う。 */
export function HomeMap() {
  const map = useRef<MapView>(null);
  const [mapReady, setMapReady] = useState(false);
  const centered = useRef(false);
  const location = useCurrentLocation();

  useEffect(() => {
    if (!mapReady || location.status !== 'ready' || centered.current || !map.current) return;
    centered.current = true;
    map.current.animateToRegion({
      latitude: location.coordinates.latitude,
      longitude: location.coordinates.longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    }, 600);
  }, [mapReady, location]);

  const message = location.status === 'loading' ? '現在地を取得しています…'
    : location.status === 'denied' ? '位置情報が許可されていません。地図はそのまま利用できます。許可する場合はiPhoneの設定をご確認ください。'
    : location.status === 'disabled' ? '端末の位置情報がオフです。地図はそのまま利用できます。'
    : location.status === 'timeout' ? '現在地の取得に時間がかかっています。地図はそのまま利用できます。再取得する場合は画面を開き直してください。'
    : location.status === 'error' ? '現在地を取得できませんでした。地図はそのまま利用できます。'
    : '';

  return (
    <>
      <MapView
        ref={map}
        style={StyleSheet.absoluteFill}
        initialRegion={INITIAL_JAPAN_REGION}
        onMapReady={() => setMapReady(true)}
        scrollEnabled
        zoomEnabled
        showsUserLocation={location.status === 'ready'}
        showsMyLocationButton={false}
      />
      {message ? (
        <SafeAreaView pointerEvents="box-none" style={styles.noticeArea}>
          <View pointerEvents="none" style={styles.notice}>
            <Text accessibilityLiveRegion="polite" style={styles.noticeText}>{message}</Text>
          </View>
        </SafeAreaView>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  noticeArea: { position: 'absolute', top: 0, left: 0, right: 64 },
  notice: { margin: 12, padding: 12, borderRadius: 10, backgroundColor: '#FFFFFFEE' },
  noticeText: { fontSize: 13, lineHeight: 20, color: '#1D4030' },
});
