import { StatusBar } from 'expo-status-bar';
import { useRef, useState, type ComponentRef } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AuthErrors, AuthMode, validateAuth } from './src/auth/validation';
import * as api from './src/auth/api';

export default function App() {
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
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const confirmPasswordRef = useRef<ComponentRef<typeof TextInput>>(null);
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

  if (token) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.brandName}>ここの声</Text>
            <Text style={styles.title}>トップページ</Text>
            <Text style={styles.switchText}>ログインしました。ここは仮のトップページです。</Text>
            <Pressable accessibilityRole="button" disabled={busy} onPress={handleLogout} style={[styles.button, busy && styles.buttonPressed]}>
              <Text style={styles.buttonText}>{busy ? 'ログアウト中…' : 'ログアウト'}</Text>
            </Pressable>
            {message ? <Text style={styles.message} accessibilityLiveRegion="polite">{message}</Text> : null}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <Text style={styles.brandName}>ここの声</Text>
            <Text style={styles.title}>{isRegister ? '会員登録' : 'ログイン'}</Text>

            <View style={styles.card}>
              <Text style={styles.label}>メールアドレス</Text>
              <TextInput
                accessibilityLabel="メールアドレス"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                keyboardType="email-address"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                onChangeText={(value) => {
                  setEmail(value);
                  setErrors((previous) => ({ ...previous, email: undefined }));
                  setMessage('');
                }}
                placeholder="example@email.com"
                placeholderTextColor="#9AA79D"
                style={[styles.input, errors.email && styles.inputError]}
                value={email}
                editable={!busy}
              />
              {errors.email ? <Text style={styles.error} accessibilityLiveRegion="polite">{errors.email}</Text> : null}

              <Text style={styles.label}>パスワード</Text>
              <TextInput
                ref={passwordRef}
                accessibilityLabel="パスワード"
                autoCapitalize="none"
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                autoCorrect={false}
                returnKeyType={isRegister ? 'next' : 'done'}
                onSubmitEditing={() => isRegister ? confirmPasswordRef.current?.focus() : handleSubmit()}
                onChangeText={(value) => {
                  setPassword(value);
                  setErrors((previous) => ({ ...previous, password: undefined, confirmPassword: undefined }));
                  setMessage('');
                }}
                placeholder="パスワードを入力"
                placeholderTextColor="#9AA79D"
                secureTextEntry={!showPassword}
                style={[styles.input, errors.password && styles.inputError]}
                value={password}
                editable={!busy}
              />
              {isRegister ? (
                <Text style={styles.hint}>8文字以上、英大文字・英小文字・数字・記号のうち3種類以上</Text>
              ) : null}
              {errors.password ? <Text style={styles.error} accessibilityLiveRegion="polite">{errors.password}</Text> : null}

              {isRegister ? (
                <>
                  <Text style={styles.label}>パスワード（確認用）</Text>
                  <TextInput
                    ref={confirmPasswordRef}
                    accessibilityLabel="パスワード確認用"
                    autoCapitalize="none"
                    autoComplete="new-password"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={handleSubmit}
                    onChangeText={(value) => {
                      setConfirmPassword(value);
                      setErrors((previous) => ({ ...previous, confirmPassword: undefined }));
                      setMessage('');
                    }}
                    placeholder="もう一度入力"
                    placeholderTextColor="#9AA79D"
                    secureTextEntry={!showPassword}
                    style={[styles.input, errors.confirmPassword && styles.inputError]}
                    value={confirmPassword}
                    editable={!busy}
                  />
                  {errors.confirmPassword ? <Text style={styles.error} accessibilityLiveRegion="polite">{errors.confirmPassword}</Text> : null}
                </>
              ) : null}

              <Pressable
                accessibilityRole="checkbox"
                accessibilityLabel="パスワードを表示"
                accessibilityState={{ checked: showPassword }}
                disabled={busy}
                onPress={() => setShowPassword((current) => !current)}
                style={styles.checkboxRow}
              >
                <View style={[styles.checkbox, showPassword && styles.checkboxChecked]}>
                  {showPassword ? <Text style={styles.checkmark}>✓</Text> : null}
                </View>
                <Text style={styles.checkboxLabel}>パスワードを表示</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={handleSubmit}
                style={({ pressed }) => [styles.button, (pressed || busy) && styles.buttonPressed]}
              >
                <Text style={styles.buttonText}>{busy ? (isRegister ? '登録中…' : 'ログイン中…') : (isRegister ? '登録する' : 'ログイン')}</Text>
              </Pressable>
              {message ? <Text style={styles.message} accessibilityLiveRegion="polite">{message}</Text> : null}
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchText}>{isRegister ? 'すでにアカウントをお持ちですか？' : 'アカウントをお持ちでない方'}</Text>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => changeMode(isRegister ? 'login' : 'register')}
                style={styles.switchButton}
              >
                <Text style={styles.switchLink}>{isRegister ? 'ログインへ' : '会員登録へ'}</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  keyboard: { flex: 1 },
  container: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 32, paddingBottom: 32, alignItems: 'center' },
  content: { width: '100%', maxWidth: 440 },
  brandName: { color: '#1D4030', fontSize: 20, fontWeight: '700', marginBottom: 36 },
  title: { color: '#1C3D2D', fontSize: 25, fontWeight: '700', marginBottom: 12 },
  card: { backgroundColor: '#FFFFFF' },
  label: { color: '#395647', fontSize: 13, fontWeight: '600', marginTop: 16, marginBottom: 7 },
  input: { height: 50, paddingHorizontal: 14, borderWidth: 1, borderColor: '#DCE6DA', borderRadius: 10, backgroundColor: '#FBFCFA', color: '#1D4030', fontSize: 15 },
  inputError: { borderColor: '#BC6A5C' },
  hint: { color: '#7D8C80', fontSize: 11, lineHeight: 17, marginTop: 7 },
  error: { color: '#AA4B3F', fontSize: 12, lineHeight: 18, marginTop: 7 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44, marginTop: 7 },
  checkbox: { width: 20, height: 20, borderWidth: 1, borderColor: '#687A6E', borderRadius: 3, alignItems: 'center', justifyContent: 'center', marginRight: 9 },
  checkboxChecked: { backgroundColor: '#2C6049', borderColor: '#2C6049' },
  checkmark: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', lineHeight: 18 },
  checkboxLabel: { color: '#395647', fontSize: 13 },
  button: { height: 52, backgroundColor: '#2C6049', borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: 25 },
  buttonPressed: { opacity: 0.8 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  message: { color: '#705C38', backgroundColor: '#FCF6E9', overflow: 'hidden', borderRadius: 8, fontSize: 12, lineHeight: 19, marginTop: 14, padding: 12 },
  switchRow: { alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  switchText: { color: '#79887B', fontSize: 12 },
  switchButton: { paddingHorizontal: 18, paddingVertical: 10 },
  switchLink: { color: '#2C6049', fontWeight: '700', fontSize: 13 },
});
