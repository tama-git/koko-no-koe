import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ViewerCoordinates } from '../postService';
import type { PostListScope, PostListState } from '../usePostList';
import { PostListCard } from './PostListCard';

/** 自分の一覧と公開一覧で、読み込み・エラー・投稿カードを共用する。 */
export function PostList({ list, onSelectPost, scope, token, coordinates }: {
  list: PostListState;
  onSelectPost: (id: number) => void;
  scope: PostListScope;
  token: string;
  coordinates?: ViewerCoordinates;
}) {
  const { posts, loading, error, refresh, refreshing } = list;
  const [viewportHeight, setViewportHeight] = useState(0);
  const [scrollY, setScrollY] = useState(0);

  return <ScrollView style={styles.scroll} contentContainerStyle={styles.list} alwaysBounceVertical
    onLayout={event => setViewportHeight(event.nativeEvent.layout.height)}
    onScroll={event => setScrollY(Math.max(0, event.nativeEvent.contentOffset.y))}
    scrollEventThrottle={64}
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
    {loading && !refreshing && <ActivityIndicator color="#2C6049" />}
    {error ? <View>
      <Text accessibilityLiveRegion="polite">{error}</Text>
      <Pressable accessibilityRole="button" style={styles.refresh} onPress={refresh}><Text style={styles.link}>再取得</Text></Pressable>
    </View> : null}
    {!loading && !error && posts.length === 0 && <Text>{scope === 'public' ? '近くで読める声はありません。' : 'まだ投稿がありません。トップ下部のバーから投稿できます。'}</Text>}
    {posts.map(post => <PostListCard key={post.id} post={post} scope={scope} token={token} coordinates={coordinates}
      viewportHeight={viewportHeight} scrollY={scrollY} onSelectPost={onSelectPost} />)}
  </ScrollView>;
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  refresh: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', marginBottom: 8 },
  link: { color: '#2C6049', fontWeight: '600' },
});
