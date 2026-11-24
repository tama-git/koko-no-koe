import type { PostListScope } from '../../posts/usePostList';

export const POST_MODE_LABELS: Record<PostListScope, string> = {
  public: '周りの声',
  own: '自分の投稿',
};

export function isHorizontalSheetSwipe(dx: number, dy: number) {
  return Math.abs(dx) >= 16 && Math.abs(dx) > Math.abs(dy) * 1.5;
}

export function getPostModeAfterSwipe(mode: PostListScope, dx: number, dy: number): PostListScope {
  if (Math.abs(dx) < 48 || !isHorizontalSheetSwipe(dx, dy)) return mode;
  return dx < 0 ? 'own' : 'public';
}
