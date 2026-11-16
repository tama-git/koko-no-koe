import { useEffect, useRef, useState } from 'react';
import { loadPosts, loadPublicPosts } from './postService';
import type { PostPin, SavedPost, ViewerCoordinates } from './postService';

export type PostListScope = 'own' | 'public';

export function usePostList(token: string, scope: PostListScope, refreshKey: number, coordinates?: ViewerCoordinates) {
  const [pins, setPins] = useState<PostPin[]>([]);
  const [posts, setPosts] = useState<SavedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  const latestCoordinates = useRef(coordinates);
  const hasCoordinates = coordinates !== undefined;
  useEffect(() => { latestCoordinates.current = coordinates; }, [coordinates]);

  useEffect(() => { setPins([]); }, [token, scope, refreshKey, retry]);

  useEffect(() => {
    let active = true;
    let pending = false;
    let previous: ViewerCoordinates | undefined;
    setPosts([]);
    setError('');
    setLoading(true);

    const load = async () => {
      if (pending) return;
      pending = true;
      try {
        if (scope === 'public') {
          previous = latestCoordinates.current;
          const result = await loadPublicPosts(token, previous);
          if (!active) return;
          setPins(result.pins);
          setPosts(result.posts);
        } else {
          const result = await loadPosts(token);
          if (active) setPosts(result);
        }
        if (active) setError('');
      } catch (reason) {
        if (active) {
          setPosts([]);
          setError(reason instanceof Error ? reason.message : '投稿を取得できませんでした。');
        }
      } finally {
        pending = false;
        if (active) setLoading(false);
      }
    };
    void load();

    // 既存の測位結果を使い、移動中にAPIリクエストを重ねない。
    const timer = scope === 'public' && hasCoordinates ? setInterval(() => {
      const next = latestCoordinates.current;
      if (next && (next.latitude !== previous?.latitude || next.longitude !== previous?.longitude)) void load();
    }, 1000) : undefined;
    return () => {
      active = false;
      if (timer !== undefined) clearInterval(timer);
    };
  }, [token, scope, refreshKey, retry, hasCoordinates]);

  const refresh = () => { if (!loading) setRetry(value => value + 1); };
  return { posts, pins, loading, error, refresh, refreshing: loading && retry > 0 };
}

export type PostListState = ReturnType<typeof usePostList>;
