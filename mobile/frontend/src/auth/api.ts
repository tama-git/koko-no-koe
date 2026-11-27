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

type AuthPath = 'register/start' | 'register/resend' | 'register' | 'login' | 'logout';

// 認証APIへ送信し、タイムアウト・エラー文言・成功応答の形式を確認する。
async function request(path: AuthPath, body: object, token?: string): Promise<Record<string, unknown>> {
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
    const expectedStatus = path === 'register' ? 201 : 200;
    const requiredValue = result[path === 'login' || path === 'register' ? 'token' : 'message'];
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

// 認証コードの確認や再送に必要な登録IDを、形式を確認して取り出す。
function readRegistrationId(data: Record<string, unknown>): string {
  const id = data.registration_id;
  if (typeof id !== 'string' || !/^[0-9a-f]{64}$/.test(id)) {
    throw new ApiError('サーバーの応答を確認できませんでした。');
  }
  return id;
}

// 仮登録を開始して認証コードの送信を依頼し、登録IDを返す。
export async function startRegistration(email: string, password: string): Promise<string> {
  return readRegistrationId(await request('register/start', { email: email.trim(), password }));
}

// 同じ登録IDの認証コードを再送し、応答の登録IDが一致することを確認する。
export async function resendRegistration(email: string, registrationId: string): Promise<void> {
  const data = await request('register/resend', { email: email.trim(), registration_id: registrationId });
  if (readRegistrationId(data) !== registrationId) {
    throw new ApiError('サーバーの応答を確認できませんでした。');
  }
}

// ログインや登録完了の応答から、会員用の認証トークンを取り出す。
function readToken(data: Record<string, unknown>): string {
  if (typeof data.token !== 'string' || !data.token.trim()) {
    throw new ApiError('サーバーの応答を確認できませんでした。');
  }
  return data.token;
}

// 登録IDと認証コードを送り、会員登録が完了したら認証トークンを返す。
export async function register(email: string, registrationId: string, code: string): Promise<string> {
  return readToken(await request('register', { email: email.trim(), registration_id: registrationId, code }));
}

// メールアドレスとパスワードでログインし、認証トークンを返す。
export async function login(email: string, password: string): Promise<string> {
  return readToken(await request('login', { email: email.trim(), password }));
}

// ログアウトを送り、使用中の認証トークンを無効にするよう依頼する。
export async function logout(token: string) {
  await request('logout', {}, token);
}
