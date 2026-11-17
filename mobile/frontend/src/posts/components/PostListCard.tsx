import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { LayoutRectangle } from 'react-native';

import { getPostThumbnail } from '../postService';
import type { SavedPost, ViewerCoordinates } from '../postService';
import type { PostListScope } from '../usePostList';

const THUMBNAIL_LOOKAHEAD = 120;
const THUMBNAIL_SCROLL_DELAY_MS = 120;

function formatPostDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${date.getMonth() + 1}月${date.getDate()}日 ${hours}:${minutes}`;
}

export function PostListCard({ post, onSelectPost, scope, token, coordinates, viewportHeight, scrollY }: {
  post: SavedPost & { is_own?: boolean; isOwn?: boolean };
  onSelectPost: (id: number) => void;
  scope: PostListScope;
  token: string;
  coordinates?: ViewerCoordinates;
  viewportHeight: number;
  scrollY: number;
}) {
  const [layout, setLayout] = useState<LayoutRectangle>();
  const [request, setRequest] = useState<{ coordinates?: ViewerCoordinates }>();
  const [uri, setUri] = useState<string>();
  const message = post.message.trim();
  const nearViewport = viewportHeight > 0 && layout !== undefined
    && layout.y + layout.height > scrollY && layout.y < scrollY + viewportHeight + THUMBNAIL_LOOKAHEAD;
  const isOwnList = scope === 'own';
  
  // マイページ（自分の投稿一覧）にいる場合、または投稿データ自体に is_own / isOwn がある場合に自分の投稿と判定
  const isOwnPost = isOwnList || Boolean((post as any).is_own ?? (post as any).isOwn);

  const canReadThumbnail = isOwnList || coordinates !== undefined;
  const latestCoordinates = useRef(coordinates);

  useEffect(() => { latestCoordinates.current = coordinates; }, [coordinates]);

  useEffect(() => {
    if (!post.image || !nearViewport || request || !canReadThumbnail) return;
    // 素早く通過したカードは読み込んだりせず、表示範囲の近くに残ったカードを優先する。
    const timer = setTimeout(() => {
      const viewerCoordinates = isOwnList ? undefined : latestCoordinates.current;
      if (isOwnList || viewerCoordinates) setRequest({ coordinates: viewerCoordinates });
    }, THUMBNAIL_SCROLL_DELAY_MS);
    return () => clearTimeout(timer);
  }, [post.image, nearViewport, request, canReadThumbnail, isOwnList]);

  useEffect(() => {
    if (!request) return;
    const controller = new AbortController();
    setUri(undefined);
    void getPostThumbnail(post.id, token, request.coordinates, controller.signal).then(
      thumbnail => { if (!controller.signal.aborted) setUri(thumbnail); },
      () => { /* 取得できなければ本文または「写真の投稿」を表示し、ここでは再試行しない。 */ },
    );
    return () => controller.abort();
  }, [post.id, token, request]);

  const visibility = post.is_admin_hidden === true ? '管理者により非表示' : post.is_published ? '公開' : '非公開';
  const metadata = [isOwnList ? visibility : '', formatPostDate(post.created_at)].filter(Boolean).join(' ・ ');

  return <Pressable accessibilityRole="button" onPress={() => onSelectPost(post.id)} 
    style={[styles.post, isOwnPost && styles.ownPost]}
    onLayout={event => setLayout(event.nativeEvent.layout)}>
    <View style={uri ? styles.photoRow : undefined}>
      {uri && <Image source={{ uri }} resizeMode="contain" style={styles.thumbnail}
        accessibilityLabel="投稿写真" onError={() => setUri(undefined)} />}
      <View style={uri ? styles.rowText : undefined}>
        <Text numberOfLines={4} style={styles.postText}>{message || '写真の投稿'}</Text>
        {metadata ? <Text style={styles.metadata}>{metadata}</Text> : null}
      </View>
    </View>
  </Pressable>;
}

const styles = StyleSheet.create({
  post: { padding: 14, backgroundColor: '#F4F6F4', borderRadius: 12, marginBottom: 12 },
  // 自分の投稿カードの背景色（薄い緑色系）
  ownPost: { backgroundColor: '#E8F5E9' },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumbnail: { width: 96, height: 96, borderRadius: 8 },
  postText: { fontSize: 14, color: '#333333' },
  rowText: { flex: 1 },
  metadata: { marginTop: 4, fontSize: 12, color: '#53645A' },
});