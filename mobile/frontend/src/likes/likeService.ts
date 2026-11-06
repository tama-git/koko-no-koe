const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, '') ?? '';

// 使用できるリアクションの一覧。
// '.' は「リアクションなし」を表す内部値で、画面には表示しない。
export const REACTION_EMOJIS = ['.', '❤️', '👍', '😭', '😮', '😆'] as const;
export type ReactionEmoji = typeof REACTION_EMOJIS[number];

export type ReactionState = {
  /** 絵文字ごとのリアクション数 */
  counts: Record<ReactionEmoji, number>;
  /** ログイン中の会員が選んだ絵文字。未リアクションの場合は null。 */
  my_reaction: ReactionEmoji | null;
};

/** リアクションAPIのエラークラス。HTTPステータスコードを保持する。 */
export class LikeApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) { super(message); this.status = status; }
}

/** リアクションAPIのURLを組み立てる。接続先が未設定の場合はエラーを投げる。 */
function getReactionUrl(postId: number): string {
  if (!baseUrl || !/^https?:\/\//i.test(baseUrl)) throw new LikeApiError('接続先が設定されていません。');
  return `${baseUrl}/api/posts/${postId}/reactions/`;
}

/** リアクションAPIへの共通リクエスト処理。タイムアウトは15秒。 */
async function reactionRequest(url: string, token: string, options: RequestInit = {}): Promise<Response> {
  if (!token) throw new LikeApiError('ログインし直してください。', 401);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    return await fetch(url, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers },
      signal: controller.signal,
    });
  } catch {
    throw new LikeApiError('通信エラーが発生しました。');
  } finally {
    clearTimeout(timer);
  }
}

/** 投稿のリアクション一覧（カウントと自分のリアクション）を取得する。 */
export async function getReactions(postId: number, token: string): Promise<ReactionState> {
  const res = await reactionRequest(getReactionUrl(postId), token);
  if (!res.ok) throw new LikeApiError('リアクションを取得できませんでした。', res.status);
  const data = await res.json() as ReactionState;
  return data;
}

/** 投稿にリアクションを送信する。すでにリアクション済みの場合はエラーを投げる。 */
export async function sendReaction(postId: number, emoji: ReactionEmoji, token: string): Promise<void> {
  const res = await reactionRequest(getReactionUrl(postId), token, {
    method: 'POST',
    body: JSON.stringify({ emoji }),
  });
  if (res.status === 409) throw new LikeApiError('すでにリアクション済みです。', 409);
  if (!res.ok) throw new LikeApiError('リアクションを送信できませんでした。', res.status);
}

/** 自分のリアクションを取り消す。サーバー側に存在しない場合（404）は無視する。 */
export async function deleteReaction(postId: number, token: string): Promise<void> {
  const res = await reactionRequest(getReactionUrl(postId), token, { method: 'DELETE' });
  if (!res.ok && res.status !== 404) throw new LikeApiError('リアクションを取り消せませんでした。', res.status);
}

/** @deprecated loadLikedPostsは未実装です。 */
export async function loadLikedPosts(): Promise<never> {
  throw new LikeApiError('いいねした投稿の取得はまだ実装されていません。');
}
