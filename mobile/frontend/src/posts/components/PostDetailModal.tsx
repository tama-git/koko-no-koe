import { Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PostDetailScreen } from '../screens/PostDetailScreen';
import { uiColors } from '../../shared/uiColors';

type Props = { onClose: () => void } & (
  | {
      postId: number;
      token: string;
      onHidden?: () => void;
      onDeleted?: () => void;
      onVisibilityChanged?: () => void;
    }
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
            <DistanceCard distanceMeters={props.distanceMeters} />
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.back}>
              <Text style={styles.backText}>戻る</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      ) : (
        <PostDetailScreen token={props.token} route={{ params: { postId: props.postId } }}
          navigation={{ goBack: onClose }} onHidden={props.onHidden ?? onClose}
          onDeleted={props.onDeleted} onVisibilityChanged={props.onVisibilityChanged} />
      )}
    </Modal>
  );
}

function DistanceCard({ distanceMeters }: { distanceMeters: number | null }) {
  return <View style={styles.card}>
    <Text style={styles.label}>{distanceMeters === null ? '距離を表示できません' : '範囲外の投稿'}</Text>
    <Text style={styles.distance}>{distanceMeters === null
      ? '現在地の取得後に距離を確認できます。'
      : `現在地から約 ${(distanceMeters / 1000).toFixed(2)} km`}</Text>
    {distanceMeters !== null && <Text>この場所に近づくと閲覧できます。</Text>}
  </View>;
}

export function PostDistanceNotice({ distanceMeters }: { distanceMeters: number | null }) {
  return <ScrollView contentContainerStyle={styles.content}><DistanceCard distanceMeters={distanceMeters} /></ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: uiColors.background },
  content: { width: '100%', maxWidth: 440, alignSelf: 'center', padding: 20, gap: 20 },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center', color: uiColors.text },
  card: { padding: 20, gap: 8, borderRadius: 12, borderWidth: 1, borderColor: uiColors.border, backgroundColor: uiColors.surface },
  label: { fontSize: 14, fontWeight: '600', color: uiColors.primary },
  distance: { fontSize: 18, color: uiColors.text },
  back: { minHeight: 48, justifyContent: 'center', alignItems: 'center', borderRadius: 10, backgroundColor: uiColors.primaryFill },
  backText: { color: uiColors.onPrimary, fontSize: 15, fontWeight: '700' },
});
