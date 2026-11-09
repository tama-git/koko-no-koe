// 退会画面の状態・バリデーション・送信処理をまとめたカスタムフック。
// 画面の見た目は DeleteAccountScreen.tsx で管理する。

import { useRef, useState } from 'react';
import { ApiError } from '../auth/api';
import { deleteAccount } from './api';

// token: ログイン中のトークン（UtilityScreen 経由で渡される）
// onSuccess: 退会成功後に呼ぶコールバック（Alert → ログアウト処理に移る）
export function useDeleteAccount(token: string, onSuccess: () => void) {
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState(''); // 入力欄の下に表示するエラー
  const [message, setMessage] = useState('');             // 画面下部に表示する API エラー
  const [busy, setBusy] = useState(false);                // 送信中フラグ（ボタン無効化に使う）
  // busy の ref 版：非同期処理中の二重送信を防ぐ
  const busyRef = useRef(false);

  async function handleSubmit() {
    if (busyRef.current) return;

    // クライアント側バリデーション：パスワード未入力チェック
    if (!password) {
      setPasswordError('パスワードを入力してください。');
      return;
    }
    setPasswordError('');
    busyRef.current = true;
    setBusy(true);
    setMessage('');
    try {
      await deleteAccount(token, password);
      onSuccess();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '処理できませんでした。もう一度お試しください。');
      // 401 はサーバーが「パスワードが違う」と判断した場合
      if (error instanceof ApiError && error.status === 401) {
        setPasswordError('パスワードが正しくありません。');
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return { password, passwordError, message, busy, setPassword, handleSubmit };
}
