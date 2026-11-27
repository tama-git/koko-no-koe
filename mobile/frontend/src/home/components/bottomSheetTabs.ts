import type { PostListScope } from '../../posts/usePostList';

export const POST_MODE_LABELS: Record<PostListScope, string> = {
  public: '周りの声',
  own: '自分の投稿',
};

// 移動量と向きから、一覧を切り替える横スワイプかを判定する。
export function isHorizontalSheetSwipe(dx: number, dy: number) {
  return Math.abs(dx) >= 16 && Math.abs(dx) > Math.abs(dy) * 1.5;
}

// 一定以上スワイプしたとき、左右の向きから切り替え先の一覧を選ぶ。
export function getPostModeAfterSwipe(mode: PostListScope, dx: number, dy: number): PostListScope {
  if (Math.abs(dx) < 48 || !isHorizontalSheetSwipe(dx, dy)) return mode;
  return dx < 0 ? 'own' : 'public';
}
