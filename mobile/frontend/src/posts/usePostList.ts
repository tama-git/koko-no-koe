import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { loadPosts, loadPublicPosts, PostApiError } from './postService';
import type { PostPin, PostPlaceDisplay, SavedPost, ViewerCoordinates } from './postService';

export type PostListScope = 'own' | 'public';

const VISIBILITY_CHECK_INTERVAL_MS = 15000;

export function usePostList(
  token: string, scope: PostListScope, refreshKey: number, coordinates?: ViewerCoordinates, monitorVisibility = false,
) {
  const [publicPins, setPublicPins] = useState<{ pins: PostPin[]; status: 'initial' | 'verified' | 'denied' }>(
    { pins: [], status: 'initial' },
  );
  const [posts, setPosts] = useState<SavedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  const latestCoordinates = useRef(coordinates);
  const monitoringVisibility = useRef(monitorVisibility);
  const pendingPlaceChanges = useRef<Map<number, PostPlaceDisplay> | null>(null);
  const hasCoordinates = coordinates !== undefined;
  useEffect(() => { latestCoordinates.current = coordinates; }, [coordinates]);
  useEffect(() => { monitoringVisibility.current = monitorVisibility; }, [monitorVisibility]);

  useEffect(() => { setPublicPins({ pins: [], status: 'initial' }); }, [token, scope]);

  useEffect(() => {
    let active = true;
    let pending = false;
    let previous: ViewerCoordinates | undefined;
    let lastPinCheck = 0;
    setPosts([]);
    setError('');
    setLoading(true);

    const load = async (pinsOnly = false) => {
      if (pending) return;
      pending = true;
      // 保存より前に始まった一覧取得が、更新後の場所表示を上書きしないようにする。
      const placeChanges = new Map<number, PostPlaceDisplay>();
      pendingPlaceChanges.current = placeChanges;
      try {
        let loadedPosts: SavedPost[];
        if (scope === 'public') {
          lastPinCheck = Date.now();
          if (!pinsOnly) previous = latestCoordinates.current;
          const result = await loadPublicPosts(token, pinsOnly ? undefined : previous);
          if (!active) return;
          setPublicPins({ pins: result.pins, status: 'verified' });
          if (pinsOnly) {
            const ids = new Set(result.pins.map(pin => pin.id));
            setPosts(current => current.every(post => ids.has(post.id)) ? current : current.filter(post => ids.has(post.id)));
            return;
          }
          loadedPosts = result.posts;
        } else {
          loadedPosts = await loadPosts(token);
        }
        if (!active) return;
        setPosts(loadedPosts.map(post => {
          const placeDisplay = placeChanges.get(post.id);
          return placeDisplay ? { ...post, place_display: placeDisplay } : post;
        }));
        setError('');
      } catch (reason) {
        if (!active) return;
        if (scope === 'public' && reason instanceof PostApiError && (reason.status === 401 || reason.status === 403)) {
          setPublicPins({ pins: [], status: 'denied' });
          setPosts([]);
        }
        if (!pinsOnly) {
          setPosts([]);
          setError(reason instanceof Error ? reason.message : '投稿を取得できませんでした。');
        }
      } finally {
        pending = false;
        if (pendingPlaceChanges.current === placeChanges) pendingPlaceChanges.current = null;
        if (active && !pinsOnly) setLoading(false);
      }
    };
    void load();

    // 既存の測位結果を使い、移動中にAPIリクエストを重ねない。
    const timer = scope === 'public' ? setInterval(() => {
      const next = latestCoordinates.current;
      if (next && (next.latitude !== previous?.latitude || next.longitude !== previous?.longitude)) void load();
      else if (monitoringVisibility.current && AppState.currentState === 'active' &&
               Date.now() - lastPinCheck >= VISIBILITY_CHECK_INTERVAL_MS) {
        // 移動中の取得がないときは、本文を要求せず既存の公開ピンだけで閲覧状態を確認する。
        void load(true);
      }
    }, 1000) : undefined;
    return () => {
      active = false;
      if (timer !== undefined) clearInterval(timer);
    };
  }, [token, scope, refreshKey, retry, hasCoordinates]);

  const refresh = () => { if (!loading) setRetry(value => value + 1); };
  const updatePlaceDisplay = (postId: number, placeDisplay: PostPlaceDisplay) => {
    pendingPlaceChanges.current?.set(postId, placeDisplay);
    setPosts(current => current.map(post => post.id === postId ? { ...post, place_display: placeDisplay } : post));
  };
  return { posts, pins: publicPins.pins, pinStatus: publicPins.status, loading, error, refresh,
    updatePlaceDisplay, refreshing: loading && retry > 0 };
}

export type PostListState = ReturnType<typeof usePostList>;
