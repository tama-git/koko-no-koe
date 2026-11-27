import { distanceMeters } from '../map/filterNearbyPosts';
import type { SavedPost, ViewerCoordinates } from './postService';

export type PostSortOrder = 'newest' | 'oldest' | 'nearest';

export const POST_SORT_LABELS: Record<PostSortOrder, string> = {
  newest: '新しい順',
  oldest: '古い順',
  nearest: '近い順',
};

// 指定された新しい順・古い順・現在地から近い順で、一覧の表示順を決める。
export function sortPosts(posts: readonly SavedPost[], order: PostSortOrder, coordinates?: ViewerCoordinates): SavedPost[] {
  const oldestFirst = order === 'oldest';
  const origin = order === 'nearest' ? coordinates : undefined;
  const invalidTimestamp = oldestFirst ? Infinity : -Infinity;
  const ranked = posts.map(post => {
    const timestamp = Date.parse(post.created_at);
    const distance = origin && post.latitude !== null && post.longitude !== null
      ? distanceMeters(origin.latitude, origin.longitude, post.latitude, post.longitude)
      : Infinity;
    return {
      post,
      timestamp: Number.isFinite(timestamp) ? timestamp : invalidTimestamp,
      distance: Number.isFinite(distance) ? distance : Infinity,
    };
  });
  ranked.sort((a, b) => {
    if (a.distance !== b.distance) return a.distance - b.distance;
    if (a.timestamp !== b.timestamp) return oldestFirst ? a.timestamp - b.timestamp : b.timestamp - a.timestamp;
    return oldestFirst ? a.post.id - b.post.id : b.post.id - a.post.id;
  });
  return ranked.map(item => item.post);
}
