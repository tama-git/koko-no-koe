import { useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentRef } from 'react';
import { ActionSheetIOS, ActivityIndicator, Alert, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getPostPlaceDisplay } from '../postService';
import type { PostPlaceAttribution, ViewerCoordinates } from '../postService';
import { POST_SORT_LABELS, sortPosts } from '../sortPosts';
import type { PostSortOrder } from '../sortPosts';
import type { PostListScope, PostListState } from '../usePostList';
import { PostListCard } from './PostListCard';
import { PostPlaceCredits } from './PostPlaceCredits';
import { uiColors } from '../../shared/uiColors';

function getCurrentOrder(order: PostSortOrder, canSortByDistance: boolean): PostSortOrder {
  return !canSortByDistance && order === 'nearest' ? 'newest' : order;
}

export function PostListSortButton({ order, canSortByDistance, onOrderChange }: {
  order: PostSortOrder;
  canSortByDistance: boolean;
  onOrderChange: (order: PostSortOrder) => void;
}) {
  const currentOrder = getCurrentOrder(order, canSortByDistance);
  const chooseOrder = () => {
    const options: PostSortOrder[] = canSortByDistance ? ['newest', 'oldest', 'nearest'] : ['newest', 'oldest'];
    const select = (next: PostSortOrder) => {
      if (next !== currentOrder) onOrderChange(next);
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions({
        title: '並べ替え',
        options: [...options.map(option => POST_SORT_LABELS[option]), 'キャンセル'],
        cancelButtonIndex: options.length,
      }, index => {
        const next = options[index];
        if (next) select(next);
      });
      return;
    }
    Alert.alert('並べ替え', undefined, options.map(option => ({
      text: POST_SORT_LABELS[option],
      onPress: () => select(option),
    })), { cancelable: true });
  };

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`並べ替え、現在は${POST_SORT_LABELS[currentOrder]}`}
      style={styles.sortButton} onPress={chooseOrder}>
      <Text style={[styles.link, styles.sortLabel]}>{POST_SORT_LABELS[currentOrder]} ▾</Text>
    </Pressable>
  );
}

/** 自分の一覧と公開一覧で、読み込み・エラー・投稿カードを共用する。 */
export function PostList({ list, onSelectPost, scope, token, coordinates, order, onOrderChange }: {
  list: PostListState;
  onSelectPost: (id: number) => void;
  scope: PostListScope;
  token: string;
  coordinates?: ViewerCoordinates;
  order: PostSortOrder;
  onOrderChange?: (order: PostSortOrder) => void;
}) {
  const { posts, loading, error, refresh, refreshing } = list;
  const [viewportHeight, setViewportHeight] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const previousOrder = useRef(order);

  const canSortByDistance = scope === 'public' && coordinates !== undefined;
  const currentOrder = getCurrentOrder(order, canSortByDistance);
  const sortCoordinates = currentOrder === 'nearest' ? coordinates : undefined;
  const sortedPosts = useMemo(() => sortPosts(posts, currentOrder, sortCoordinates), [posts, currentOrder, sortCoordinates]);
  const placeSources = useMemo(() => posts.flatMap<PostPlaceAttribution>(post => {
    const { attribution } = getPostPlaceDisplay(post);
    return attribution ? [attribution] : [];
  }), [posts]);

  useEffect(() => {
    if (previousOrder.current === order) return;
    previousOrder.current = order;
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [order]);

  return (
    <>
      {posts.length > 0 && onOrderChange && (
        <View style={styles.standaloneSort}>
          <PostListSortButton order={order} canSortByDistance={canSortByDistance} onOrderChange={onOrderChange} />
        </View>
      )}
      <ScrollView ref={scroll} style={styles.scroll} contentContainerStyle={styles.list} alwaysBounceVertical
        onLayout={event => setViewportHeight(event.nativeEvent.layout.height)}
        onScroll={event => setScrollY(Math.max(0, event.nativeEvent.contentOffset.y))}
        scrollEventThrottle={64}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        {loading && !refreshing && <ActivityIndicator color={uiColors.primary} />}
        {error ? <View>
          <Text accessibilityLiveRegion="polite">{error}</Text>
          <Pressable accessibilityRole="button" style={styles.refresh} onPress={refresh}><Text style={styles.link}>再取得</Text></Pressable>
        </View> : null}
        {!loading && !error && posts.length === 0 && <Text>{scope === 'public' ? '近くで読める声はありません。' : 'まだ投稿がありません。トップ下部のバーから投稿できます。'}</Text>}
        {sortedPosts.map(post => <PostListCard key={post.id} post={post} scope={scope} token={token} coordinates={coordinates}
          viewportHeight={viewportHeight} scrollY={scrollY} onSelectPost={onSelectPost} />)}
        {placeSources.length > 0 && (
          <View style={styles.creditsFooter}>
            <Text style={styles.creditsLabel}>場所データの出典</Text>
            <PostPlaceCredits sources={placeSources} compact />
          </View>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  list: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 20 },
  creditsFooter: { gap: 2, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderColor: uiColors.border },
  creditsLabel: { fontSize: 12, fontWeight: '600', color: uiColors.primary },
  refresh: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', marginBottom: 8 },
  standaloneSort: { alignItems: 'flex-end', paddingRight: 12 },
  sortButton: { minHeight: 44, minWidth: 44, maxWidth: '46%', justifyContent: 'center', paddingHorizontal: 4 },
  sortLabel: { fontSize: 14, textAlign: 'right' },
  link: { color: uiColors.primary, fontWeight: '600' },
});
