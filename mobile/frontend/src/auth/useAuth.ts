import { useRef, useState } from 'react';

import { AuthErrors, AuthMode, validateAuth } from './validation';
import * as api from './api';

/** 認証の状態と処理。画面の見た目は screens と components で管理する。 */
export function useAuth() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [registrationId, setRegistrationId] = useState<string | null>(null);
  const [code, setCode] = useState('');
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
    if (busyRef.current) return;
    setMode(nextMode);
    setRegistrationId(null);
    setCode('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setErrors({});
    setMessage('');
  }

  async function handleSubmit() {
    if (busyRef.current) return;
    if (registrationId) {
      if (!/^[0-9]{6}$/.test(code)) {
        setMessage('認証コードを半角数字6桁で入力してください。');
        return;
      }
      await submitRegistrationCode(false);
      return;
    }
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
        setRegistrationId(await api.startRegistration(email, password));
        setMessage('認証コードを送信しました。');
      } else {
        const newToken = await api.login(email, password);
        setToken(newToken);
      }
      setPassword('');
      setConfirmPassword('');
      setShowPassword(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '処理できませんでした。もう一度お試しください。');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function submitRegistrationCode(resend: boolean) {
    if (!registrationId || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMessage('');
    try {
      if (resend) {
        await api.resendRegistration(email, registrationId);
        setCode('');
        setMessage('新しい認証コードを送信しました。');
      } else {
        await api.register(email, registrationId, code);
        setRegistrationId(null);
        setCode('');
        setMode('login');
        setMessage('登録が完了しました。ログインしてください。');
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : '処理できませんでした。もう一度お試しください。';
      setMessage(!resend && error instanceof api.ApiError && !error.status
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
    isVerifyingRegistration: registrationId !== null, code, setCode,
    resendRegistrationCode: () => submitRegistrationCode(true),
    setEmail, setPassword, setConfirmPassword, setShowPassword, setErrors, setMessage,
    changeMode, handleSubmit, handleLogout,
  };
}

export type AuthController = ReturnType<typeof useAuth>;
