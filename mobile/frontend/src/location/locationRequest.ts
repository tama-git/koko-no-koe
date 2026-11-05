export type Coordinates = { latitude: number; longitude: number; accuracy: number | null };
export type LocationResult =
  | { status: 'ready'; coordinates: Coordinates }
  | { status: 'denied'; canAskAgain: boolean }
  | { status: 'disabled' | 'timeout' | 'error' };

/** 端末APIとの境界。自動テストでは実際の位置情報を取得せず差し替える。 */
export type LocationClient = {
  requestPermission: () => Promise<{ granted: boolean; canAskAgain: boolean }>;
  servicesEnabled: () => Promise<boolean>;
  getPosition: () => Promise<{ coords: Coordinates }>;
};

export async function requestCurrentLocation(client: LocationClient, timeoutMs = 15000): Promise<LocationResult> {
  try {
    const permission = await client.requestPermission();
    if (!permission.granted) return { status: 'denied', canAskAgain: permission.canAskAgain };

    // 許可ダイアログの回答待ち時間は制限せず、許可後の取得だけ待ち時間を制限する。
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        (async (): Promise<LocationResult> => {
          if (!await client.servicesEnabled()) return { status: 'disabled' };
          const { coords } = await client.getPosition();
          if (!Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude) ||
              Math.abs(coords.latitude) > 90 || Math.abs(coords.longitude) > 180) {
            return { status: 'error' };
          }
          return { status: 'ready', coordinates: {
            latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy,
          } };
        })(),
        new Promise<LocationResult>(resolve => { timer = setTimeout(() => resolve({ status: 'timeout' }), timeoutMs); }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  } catch {
    // 端末由来の例外や位置情報そのものはログに出さない。
    return { status: 'error' };
  }
}
