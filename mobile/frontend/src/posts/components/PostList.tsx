import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { loadPosts, loadPublicPosts } from '../postService';
import type { SavedPost } from '../postService';

/** 自分の一覧と公開一覧で、読み込み・エラー・投稿カードを共用する。 */
export function PostList({ token, refreshKey, onSelectPost, scope }: {
  token: string; refreshKey: number; onSelectPost: (id: number) => void;
  scope: 'own' | 'public';
}) {
  const [posts, setPosts] = useState<SavedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setPosts([]);
    setError('');
    setLoading(true);
    const promise = scope === 'public' ? loadPublicPosts(token) : loadPosts(token);
    void promise.then(data => { if (active) setPosts(data); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : '投稿を取得できませんでした。'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, refreshKey, retry, scope]);

  const refresh = () => { if (!loading) setRetry(value => value + 1); };
  return <ScrollView contentContainerStyle={styles.list} alwaysBounceVertical
    refreshControl={<RefreshControl refreshing={loading && retry > 0} onRefresh={refresh} />}>
    {loading && retry === 0 && <ActivityIndicator color="#2C6049" />}
    {error ? <View>
      <Text accessibilityLiveRegion="polite">{error}</Text>
      <Pressable accessibilityRole="button" style={styles.refresh} onPress={refresh}><Text style={styles.link}>再取得</Text></Pressable>
    </View> : null}
    {!loading && !error && posts.length === 0 && <Text>{scope === 'public' ? 'まだ公開投稿がありません。' : 'まだ投稿がありません。トップ下部のバーから投稿できます。'}</Text>}
    {posts.map(post => <Pressable key={post.id} accessibilityRole="button" onPress={() => onSelectPost(post.id)} style={styles.post}>
      <Text style={styles.postText}>{post.message || '写真の投稿'}</Text>
      <Text>{scope === 'public' ? '匿名' : post.is_published ? '公開' : '非公開'} ・ {new Date(post.created_at).toLocaleString('ja-JP')}</Text>
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
