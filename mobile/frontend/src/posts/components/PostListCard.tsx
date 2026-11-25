import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { LayoutRectangle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { getPostPlaceDisplay, getPostThumbnail } from '../postService';
import { formatPostDate } from '../formatPostDate';
import type { SavedPost, ViewerCoordinates } from '../postService';
import type { PostListScope } from '../usePostList';
import { PostPlaceCreditLine } from './PostPlaceCredits';
import { uiColors } from '../../shared/uiColors';

const THUMBNAIL_LOOKAHEAD = 120;
const THUMBNAIL_SCROLL_DELAY_MS = 120;

export function PostListCard({ post, onSelectPost, scope, token, coordinates, viewportHeight, scrollY }: {
  post: SavedPost;
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
  const place = getPostPlaceDisplay(post);
  const nearViewport = viewportHeight > 0 && layout !== undefined
    && layout.y + layout.height > scrollY && layout.y < scrollY + viewportHeight + THUMBNAIL_LOOKAHEAD;
  const isOwnList = scope === 'own';
  const isOwnPost = isOwnList || post.is_own === true;

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
  const metadata = [isOwnList ? visibility : isOwnPost ? '自分の投稿' : '', formatPostDate(post.created_at)].filter(Boolean).join(' ・ ');

  return (
    <View style={[styles.post, isOwnPost && styles.ownPost]}
      onLayout={event => setLayout(event.nativeEvent.layout)}>
      <Pressable accessibilityRole="button" onPress={() => onSelectPost(post.id)}
        style={[styles.content, uri && styles.photoRow, place.attribution && styles.contentWithCredits]}>
        {uri && <Image source={{ uri }} resizeMode="contain" style={styles.thumbnail}
          accessibilityLabel="投稿写真" onError={() => setUri(undefined)} />}
        <View style={[styles.copy, uri && styles.rowText]}>
          <View style={styles.placeRow}>
            <Svg accessible={false} style={styles.placePin} width={12} height={12} viewBox="0 0 24 24"
              fill="none" stroke={styles.placeName.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
              <Circle cx={12} cy={10} r={2.5} />
            </Svg>
            <Text numberOfLines={2} ellipsizeMode="tail" style={styles.placeName}>{place.label}</Text>
          </View>
          <Text numberOfLines={3} style={styles.postText}>{message || '写真の投稿'}</Text>
          {metadata ? <Text style={styles.metadata}>{metadata}</Text> : null}
        </View>
      </Pressable>
      {place.attribution && <PostPlaceCreditLine source={place.attribution} />}
    </View>
  );
}

const styles = StyleSheet.create({
  post: { backgroundColor: uiColors.surface, borderRadius: 12, marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth, borderColor: uiColors.border },
  ownPost: { backgroundColor: uiColors.tint, borderLeftWidth: 3, borderLeftColor: uiColors.accent },
  content: { padding: 12 },
  contentWithCredits: { paddingBottom: 4 },
  photoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  thumbnail: { width: 96, height: 96, borderRadius: 8 },
  copy: { gap: 4 },
  placeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  placePin: { marginTop: 2 },
  placeName: { flexShrink: 1, minWidth: 0, fontSize: 10, fontWeight: '400', color: uiColors.primary },
  postText: { fontSize: 14, lineHeight: 20, color: uiColors.text },
  rowText: { flex: 1, minWidth: 0, alignSelf: 'center' },
  metadata: { fontSize: 12, color: uiColors.primary },
});
