import { useEffect, useRef, useState } from 'react';
import { loadPosts, loadPublicPosts } from './postService';
import type { PostPin, PostPlaceDisplay, SavedPost, ViewerCoordinates } from './postService';

export type PostListScope = 'own' | 'public';

export function usePostList(token: string, scope: PostListScope, refreshKey: number, coordinates?: ViewerCoordinates) {
  const [pins, setPins] = useState<PostPin[]>([]);
  const [posts, setPosts] = useState<SavedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  const latestCoordinates = useRef(coordinates);
  const pendingPlaceChanges = useRef<Map<number, PostPlaceDisplay> | null>(null);
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
      // 保存より前に始まった一覧取得が、更新後の場所表示を上書きしないようにする。
      const placeChanges = new Map<number, PostPlaceDisplay>();
      pendingPlaceChanges.current = placeChanges;
      try {
        let loadedPosts: SavedPost[];
        if (scope === 'public') {
          previous = latestCoordinates.current;
          const result = await loadPublicPosts(token, previous);
          if (!active) return;
          setPins(result.pins);
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
        if (active) {
          setPosts([]);
          setError(reason instanceof Error ? reason.message : '投稿を取得できませんでした。');
        }
      } finally {
        pending = false;
        if (pendingPlaceChanges.current === placeChanges) pendingPlaceChanges.current = null;
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
  const updatePlaceDisplay = (postId: number, placeDisplay: PostPlaceDisplay) => {
    pendingPlaceChanges.current?.set(postId, placeDisplay);
    setPosts(current => current.map(post => post.id === postId ? { ...post, place_display: placeDisplay } : post));
  };
  return { posts, pins, loading, error, refresh, updatePlaceDisplay, refreshing: loading && retry > 0 };
}

export type PostListState = ReturnType<typeof usePostList>;
