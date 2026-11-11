import { useEffect, useState } from 'react';
import { getCurrentLocation } from './getCurrentLocation';
import type { LocationResult } from './locationRequest';

export type LocationState = LocationResult | { status: 'loading' };

export function useCurrentLocation(refreshKey = 0): LocationState {
  const [state, setState] = useState<LocationState>({ status: 'loading' });
  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    void getCurrentLocation().then(result => { if (active) setState(result); });
    // 取得中に画面を閉じた場合、遅れて返った結果で画面を更新しない。
    return () => { active = false; };
  }, [refreshKey]);
  return state;
}
