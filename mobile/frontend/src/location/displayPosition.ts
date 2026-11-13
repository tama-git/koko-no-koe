import { distanceMeters } from '../map/filterNearbyPosts';
import type { Coordinates } from './locationRequest';

export type DisplayPosition = Pick<Coordinates, 'latitude' | 'longitude'> & { durationMs: number };

type PositionSample = Coordinates & { speed: number | null; timestamp: number };

function distance(a: Coordinates | DisplayPosition, b: Coordinates | DisplayPosition) {
  return distanceMeters(a.latitude, a.longitude, b.latitude, b.longitude);
}

export function initialDisplayPosition({ latitude, longitude }: Coordinates): DisplayPosition {
  return { latitude, longitude, durationMs: 0 };
}

/** 表示専用。投稿の閲覧判定には端末から取得した座標をそのまま使う。 */
export function createDisplayPositionTracker(initial: DisplayPosition | null) {
  let displayed = initial;
  let previous: PositionSample | null = null;
  let candidate: PositionSample | null = null;
  let moving = false;

  return (sample: PositionSample): DisplayPosition => {
    const { latitude, longitude, timestamp, accuracy, speed } = sample;
    if (!displayed) {
      previous = Number.isFinite(timestamp) ? sample : null;
      return displayed = initialDisplayPosition(sample);
    }

    if (!Number.isFinite(timestamp) || (previous && timestamp <= previous.timestamp)) return displayed;
    const intervalMs = previous ? timestamp - previous.timestamp : 1000;
    previous = sample;

    const uncertainty = accuracy !== null && Number.isFinite(accuracy) && accuracy > 0 ? accuracy : 10;
    const stationaryRadius = Math.min(6, Math.max(2, uncertainty * 0.35));
    const displacement = distance(displayed, sample);
    const recentCandidate = candidate && timestamp - candidate.timestamp <= 6000 ? candidate : null;
    const candidateStep = recentCandidate ? distance(recentCandidate, sample) : 0;
    const continuesOutward = recentCandidate !== null && candidateStep >= 0.8 &&
      displacement >= distance(displayed, recentCandidate) + candidateStep * 0.6;
    const validSpeed = speed !== null && Number.isFinite(speed) && speed >= 0 ? speed : null;
    const walkingSpeed = validSpeed !== null && validSpeed >= 0.65;
    const recentlyMoving = moving && (validSpeed === null || validSpeed >= 0.35);
    const poorAccuracy = uncertainty > 25;
    const suddenJump = displacement > Math.max(12, intervalMs / 1000 * 8);
    const sameArea = candidateStep <= Math.min(displacement, 12, Math.max(4, uncertainty * 0.35));
    const corroborated = recentCandidate !== null && distance(displayed, recentCandidate) >= stationaryRadius && sameArea;

    // 低精度の大きな移動は、次の測位も同じ付近に来た場合に反映する。
    const shouldMove = poorAccuracy || suddenJump
      ? displacement >= stationaryRadius && corroborated
      : (walkingSpeed && displacement >= 1) ||
        (continuesOutward && displacement >= (recentlyMoving ? 1 : stationaryRadius)) ||
        (displacement >= stationaryRadius && corroborated);

    if (!shouldMove) {
      moving = recentlyMoving && (walkingSpeed || continuesOutward);
      candidate = displacement >= 0.8 ? sample : null;
      return displayed;
    }

    moving = !poorAccuracy && (walkingSpeed || continuesOutward);
    // 短い間隔では補間も短くし、古い測位へ向かう時間を抑える。
    const durationMs = Math.round(Math.max(120, Math.min(450, intervalMs * 0.65, 180 + displacement * 45)));
    candidate = sample;
    displayed = { latitude, longitude, durationMs };
    return displayed;
  };
}
