// 現在地から半径250m以内の投稿だけを返すフィルター。
// HomeMap.tsx から呼び出す。

import type { SavedPost } from '../posts/postService';

const RADIUS_METERS = 250;

// Haversine公式で2点間の距離（メートル）を計算する。
// 地球を球体として近似するため、数十km以内の短距離では十分な精度がある。
function distanceMeters(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6371000; // 地球の半径（メートル）
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// 現在地から RADIUS_METERS 以内の投稿だけを返す。
// 座標が null の投稿は除外する。
export function filterNearbyPosts(
  posts: readonly SavedPost[],
  currentLat: number,
  currentLon: number,
): SavedPost[] {
  return posts.filter(post => {
    if (post.latitude === null || post.longitude === null) return false;
    return distanceMeters(currentLat, currentLon, post.latitude, post.longitude) <= RADIUS_METERS;
  });
}
