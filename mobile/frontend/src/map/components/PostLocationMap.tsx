import { StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import type { LatLng } from 'react-native-maps';

/** 詳細画面のスクロールを妨げない、投稿地点のプレビュー。 */
export function PostLocationMap({ coordinate }: { coordinate: LatLng }) {
  return (
    <View style={styles.frame}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={{ ...coordinate, latitudeDelta: 0.008, longitudeDelta: 0.008 }}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        <Marker coordinate={coordinate} pinColor="#B43A37" title="投稿地点" />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { height: 190, borderRadius: 8, overflow: 'hidden', backgroundColor: '#E8EFE8' },
});
