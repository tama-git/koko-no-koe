// Expo起動時に .env.local の EXPO_PUBLIC_API_BASE_URL を読み込む。
const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, '') ?? '';

export class ApiError extends Error {
  constructor(message: string, public status?: number) { super(message); }
}

async function request(path: string, body: object, token?: string): Promise<Record<string, unknown>> {
  if (!baseUrl || !/^https?:\/\//i.test(baseUrl)) {
    throw new ApiError('接続先が設定されていません。開発者に確認してください。');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${baseUrl}/api/mobile/${path}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new ApiError(typeof data.error === 'string' ? data.error : 'サーバーでエラーが発生しました。', response.status);
    }
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('サーバーに接続できません。通信環境と接続先を確認してください。');
  } finally {
    clearTimeout(timeout);
  }
}

export async function register(email: string, password: string) {
  await request('register', { email: email.trim(), password });
}

export async function login(email: string, password: string): Promise<string> {
  const data = await request('login', { email: email.trim(), password });
  if (typeof data.token !== 'string' || !data.token) throw new ApiError('サーバーの応答を確認できませんでした。');
  return data.token;
}

export async function logout(token: string) {
  await request('logout', {}, token);
}
