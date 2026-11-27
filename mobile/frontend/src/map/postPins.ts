import type { PostPin, SavedPost, ViewerCoordinates } from '../posts/postService';

export type MapPinSelection = { id: number; own: boolean; point: ViewerCoordinates | null };

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

// タップが現在の投稿モードのピンに対する操作であることを確認し、選択情報を返す。
export function resolvePostPinTap(
  pins: readonly PostPin[], pinId: unknown, eventRevision: unknown, modeRevision: number,
): MapPinSelection | null {
  if (eventRevision !== modeRevision || !Number.isSafeInteger(pinId)) return null;
  const pin = pins.find(item => item.id === pinId);
  if (!pin) return null;
  return {
    id: pin.id,
    own: pin.isOwn === true,
    point: { latitude: pin.latitude, longitude: pin.longitude },
  };
}
