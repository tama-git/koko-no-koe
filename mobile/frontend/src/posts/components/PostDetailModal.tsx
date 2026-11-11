import { Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { PostDetailScreen } from '../screens/PostDetailScreen';

type Props = { onClose: () => void } & (
  | { postId: number; token: string; onHidden?: () => void }
  | { distanceMeters: number | null }
);

export function PostDetailModal(props: Props) {
  const { onClose } = props;
  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      {'distanceMeters' in props ? (
        <SafeAreaView style={styles.screen}>
          <View style={styles.content}>
            <Text accessibilityRole="header" style={styles.title}>投稿詳細</Text>
            <View style={styles.card}>
              <Text style={styles.label}>{props.distanceMeters === null ? '距離を表示できません' : '範囲外の投稿'}</Text>
              <Text style={styles.distance}>{props.distanceMeters === null
                ? '現在地の取得後に距離を確認できます。'
                : `現在地から約 ${(props.distanceMeters / 1000).toFixed(2)} km`}</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.back}>
              <Text style={styles.backText}>戻る</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      ) : (
        <PostDetailScreen token={props.token} route={{ params: { postId: props.postId } }}
          navigation={{ goBack: onClose }} onHidden={props.onHidden ?? onClose} />
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F9F7' },
  content: { width: '100%', maxWidth: 440, alignSelf: 'center', padding: 20, gap: 20 },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center', color: '#1C3D2D' },
  card: { padding: 20, gap: 8, borderRadius: 12, borderWidth: 1, borderColor: '#E2EBE0', backgroundColor: '#FFFFFF' },
  label: { fontSize: 14, fontWeight: '600', color: '#2C6049' },
  distance: { fontSize: 18, color: '#1D4030' },
  back: { minHeight: 48, justifyContent: 'center', alignItems: 'center', borderRadius: 10, backgroundColor: '#2C6049' },
  backText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
