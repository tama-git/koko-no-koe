import { useRef, useState } from 'react';

import { AuthErrors, AuthMode, validateAuth } from './validation';
import * as api from './api';

/** 認証の状態と処理。画面の見た目は screens と components で管理する。 */
export function useAuth() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [registerStep, setRegisterStep] = useState<'form' | 'otp'>('form');
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
    setOtpCode('');
    setRegisterStep('form');
    setShowPassword(false);
    setErrors({});
    setMessage('');
  }

  async function handleSubmit() {
    if (busyRef.current) return;

    // 新規登録の2段階目（OTPコード確認）
    if (isRegister && registerStep === 'otp') {
      if (!otpCode || otpCode.length !== 6) {
        setMessage('6桁の確認コードを入力してください。');
        return;
      }
      busyRef.current = true;
      setBusy(true);
      setMessage('');
      try {
        await api.verifyRegisterOtp(email, otpCode);
        setMode('login');
        setRegisterStep('form');
        setOtpCode('');
        setPassword('');
        setConfirmPassword('');
        setMessage('登録が完了しました。ログインしてください。');
      } catch (error) {
        const detail = error instanceof Error ? error.message : '確認できませんでした。';
        setMessage(detail);
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
      return;
    }

    // 通常のバリデーション（ログイン、または新規登録の1段階目）
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
        await api.requestRegisterOtp(email, password);
        setRegisterStep('otp'); // コード入力画面へ遷移
        setMessage('確認コードをメールに送信しました。');
      } else {
        const newToken = await api.login(email, password);
        setToken(newToken);
        setPassword('');
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : '処理できませんでした。もう一度お試しください。';
      setMessage(detail);
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
    mode, email, password, confirmPassword, otpCode, registerStep, showPassword, errors, message, token, busy, isRegister,
    setEmail, setPassword, setConfirmPassword, setOtpCode, setShowPassword, setErrors, setMessage,
    changeMode, handleSubmit, handleLogout,
  };
}

export type AuthController = ReturnType<typeof useAuth>;