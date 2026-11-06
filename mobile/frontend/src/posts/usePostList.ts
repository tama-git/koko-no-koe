import { useEffect, useState } from 'react';
import { loadPosts, loadPublicPosts } from './postService';
import type { SavedPost } from './postService';

export type PostListScope = 'own' | 'public';

export function usePostList(token: string, scope: PostListScope, refreshKey: number) {
  const [posts, setPosts] = useState<SavedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setPosts([]);
    setError('');
    setLoading(true);
    const load = scope === 'public' ? loadPublicPosts : loadPosts;
    void load(token).then(data => {
      if (active) setPosts(data);
    }).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : '投稿を取得できませんでした。');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [token, scope, refreshKey, retry]);

  const refresh = () => { if (!loading) setRetry(value => value + 1); };
  return { posts, loading, error, refresh, refreshing: loading && retry > 0 };
}

export type PostListState = ReturnType<typeof usePostList>;
