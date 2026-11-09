// utility フォルダ専用の API 呼び出し。
// auth/api.ts の request() は register/login/logout 専用のため、
// utility 側の処理はここに独立して追加していく。

import { ApiError } from '../auth/api';

// .env.local の EXPO_PUBLIC_API_BASE_URL を読み込む（末尾スラッシュは除去）
const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, '') ?? '';

// 退会 API。成功時は何も返さない。
// パスワードが一致しない場合はサーバーが 401 を返す。
// 失敗時は ApiError を throw する（呼び出し元の useDeleteAccount で catch する）。
export async function deleteAccount(token: string, password: string): Promise<void> {
  if (!baseUrl || !/^https?:\/\//i.test(baseUrl)) {
    throw new ApiError('接続先が設定されていません。開発者に確認してください。');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${baseUrl}/api/mobile/delete-account/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ password }),
      signal: controller.signal,
    });
    // レスポンスボディは読めない場合もあるので try で囲む
    let data: unknown;
    try { data = await response.json(); } catch { /* ignore */ }
    if (!response.ok) {
      // サーバーが { error: "..." } を返していればそのメッセージを使う
      const msg = typeof data === 'object' && data !== null && 'error' in data && typeof (data as Record<string, unknown>).error === 'string'
        ? (data as Record<string, string>).error
        : 'サーバーでエラーが発生しました。';
      throw new ApiError(msg, response.status);
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    // fetch 自体が失敗した場合（オフライン・タイムアウトなど）
    throw new ApiError('サーバーに接続できません。通信環境と接続先を確認してください。');
  } finally {
    clearTimeout(timeout);
  }
}

// パスワード変更 API。成功時は何も返さない。
// 失敗時は ApiError を throw する（呼び出し元の useChangePassword で catch する）。
export async function changePassword(token: string, currentPassword: string, newPassword: string): Promise<void> {
  if (!baseUrl || !/^https?:\/\//i.test(baseUrl)) {
    throw new ApiError('接続先が設定されていません。開発者に確認してください。');
  }
  // 15秒でタイムアウト
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${baseUrl}/api/mobile/change-password/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      signal: controller.signal,
    });
    // レスポンスボディは読めない場合もあるので try で囲む
    let data: unknown;
    try { data = await response.json(); } catch { /* ignore */ }
    if (!response.ok) {
      // サーバーが { error: "..." } を返していればそのメッセージを使う
      const msg = typeof data === 'object' && data !== null && 'error' in data && typeof (data as Record<string, unknown>).error === 'string'
        ? (data as Record<string, string>).error
        : 'サーバーでエラーが発生しました。';
      throw new ApiError(msg, response.status);
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    // fetch 自体が失敗した場合（オフライン・タイムアウトなど）
    throw new ApiError('サーバーに接続できません。通信環境と接続先を確認してください。');
  } finally {
    clearTimeout(timeout);
  }
}
