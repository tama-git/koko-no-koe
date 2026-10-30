import { useRef, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { AppScreen } from '../../shared/components/AppScreen';
import type { AuthController } from '../useAuth';
import { styles } from '../styles';

type Props = { auth: AuthController; title: string };

/** 登録とログインで共通の入力欄。入力条件を変更する場合は validation.ts も確認する。 */
export function AuthForm({ auth, title }: Props) {
  const {
    email, password, confirmPassword, showPassword, errors, message, busy, isRegister,
    setEmail, setPassword, setConfirmPassword, setShowPassword, setErrors, setMessage,
    changeMode, handleSubmit,
  } = auth;
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const confirmPasswordRef = useRef<ComponentRef<typeof TextInput>>(null);

  return (
    <AppScreen>
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
            <Text style={styles.title}>{title}</Text>

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
    </AppScreen>
  );
}
