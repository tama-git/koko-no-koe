// 退会画面。
// パスワード入力で本人確認し、確認 Alert を経てから退会 API を呼ぶ。
// ロジックは useDeleteAccount に分離しており、この画面は表示だけを担当する。

import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppScreen } from '../../shared/components/AppScreen';
import { useDeleteAccount } from '../useDeleteAccount';

type Props = {
  token: string;       // ログイン中のトークン（UtilityScreen 経由で渡される）
  onClose: () => void; // 戻るボタンで呼ぶ
  onDeleted: () => Promise<void>; // 退会完了後に呼ぶ（ログアウト処理に繋がる）
};

export function DeleteAccountScreen({ token, onClose, onDeleted }: Props) {
  const { password, passwordError, message, busy, setPassword, handleSubmit } = useDeleteAccount(token, () => {
    // 退会成功 → Alert を出してからログアウト処理に移る
    Alert.alert('退会完了', 'アカウントと投稿データを削除しました。', [{ text: 'OK', onPress: onDeleted }]);
  });

  // 「退会する」ボタンを押したとき：確認 Alert を出してから送信する（二段階確認）
  const confirmAndSubmit = () => {
    Alert.alert(
      '退会の確認',
      'アカウントと投稿データがすべて削除されます。この操作は取り消せません。退会しますか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: '退会する', style: 'destructive', onPress: handleSubmit },
      ],
    );
  };

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
            <Text style={styles.title}>退会</Text>
            {/* 操作の重大さを伝える注意書き */}
            <Text style={styles.warning}>退会するとアカウントと投稿データがすべて削除されます。この操作は取り消せません。</Text>

            <View style={styles.card}>
              {/* パスワード入力欄：本人確認に使う */}
              <Text style={styles.label}>パスワード</Text>
              <TextInput
                accessibilityLabel="パスワード"
                autoCapitalize="none"
                autoComplete="current-password"
                autoCorrect={false}
                onChangeText={setPassword}
                onSubmitEditing={confirmAndSubmit} // キーボードの完了ボタンでも確認 Alert を出す
                placeholder="パスワードを入力"
                placeholderTextColor="#9AA79D"
                returnKeyType="done"
                secureTextEntry
                style={[styles.input, passwordError ? styles.inputError : null]}
                value={password}
                editable={!busy}
              />
              {/* パスワード未入力・不一致のエラー */}
              {passwordError ? <Text style={styles.error} accessibilityLiveRegion="polite">{passwordError}</Text> : null}

              {/* 退会ボタン。busy 中は押せない・見た目も薄くなる */}
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={confirmAndSubmit}
                style={({ pressed }) => [styles.button, (pressed || busy) && styles.buttonPressed]}
              >
                <Text style={styles.buttonText}>{busy ? '処理中…' : '退会する'}</Text>
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
  warning: { color: '#AA4B3F', fontSize: 13, lineHeight: 20, marginBottom: 20 },
  card: { backgroundColor: '#FFFFFF' },
  label: { color: '#395647', fontSize: 13, fontWeight: '600', marginTop: 16, marginBottom: 7 },
  input: { height: 50, paddingHorizontal: 14, borderWidth: 1, borderColor: '#DCE6DA', borderRadius: 10, backgroundColor: '#FBFCFA', color: '#1D4030', fontSize: 15 },
  inputError: { borderColor: '#BC6A5C' },
  error: { color: '#AA4B3F', fontSize: 12, lineHeight: 18, marginTop: 7 },
  button: { height: 52, backgroundColor: '#C53030', borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: 25 },
  buttonPressed: { opacity: 0.8 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  message: { color: '#705C38', backgroundColor: '#FCF6E9', overflow: 'hidden', borderRadius: 8, fontSize: 12, lineHeight: 19, marginTop: 14, padding: 12 },
});
