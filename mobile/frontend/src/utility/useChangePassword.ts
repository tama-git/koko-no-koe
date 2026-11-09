// パスワード変更画面の状態・バリデーション・送信処理をまとめたカスタムフック。

import { useRef, useState } from 'react';
import { ApiError } from '../auth/api';
import { changePassword } from './api';

// 各入力欄のエラーメッセージ型
type Errors = Partial<Record<'currentPassword' | 'newPassword' | 'confirmPassword', string>>;

// 送信前のクライアント側バリデーション。
// パスワード強度の条件は auth/validation.ts の register と同じにする。
function validate(current: string, next: string, confirm: string): Errors {
  const errors: Errors = {};
  if (!current) errors.currentPassword = '現在のパスワードを入力してください。';
  if (!next) {
    errors.newPassword = '新しいパスワードを入力してください。';
  } else {
    // 英大文字・英小文字・数字・記号の何種類使っているか数える
    const kinds = [/[A-Z]/, /[a-z]/, /[0-9]/, /[\x21-\x2F\x3A-\x40\x5B-\x60\x7B-\x7E]/]
      .filter((p) => p.test(next)).length;
    if ([...next].length < 8 || kinds < 3) {
      errors.newPassword = '8文字以上で、英大文字・英小文字・数字・記号のうち3種類以上を使ってください。';
    }
  }
  if (!confirm) {
    errors.confirmPassword = '確認用パスワードを入力してください。';
  } else if (next !== confirm) {
    errors.confirmPassword = 'パスワードが一致しません。';
  }
  return errors;
}

// token: HomeScreen から受け取ったログイン中のトークン
// onSuccess: 変更成功後に呼ぶコールバック（Alert → 画面を閉じる）
export function useChangePassword(token: string, onSuccess: () => void) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState(''); // 画面下部に表示するエラーメッセージ
  const [busy, setBusy] = useState(false);    // 送信中フラグ（ボタン無効化に使う）
  // busy の ref 版：非同期処理中の二重送信を防ぐ
  const busyRef = useRef(false);

  async function handleSubmit() {
    if (busyRef.current) return;
    // まずクライアント側でバリデーション
    const nextErrors = validate(currentPassword, newPassword, confirmPassword);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    busyRef.current = true;
    setBusy(true);
    setMessage('');
    try {
      await changePassword(token, currentPassword, newPassword);
      onSuccess();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '処理できませんでした。もう一度お試しください。');
      // 401 はサーバーが「現在のパスワードが違う」と判断した場合
      if (error instanceof ApiError && error.status === 401) {
        setErrors({ currentPassword: '現在のパスワードが正しくありません。' });
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return {
    currentPassword, newPassword, confirmPassword, errors, message, busy,
    setCurrentPassword, setNewPassword, setConfirmPassword,
    handleSubmit,
  };
}
