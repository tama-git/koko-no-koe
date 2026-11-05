import * as Location from 'expo-location';
import { requestCurrentLocation } from './locationRequest';
import type { LocationResult } from './locationRequest';

let pending: Promise<LocationResult> | null = null;

/** アプリ利用中の許可だけを要求し、現在地を一度取得する。保存・API送信はしない。 */
export function getCurrentLocation(): Promise<LocationResult> {
  // 同時に呼ばれても、システムの許可ダイアログを重複して要求しない。
  if (!pending) {
    pending = requestCurrentLocation({
      requestPermission: () => Location.requestForegroundPermissionsAsync(),
      servicesEnabled: () => Location.hasServicesEnabledAsync(),
      getPosition: () => Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
    }).finally(() => { pending = null; });
  }
  return pending;
}
