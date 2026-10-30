import { useRef, useState } from 'react';

import { AuthErrors, AuthMode, validateAuth } from './validation';
import * as api from './api';

/** 認証の状態と処理。画面の見た目は screens と components で管理する。 */
export function useAuth() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<AuthErrors>({});
  const [message, setMessage] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const isRegister = mode === 'register';

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setErrors({});
    setMessage('');
  }

  async function handleSubmit() {
    if (busyRef.current) return;
    const nextErrors = validateAuth({ email, password, confirmPassword }, mode);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setMessage('');
      return;
    }

    busyRef.current = true;
    setBusy(true);
    setMessage('');
    try {
      if (isRegister) {
        await api.register(email, password);
        setMode('login');
        setMessage('登録が完了しました。ログインしてください。');
      } else {
        const newToken = await api.login(email, password);
        setToken(newToken);
      }
      setPassword('');
      setConfirmPassword('');
      setShowPassword(false);
    } catch (error) {
      const detail = error instanceof Error ? error.message : '処理できませんでした。もう一度お試しください。';
      setMessage(isRegister && error instanceof api.ApiError && !error.status
        ? `${detail} 登録が完了している場合もあるため、ログインもお試しください。` : detail);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function handleLogout() {
    if (!token || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMessage('');
    try {
      await api.logout(token);
      setToken(null);
      setMessage('ログアウトしました。');
    } catch (error) {
      if (error instanceof api.ApiError && error.status === 401) {
        setToken(null);
        setMessage('ログインの有効期限が切れました。');
      } else {
        setMessage(error instanceof Error ? error.message : 'ログアウトできませんでした。');
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return {
    mode, email, password, confirmPassword, showPassword, errors, message, token, busy, isRegister,
    setEmail, setPassword, setConfirmPassword, setShowPassword, setErrors, setMessage,
    changeMode, handleSubmit, handleLogout,
  };
}

export type AuthController = ReturnType<typeof useAuth>;
