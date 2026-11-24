import type { PostPin, SavedPost, ViewerCoordinates } from '../posts/postService';
import { distanceMeters } from './filterNearbyPosts';

export type SelectablePostPin = PostPin & { nearby: boolean };
export type MapPinSelection = { id: number; own: boolean } | { id: number; distanceMeters: number | null };

/** 本人向けAPIで取得した投稿を、地図に必要な項目だけに変換する。 */
export function ownPostsToPins(posts: readonly SavedPost[]): PostPin[] {
  const pins: PostPin[] = [];
  for (const { id, latitude, longitude, is_own: isOwn } of posts) {
    if (isOwn === false || latitude === null || longitude === null ||
      !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 || Math.abs(longitude) > 180) continue;
    pins.push({ id, latitude, longitude, isOwn: true });
  }
  return pins;
}

export function resolvePostPinTap(
  pins: readonly SelectablePostPin[], pinId: unknown, eventRevision: unknown, modeRevision: number,
  coordinates: ViewerCoordinates | null,
): MapPinSelection | null {
  if (eventRevision !== modeRevision || !Number.isSafeInteger(pinId)) return null;
  const pin = pins.find(item => item.id === pinId);
  if (!pin) return null;
  if (pin.isOwn) return { id: pin.id, own: true };
  if (coordinates && pin.nearby) return { id: pin.id, own: false };
  return {
    id: pin.id,
    distanceMeters: coordinates
      ? distanceMeters(coordinates.latitude, coordinates.longitude, pin.latitude, pin.longitude)
      : null,
  };
}
