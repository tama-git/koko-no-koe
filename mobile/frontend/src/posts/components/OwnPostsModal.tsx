import { useState } from 'react';
import { Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { PostList } from './PostList';
import { PostDetailScreen } from '../screens/PostDetailScreen';

export function OwnPostsModal({ token, refreshKey, onClose, onPostDeleted }: {
  token: string;
  refreshKey: number;
  onClose: () => void;
  onPostDeleted: () => void;
}) {
  const [postId, setPostId] = useState<number | null>(null);
  const finishDeletion = () => {
    setPostId(null);
    onPostDeleted();
  };
  return <Modal visible animationType="slide" presentationStyle="fullScreen"
    onRequestClose={() => { if (postId !== null) setPostId(null); else onClose(); }}>
    {postId !== null
      ? <PostDetailScreen token={token} route={{ params: { postId } }}
          navigation={{ goBack: () => setPostId(null) }} onDeleted={finishDeletion} />
      : <SafeAreaView style={styles.screen}>
          <View style={styles.header}><Text style={styles.title}>自分の投稿</Text>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.close}><Text>閉じる</Text></Pressable></View>
          <PostList scope="own" token={token} refreshKey={refreshKey} onSelectPost={setPostId} />
        </SafeAreaView>}
  </Modal>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  title: { fontSize: 20, fontWeight: '700', color: '#1D4030' },
  close: { padding: 14 },
});
