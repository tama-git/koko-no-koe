import type { ViewerCoordinates } from '../posts/postService';
import { distanceMeters, isWithinPostRadius, RADIUS_METERS } from './filterNearbyPosts';

const directions = ['北', '北東', '東', '南東', '南', '南西', '西', '北西'] as const;
const radians = Math.PI / 180;

// 現在地と投稿地点から距離・8方位・圏内外と閲覧可能になるまでの残り距離を計算する。
export function getPostProximity(origin: ViewerCoordinates | undefined, target: ViewerCoordinates | null) {
  if (!origin || !target) return null;

  const distance = distanceMeters(origin.latitude, origin.longitude, target.latitude, target.longitude);
  const fromLatitude = origin.latitude * radians;
  const toLatitude = target.latitude * radians;
  const deltaLongitude = (target.longitude - origin.longitude) * radians;
  const east = Math.sin(deltaLongitude) * Math.cos(toLatitude);
  const north = Math.cos(fromLatitude) * Math.sin(toLatitude)
    - Math.sin(fromLatitude) * Math.cos(toLatitude) * Math.cos(deltaLongitude);
  const bearing = (Math.atan2(east, north) / radians + 360) % 360;
  const directionIndex = Math.round(bearing / 45) % directions.length;

  return {
    distance,
    direction: directions[directionIndex],
    arrowRotation: directionIndex * 45,
    withinRadius: isWithinPostRadius(distance),
    remaining: Math.max(0, distance - RADIUS_METERS),
  };
}

export function canOpenSelectedPost(own: boolean, withinRadius: boolean, inReadableFeed: boolean) {
  // 他人の詳細は測位結果に加えて、サーバーが返した読み取り可能な一覧に含まれる場合に開く。
  return own || (withinRadius && inReadableFeed);
}

// 1000m未満をメートル、それ以上をキロメートルの表示に整える。
export function formatPostDistance(meters: number, roundUp = false): { value: string; unit: 'm' | 'km' } {
  return meters < 1000
    ? { value: String((roundUp ? Math.ceil : Math.round)(meters)), unit: 'm' }
    : { value: String(Number((meters / 1000).toFixed(2))), unit: 'km' };
}
