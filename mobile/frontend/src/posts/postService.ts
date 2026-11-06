const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, '') ?? '';

export type SavedPost = {
  id: number;
  message: string;
  image: string | null;
  latitude: number | null;
  longitude: number | null;
  is_published: boolean | null;
  is_admin_hidden?: boolean;
  created_at: string;
  can_report?: boolean;
};

export class PostApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) { super(message); this.status = status; }
}

function getApiUrl(): string {
  if (!baseUrl || !/^https?:\/\//i.test(baseUrl)) throw new PostApiError('接続先が設定されていません。開発者に確認してください。');
  return `${baseUrl}/api/posts/`;
}

function errorMessage(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return errorMessage(value[0]);
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) {
      const message = errorMessage(item);
      if (message) return message;
    }
  }
  return null;
}

const unconfirmedResult = {
  GET: undefined,
  POST: '送信結果を確認できませんでした。再送する前に、自分の投稿一覧を確認してください。',
  PATCH: '変更結果を確認できませんでした。公開設定を再取得して確認してください。',
  DELETE: '削除結果を確認できませんでした。一覧を更新するか、もう一度お試しください。',
};

async function request(path: string, token: string, options: {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: FormData | string;
} = {}): Promise<unknown> {
  const { method = 'GET', body } = options;
  const resultMessage = unconfirmedResult[method];
  const url = getApiUrl() + path;
  if (!token) throw new PostApiError('ログインし直してください。', 401);
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (typeof body === 'string') headers['Content-Type'] = 'application/json';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal,
    });
    if (method === 'DELETE' && response.status === 204) return;
    let data: unknown;
    try { data = await response.json(); }
    catch {
      const message = method === 'PATCH'
        ? `変更APIからJSON形式の応答がありませんでした（HTTP ${response.status}）。代表PCのDjangoが最新版で起動しているか確認してください。`
        : resultMessage ?? 'サーバーの応答を確認できませんでした。';
      throw new PostApiError(message, response.status);
    }
    if (!response.ok) throw new PostApiError(errorMessage(data) || '投稿の処理に失敗しました。', response.status);
    if (method === 'DELETE') throw new PostApiError(unconfirmedResult.DELETE, response.status);
    if (response.status !== (method === 'POST' ? 201 : 200)) throw new PostApiError('サーバーの応答を確認できませんでした。');
    return data;
  } catch (error) {
    if (error instanceof PostApiError) throw error;
    if (method === 'PATCH') {
      throw new PostApiError(controller.signal.aborted
        ? '公開設定の変更が時間切れになりました。変更済みの可能性があるため、再取得した設定を確認してください。'
        : '公開設定の変更中に通信が途切れました。Djangoの起動・接続先・Wi-Fiを確認し、再取得した設定を確認してください。');
    }
    throw new PostApiError(resultMessage ?? '投稿を取得できませんでした。通信環境を確認してください。');
  } finally { clearTimeout(timer); }
}

function isSavedCoordinate(value: unknown, limit: number): boolean {
  return value === null || (typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit);
}

function parsePost(value: unknown): SavedPost {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PostApiError('投稿データを確認できませんでした。');
  const p = value as Record<string, unknown>;
  if (!Number.isInteger(p.id) || (p.id as number) <= 0 || typeof p.message !== 'string' ||
      !(p.image === null || typeof p.image === 'string') ||
      !isSavedCoordinate(p.latitude, 90) || !isSavedCoordinate(p.longitude, 180) ||
      !(p.is_published === null || typeof p.is_published === 'boolean') || typeof p.created_at !== 'string') {
    throw new PostApiError('投稿データを確認できませんでした。');
  }
  // 認証ヘッダーを送る画像の取得先は、設定した自分のAPIだけに限定する。
  return { ...p, image: p.image ? `${getApiUrl()}${p.id}/image/` : null } as SavedPost;
}

async function loadPostList(path: string, token: string): Promise<SavedPost[]> {
  const data = await request(path, token);
  if (!Array.isArray(data)) throw new PostApiError('投稿一覧を確認できませんでした。');
  return data.map(parsePost);
}

export function loadPosts(token: string): Promise<SavedPost[]> {
  return loadPostList('', token);
}

export function loadPublicPosts(token: string): Promise<SavedPost[]> {
  return loadPostList('public/', token);
}

export type NewPost = {
  message?: string;
  latitude: number;
  longitude: number;
  image?: string | null;
  imageMimeType?: string;
  imageFileName?: string;
  is_published: boolean;
};

export async function createPost(postData: NewPost, token: string): Promise<SavedPost> {
  if (!postData.message?.trim() && !postData.image) throw new PostApiError('メッセージまたは写真を入力してください。');
  
  const formData = new FormData();
  formData.append('latitude', postData.latitude.toFixed(7));
  formData.append('longitude', postData.longitude.toFixed(7));
  formData.append('is_published', String(postData.is_published));
  formData.append('message', postData.message?.trim() || '');

  // 画像がある場合は、Expo/React Nativeのfetchで扱えるBlob形式に変換して追加する
  if (postData.image) {
    try {
      const response = await fetch(postData.image);
      const blob = await response.blob();
      const fileName = postData.imageFileName || (postData.imageMimeType === 'image/png' ? 'photo.png' : 'photo.jpg');
      
      formData.append('image', blob, fileName);
    } catch {
      throw new PostApiError('画像ファイルの処理に失敗しました。');
    }
  }

  const result = await request('', token, { method: 'POST', body: formData });
  try { return parsePost(result); }
  catch { throw new PostApiError('送信結果を確認できませんでした。再送する前に、自分の投稿一覧を確認してください。'); }
}

function postPath(postId: number): string {
  if (!Number.isInteger(postId) || postId <= 0) throw new PostApiError('投稿IDを確認してください。');
  return `${postId}/`;
}

export async function getPostById(postId: number, token: string): Promise<SavedPost> {
  return parsePost(await request(postPath(postId), token));
}

export async function updatePostVisibility(postId: number, token: string, isPublished: boolean): Promise<void> {
  const result = await request(`${postPath(postId)}visibility/`, token, {
    method: 'PATCH',
    body: JSON.stringify({ is_published: isPublished }),
  });
  if ((result as { is_published?: unknown } | null)?.is_published !== isPublished) {
    throw new PostApiError('変更APIの応答が選択した公開設定と一致しませんでした。再取得した設定を確認してください。');
  }
}

export async function deletePost(postId: number, token: string): Promise<void> {
  await request(postPath(postId), token, { method: 'DELETE' });
}

// 非表示
export async function hidePostApi(postId: number, token: string): Promise<void> {
  await request(`${postPath(postId)}hidden/`, token, { method: 'POST' });
}
