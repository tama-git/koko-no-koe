import { useState } from 'react';
import { Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { PostList } from './PostList';
import { PostDetailScreen } from '../screens/PostDetailScreen';
import type { PostSortOrder } from '../sortPosts';
import { usePostList } from '../usePostList';
import { uiColors } from '../../shared/uiColors';

export function OwnPostsModal({ token, refreshKey, onClose, onPostDeleted, onVisibilityChanged }: {
  token: string;
  refreshKey: number;
  onClose: () => void;
  onPostDeleted: () => void;
  onVisibilityChanged: () => void;
}) {
  const [postId, setPostId] = useState<number | null>(null);
  const [order, setOrder] = useState<PostSortOrder>('newest');
  const list = usePostList(token, 'own', refreshKey);
  const returnToList = () => {
    setPostId(null);
    list.refresh();
  };
  const finishDeletion = () => {
    setPostId(null);
    onPostDeleted();
  };
  return <Modal visible animationType="slide" presentationStyle="fullScreen"
    onRequestClose={postId !== null ? returnToList : onClose}>
    {postId !== null
      ? <PostDetailScreen token={token} route={{ params: { postId } }}
          navigation={{ goBack: returnToList }} onDeleted={finishDeletion} onVisibilityChanged={onVisibilityChanged} />
      : <SafeAreaView style={styles.screen}>
          <View style={styles.header}><Text style={styles.title}>自分の投稿</Text>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.close}><Text>閉じる</Text></Pressable></View>
          <PostList scope="own" token={token} list={list} order={order} onOrderChange={setOrder} onSelectPost={setPostId} />
        </SafeAreaView>}
  </Modal>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: uiColors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  title: { fontSize: 20, fontWeight: '700', color: uiColors.text },
  close: { padding: 14 },
});
