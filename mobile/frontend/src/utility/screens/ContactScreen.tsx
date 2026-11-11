// お問い合わせ画面。
// ロジックは useContact などに分離するか、ここでシンプルに管理できます。

import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppScreen } from '../../shared/components/AppScreen';

const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, '') ?? '';

type Props = {
  token: string;       // ログイン中のトークン（HomeScreen → UtilityScreen 経由で渡される）
  onClose: () => void; // 戻るボタン・送信完了後に呼ぶ
};

export function ContactScreen({ token, onClose }: Props) {
  const [messageText, setMessageText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!messageText.trim()) {
      setError('お問い合わせ内容を入力してください。');
      return;
    }

    if (!/^https?:\/\//i.test(apiBaseUrl)) {
      setError('サーバーの接続先が設定されていません。');
      return;
    }

    setError(null);
    setBusy(true);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${apiBaseUrl}/api/contacts/`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          message: messageText, // メッセージのみ送信（名前やメールアドレスはログイン中のユーザーからサーバー側で自動取得）
        }),
      });

      const data = await response.json().catch(() => null);

      if (response.status === 201 && Number.isInteger(data?.id)) {
        Alert.alert('完了', 'お問い合わせを送信しました。', [
          { text: 'OK', onPress: onClose }
        ]);
        setMessageText('');
      } else {
        setError(typeof data?.error === 'string' && response.status < 500
          ? data.error
          : `送信結果を確認できませんでした（HTTP ${response.status}）。`);
      }
    } catch {
      setError('サーバーに接続できませんでした。');
    } finally {
      setBusy(false);
    }
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
            <Text style={styles.title}>お問い合わせ</Text>

            <View style={styles.card}>
              <Text style={styles.hintText}>
                ログイン中のアカウント情報（メールアドレス等）に紐づけて送信されます。
              </Text>

              {/* お問い合わせ内容 */}
              <Text style={styles.label}>お問い合わせ内容</Text>
              <TextInput
                accessibilityLabel="お問い合わせ内容"
                autoCapitalize="none"
                autoCorrect={false}
                multiline
                returnKeyType="done"
                onChangeText={(text) => {
                  setMessageText(text);
                  if (error) setError(null);
                }}
                placeholder="ご意見・不具合のご報告などをご記入ください"
                placeholderTextColor="#9AA79D"
                style={[styles.input, styles.textArea, error && styles.inputError]}
                value={messageText}
                editable={!busy}
              />
              {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}

              {/* 送信ボタン */}
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={handleSubmit}
                style={({ pressed }) => [styles.button, (pressed || busy) && styles.buttonPressed]}
              >
                <Text style={styles.buttonText}>{busy ? '送信中…' : '送信する'}</Text>
              </Pressable>
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
  hintText: { color: '#7D8C80', fontSize: 13, lineHeight: 20, marginBottom: 12 },
  label: { color: '#395647', fontSize: 13, fontWeight: '600', marginTop: 16, marginBottom: 7 },
  input: { paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: '#DCE6DA', borderRadius: 10, backgroundColor: '#FBFCFA', color: '#1D4030', fontSize: 15 },
  textArea: { height: 160, textAlignVertical: 'top' },
  inputError: { borderColor: '#BC6A5C' },
  error: { color: '#AA4B3F', fontSize: 12, lineHeight: 18, marginTop: 7 },
  button: { height: 52, backgroundColor: '#2C6049', borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: 25 },
  buttonPressed: { opacity: 0.8 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
