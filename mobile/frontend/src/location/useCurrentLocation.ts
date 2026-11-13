import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import { createDisplayPositionTracker, initialDisplayPosition } from './displayPosition';
import type { DisplayPosition } from './displayPosition';
import { getCurrentLocation } from './getCurrentLocation';
import type { LocationResult } from './locationRequest';

export type LocationState = LocationResult | { status: 'loading' };
const HEADING_DEADBAND_DEGREES = 3;
const LOW_ACCURACY_DEADBAND_DEGREES = 10;

export function useCurrentLocation() {
  const [state, setState] = useState<LocationState>({ status: 'loading' });
  const [displayPosition, setDisplayPosition] = useState<DisplayPosition | null>(null);
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
      setDisplayPosition(null);
      const result = await getCurrentLocation();
      if (current !== generation) return;
      setState(result);
      if (result.status !== 'ready' && result.status !== 'timeout') return;

      const initial = result.status === 'ready' ? initialDisplayPosition(result.coordinates) : null;
      const trackDisplayPosition = createDisplayPositionTracker(initial);
      setDisplayPosition(initial);

      const clearHeading = () => { if (current === generation) setHeading(null); };
      void Location.watchHeadingAsync(({ trueHeading, magHeading, accuracy }) => {
        if (current !== generation) return;
        const degrees = Number.isFinite(trueHeading) && trueHeading >= 0 ? trueHeading : magHeading;
        if (!Number.isFinite(degrees) || degrees < 0) return;
        // 精度が低くても明確に向きを変えたときは、表示を更新する。
        const deadband = accuracy === 0 ? LOW_ACCURACY_DEADBAND_DEGREES : HEADING_DEADBAND_DEGREES;
        const normalized = degrees % 360;
        setHeading(previous => previous !== null &&
          Math.abs(((normalized - previous + 540) % 360) - 180) < deadband
          ? previous : normalized);
      }, clearHeading).then(next => {
        if (current === generation) headingSubscription = next;
        else next.remove();
      }).catch(clearHeading);

      try {
        const next = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 1, timeInterval: 1000 },
          ({ coords, timestamp }) => {
            if (current !== generation) return;
            if (!Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude) ||
                Math.abs(coords.latitude) > 90 || Math.abs(coords.longitude) > 180) return;
            const coordinates = {
              latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy,
            };
            setState({ status: 'ready', coordinates });
            setDisplayPosition(trackDisplayPosition({ ...coordinates, speed: coords.speed, timestamp }));
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
  return { location: state, displayPosition, heading };
}
