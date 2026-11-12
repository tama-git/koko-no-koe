import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import { getCurrentLocation } from './getCurrentLocation';
import type { LocationResult } from './locationRequest';

export type LocationState = LocationResult | { status: 'loading' };

export function useCurrentLocation() {
  const [state, setState] = useState<LocationState>({ status: 'loading' });
  const [heading, setHeading] = useState<number | null>(null);
  useEffect(() => {
    let generation = 0;
    let subscription: Location.LocationSubscription | undefined;
    let headingSubscription: Location.LocationSubscription | undefined;
    const stop = () => {
      generation += 1;
      subscription?.remove();
      subscription = undefined;
      headingSubscription?.remove();
      headingSubscription = undefined;
    };
    const start = async () => {
      stop();
      const current = generation;
      setState({ status: 'loading' });
      setHeading(null);
      const result = await getCurrentLocation();
      if (current !== generation) return;
      setState(result);
      if (result.status !== 'ready' && result.status !== 'timeout') return;

      const clearHeading = () => { if (current === generation) setHeading(null); };
      void Location.watchHeadingAsync(({ trueHeading, magHeading, accuracy }) => {
        if (current !== generation) return;
        const degrees = trueHeading >= 0 ? trueHeading : magHeading;
        if (!Number.isFinite(degrees) || degrees < 0 || accuracy === 0) {
          clearHeading();
          return;
        }
        const normalized = degrees % 360;
        setHeading(previous => previous !== null &&
          Math.abs(((normalized - previous + 540) % 360) - 180) < 5 ? previous : normalized);
      }, clearHeading).then(next => {
        if (current === generation) headingSubscription = next;
        else next.remove();
      }).catch(clearHeading);

      try {
        const next = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 5, timeInterval: 2000 },
          ({ coords }) => {
            if (current !== generation) return;
            if (!Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude) ||
                Math.abs(coords.latitude) > 90 || Math.abs(coords.longitude) > 180) return;
            setState({ status: 'ready', coordinates: {
              latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy,
            } });
          },
          () => { if (current === generation) setState({ status: 'error' }); },
        );
        if (current === generation) subscription = next;
        else next.remove();
      } catch {
        if (current === generation) setState({ status: 'error' });
      }
    };
    // 許可ダイアログによる一時的な inactive では再取得しない。
    let inBackground = AppState.currentState === 'background';
    const appState = AppState.addEventListener('change', state => {
      if (state === 'background') {
        inBackground = true;
        stop();
      } else if (state === 'active' && inBackground) {
        inBackground = false;
        void start();
      }
    });
    if (!inBackground) void start();
    return () => {
      appState.remove();
      stop();
    };
  }, []);
  return { location: state, heading };
}
