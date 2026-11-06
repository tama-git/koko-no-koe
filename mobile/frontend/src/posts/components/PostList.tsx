import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PostListScope, PostListState } from '../usePostList';

/** 自分の一覧と公開一覧で、読み込み・エラー・投稿カードを共用する。 */
export function PostList({ list, onSelectPost, scope }: {
  list: PostListState;
  onSelectPost: (id: number) => void;
  scope: PostListScope;
}) {
  const { posts, loading, error, refresh, refreshing } = list;
  return <ScrollView contentContainerStyle={styles.list} alwaysBounceVertical
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
    {loading && !refreshing && <ActivityIndicator color="#2C6049" />}
    {error ? <View>
      <Text accessibilityLiveRegion="polite">{error}</Text>
      <Pressable accessibilityRole="button" style={styles.refresh} onPress={refresh}><Text style={styles.link}>再取得</Text></Pressable>
    </View> : null}
    {!loading && !error && posts.length === 0 && <Text>{scope === 'public' ? 'まだ公開投稿がありません。' : 'まだ投稿がありません。トップ下部のバーから投稿できます。'}</Text>}
    {posts.map(post => <Pressable key={post.id} accessibilityRole="button" onPress={() => onSelectPost(post.id)} style={styles.post}>
      <Text style={styles.postText}>{post.message || '写真の投稿'}</Text>
      <Text>{scope === 'public' ? '匿名' : post.is_admin_hidden === true ? '管理者により非表示' : post.is_published ? '公開' : '非公開'} ・ {new Date(post.created_at).toLocaleString('ja-JP')}</Text>
    </Pressable>)}
  </ScrollView>;
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  refresh: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', marginBottom: 8 },
  link: { color: '#2C6049', fontWeight: '600' },
  post: { padding: 18, backgroundColor: '#F4F6F4', borderRadius: 12, marginBottom: 12 },
  postText: { fontSize: 14, color: '#333333' },
});
