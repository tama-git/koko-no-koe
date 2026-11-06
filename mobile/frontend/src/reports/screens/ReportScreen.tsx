import { useRef, useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppScreen } from '../../shared/components/AppScreen';
import { REPORT_CATEGORIES, REPORT_DETAILS_LIMIT, submitReport, validateReport } from '../reportService';
import type { ReportCategory } from '../reportService';

export function ReportScreen({ postId, message, token, onClose }: {
  postId: number;
  message: string;
  token: string;
  onClose: () => void;
}) {
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [details, setDetails] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const pending = useRef(false);

  const cancel = () => {
    if (pending.current) return;
    Keyboard.dismiss();
    Alert.alert('入力内容を破棄しますか？', '破棄すると投稿詳細に戻ります。', [
      { text: '戻る', style: 'cancel' },
      { text: '破棄', style: 'destructive', onPress: onClose },
    ]);
  };

  const send = async (selected: ReportCategory) => {
    if (pending.current) return;
    pending.current = true;
    setSending(true);
    try {
      const result = await submitReport(postId, token, selected, details);
      const title = result === 'received' ? '通報を受け付けました' : 'この投稿は通報済みです';
      Alert.alert(title, undefined, [{ text: 'OK', onPress: onClose }]);
    } catch (reason) {
      Alert.alert('通報を完了できませんでした', reason instanceof Error ? reason.message : '時間をおいてもう一度お試しください。');
    } finally {
      pending.current = false;
      setSending(false);
    }
  };

  const confirm = () => {
    if (pending.current) return;
    Keyboard.dismiss();
    const inputError = validateReport(category, details);
    setError(inputError);
    if (!category || inputError) return;
    Alert.alert('この内容で通報しますか？', '入力した内容を管理者に送信します。', [
      { text: '戻る', style: 'cancel' },
      { text: '通報', onPress: () => { void send(category); } },
    ]);
  };

  return (
    <AppScreen>
      <KeyboardAvoidingView style={styles.body} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" disabled={sending} onPress={cancel} style={styles.headerButton}>
            <Text style={styles.buttonText}>キャンセル</Text>
          </Pressable>
          <Text accessibilityRole="header" style={styles.title}>通報</Text>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: sending, busy: sending }}
            disabled={sending} onPress={confirm} style={styles.headerButton}>
            <Text style={styles.buttonText}>{sending ? '送信中…' : '通報'}</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>通報する投稿</Text>
          <Text numberOfLines={3} style={styles.preview}>{message.trim() || '写真の投稿'}</Text>
          <Text style={styles.label}>通報理由のカテゴリ</Text>
          {REPORT_CATEGORIES.map(item => {
            const checked = category === item.value;
            return (
              <Pressable key={item.value} accessibilityRole="radio" accessibilityState={{ checked, disabled: sending }}
                disabled={sending} style={[styles.choice, checked && styles.checkedChoice]}
                onPress={() => { setCategory(item.value); setError(''); }}>
                <Text style={styles.choiceText}>{checked ? '◉' : '○'}  {item.label}</Text>
              </Pressable>
            );
          })}
          <Text style={styles.label}>自由記述（{category === 'other' ? '必須' : '任意'}）</Text>
          <TextInput accessibilityLabel="自由記述" style={styles.input} multiline editable={!sending}
            placeholder="理由の補足を入力" value={details} onChangeText={value => { setDetails(value); setError(''); }} />
          <Text style={styles.counter}>{Array.from(details.trim()).length} / {REPORT_DETAILS_LIMIT}文字</Text>
          {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#DCE6DA',
  },
  headerButton: { minHeight: 48, minWidth: 72, paddingHorizontal: 6, justifyContent: 'center' },
  buttonText: { textAlign: 'center', color: '#2C6049', fontSize: 15, fontWeight: '700' },
  title: { fontSize: 18, color: '#1D4030', fontWeight: '700' },
  content: { padding: 20 },
  label: { fontSize: 16, fontWeight: '700', color: '#1D4030', marginBottom: 8 },
  preview: { backgroundColor: '#F3F7F4', color: '#1D4030', padding: 12, borderRadius: 8, marginBottom: 20 },
  choice: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, marginBottom: 6, borderRadius: 8, borderWidth: 1, borderColor: '#DCE6DA' },
  checkedChoice: { backgroundColor: '#EAF3EC', borderColor: '#2C6049' },
  choiceText: { fontSize: 15, color: '#1D4030' },
  input: { minHeight: 100, padding: 12, fontSize: 16, borderRadius: 8, borderWidth: 1, borderColor: '#AABAAE', textAlignVertical: 'top' },
  counter: { textAlign: 'right', marginTop: 6, color: '#55685E' },
  error: { color: '#A82B25', marginTop: 12 },
});
