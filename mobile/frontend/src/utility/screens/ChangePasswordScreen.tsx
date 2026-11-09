// パスワード変更画面。
// ロジックは useChangePassword に分離しており、この画面は表示だけを担当する。

import { useRef, type ComponentRef } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppScreen } from '../../shared/components/AppScreen';
import { useChangePassword } from '../useChangePassword';

type Props = {
  token: string;    // ログイン中のトークン（HomeScreen → UtilityScreen 経由で渡される）
  onClose: () => void; // 戻るボタン・変更完了後に呼ぶ
};

export function ChangePasswordScreen({ token, onClose }: Props) {
  const {
    currentPassword, newPassword, confirmPassword, errors, message, busy,
    setCurrentPassword, setNewPassword, setConfirmPassword,
    handleSubmit,
  } = useChangePassword(token, () => {
    // 変更成功 → Alert を出してから画面を閉じる
    Alert.alert('完了', 'パスワードを変更しました。', [{ text: 'OK', onPress: onClose }]);
  });

  // Enterキーで次の入力欄にフォーカスを移すための ref
  const newPasswordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const confirmPasswordRef = useRef<ComponentRef<typeof TextInput>>(null);

  return (
    <AppScreen>
      {/* 戻るボタン */}
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.backButton}>
          <Text style={styles.backText}>戻る</Text>
        </Pressable>
      </View>

      {/* キーボードが出たときに入力欄が隠れないよう KeyboardAvoidingView で包む */}
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            <Text style={styles.title}>パスワード変更</Text>

            <View style={styles.card}>
              {/* 現在のパスワード */}
              <Text style={styles.label}>現在のパスワード</Text>
              <TextInput
                accessibilityLabel="現在のパスワード"
                autoCapitalize="none"
                autoComplete="current-password"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => newPasswordRef.current?.focus()}
                onChangeText={setCurrentPassword}
                placeholder="現在のパスワードを入力"
                placeholderTextColor="#9AA79D"
                secureTextEntry
                style={[styles.input, errors.currentPassword && styles.inputError]}
                value={currentPassword}
                editable={!busy}
              />
              {errors.currentPassword ? <Text style={styles.error} accessibilityLiveRegion="polite">{errors.currentPassword}</Text> : null}

              {/* 新しいパスワード */}
              <Text style={styles.label}>新しいパスワード</Text>
              <TextInput
                ref={newPasswordRef}
                accessibilityLabel="新しいパスワード"
                autoCapitalize="none"
                autoComplete="new-password"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                onChangeText={setNewPassword}
                placeholder="新しいパスワードを入力"
                placeholderTextColor="#9AA79D"
                secureTextEntry
                style={[styles.input, errors.newPassword && styles.inputError]}
                value={newPassword}
                editable={!busy}
              />
              <Text style={styles.hint}>8文字以上、英大文字・英小文字・数字・記号のうち3種類以上</Text>
              {errors.newPassword ? <Text style={styles.error} accessibilityLiveRegion="polite">{errors.newPassword}</Text> : null}

              {/* 新しいパスワード（確認用） */}
              <Text style={styles.label}>新しいパスワード（確認用）</Text>
              <TextInput
                ref={confirmPasswordRef}
                accessibilityLabel="新しいパスワード確認用"
                autoCapitalize="none"
                autoComplete="new-password"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleSubmit} // 最後の欄で Enter を押したら送信
                onChangeText={setConfirmPassword}
                placeholder="もう一度入力"
                placeholderTextColor="#9AA79D"
                secureTextEntry
                style={[styles.input, errors.confirmPassword && styles.inputError]}
                value={confirmPassword}
                editable={!busy}
              />
              {errors.confirmPassword ? <Text style={styles.error} accessibilityLiveRegion="polite">{errors.confirmPassword}</Text> : null}

              {/* 送信ボタン。busy 中は押せない・見た目も薄くなる */}
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={handleSubmit}
                style={({ pressed }) => [styles.button, (pressed || busy) && styles.buttonPressed]}
              >
                <Text style={styles.buttonText}>{busy ? '変更中…' : '変更する'}</Text>
              </Pressable>

              {/* API エラーなどのメッセージ表示欄 */}
              {message ? <Text style={styles.message} accessibilityLiveRegion="polite">{message}</Text> : null}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 12, alignItems: 'flex-start' },
  backButton: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' },
  backText: { color: '#2C6049', fontSize: 15, fontWeight: '700' },
  keyboard: { flex: 1 },
  container: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 32, paddingBottom: 32, alignItems: 'center' },
  content: { width: '100%', maxWidth: 440 },
  title: { color: '#1C3D2D', fontSize: 25, fontWeight: '700', marginBottom: 12 },
  card: { backgroundColor: '#FFFFFF' },
  label: { color: '#395647', fontSize: 13, fontWeight: '600', marginTop: 16, marginBottom: 7 },
  input: { height: 50, paddingHorizontal: 14, borderWidth: 1, borderColor: '#DCE6DA', borderRadius: 10, backgroundColor: '#FBFCFA', color: '#1D4030', fontSize: 15 },
  inputError: { borderColor: '#BC6A5C' },
  hint: { color: '#7D8C80', fontSize: 11, lineHeight: 17, marginTop: 7 },
  error: { color: '#AA4B3F', fontSize: 12, lineHeight: 18, marginTop: 7 },
  button: { height: 52, backgroundColor: '#2C6049', borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: 25 },
  buttonPressed: { opacity: 0.8 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  message: { color: '#705C38', backgroundColor: '#FCF6E9', overflow: 'hidden', borderRadius: 8, fontSize: 12, lineHeight: 19, marginTop: 14, padding: 12 },
});
