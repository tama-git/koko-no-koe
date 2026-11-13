// Expo起動時に .env.local の EXPO_PUBLIC_API_BASE_URL を読み込む。
const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, '') ?? '';

export class ApiError extends Error {
  public status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request(
  path: 'request-register-otp' | 'verify-register-otp' | 'login' | 'logout',
  body: object,
  token?: string
): Promise<Record<string, unknown>> {
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
    // 通信先からの値は型が保証されない。JSONとして読めてもnullや配列の場合がある。
    const invalidResponse = () => new ApiError('サーバーの応答を確認できませんでした。', response.ok ? undefined : response.status);
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw invalidResponse();
    }
    if (typeof data !== 'object' || data === null || Array.isArray(data)) throw invalidResponse();
    const result = data as Record<string, unknown>;
    if (!response.ok) {
      throw new ApiError(typeof result.error === 'string' && result.error.trim() ? result.error : 'サーバーでエラーが発生しました。', response.status);
    }
    const expectedStatus = path === 'verify-register-otp' ? 201 : 200;
    const requiredValue = result[path === 'login' ? 'token' : 'message'];
    if (response.status !== expectedStatus || typeof requiredValue !== 'string' || !requiredValue.trim()) {
      throw invalidResponse();
    }
    return result;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const message = controller.signal.aborted
      ? 'サーバーへの接続が時間切れになりました。'
      : 'サーバーに接続できません。通信環境と接続先を確認してください。';
    // 開発時は実際に読み込まれた接続先を表示する。認証情報は含めない。
    const destination = typeof __DEV__ !== 'undefined' && __DEV__
      ? `\n接続先: ${baseUrl}/api/mobile/${path}/`
      : '';
    throw new ApiError(message + destination);
  } finally {
    clearTimeout(timeout);
  }
}

export async function requestRegisterOtp(email: string, password: string) {
  await request('request-register-otp', { email: email.trim(), password });
}

export async function verifyRegisterOtp(email: string, code: string) {
  await request('verify-register-otp', { email: email.trim(), code });
}

export async function login(email: string, password: string): Promise<string> {
  const data = await request('login', { email: email.trim(), password });
  if (typeof data.token !== 'string' || !data.token) throw new ApiError('サーバーの応答を確認できませんでした。');
  return data.token;
}

export async function logout(token: string) {
  await request('logout', {}, token);
}