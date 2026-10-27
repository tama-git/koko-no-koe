import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function App() {
  const [tapCount, setTapCount] = useState(0);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        <Text style={styles.badge}>iPhone 表示テスト</Text>
        <Text style={styles.title}>旅日記</Text>
        <Text style={styles.subtitle}>旅の一歩を、ここから。</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>こんにちは！</Text>
          <Text style={styles.description}>
            この画面がiPhoneに表示されていれば、最初の接続は成功です。
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setTapCount((count) => count + 1)}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <Text style={styles.buttonText}>タップして確認</Text>
          </Pressable>
          <Text style={styles.result} accessibilityLiveRegion="polite">
            {tapCount === 0
              ? 'ボタンを押してみてください'
              : `タップできました！ ${tapCount}回`}
          </Text>
        </View>

        <Text style={styles.note}>
          開発用の仮画面です。{ '\n' }位置情報や写真はまだ使用しません。
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F2F6F2' },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { width: '100%', maxWidth: 440 },
  badge: { color: '#326547', fontSize: 13, fontWeight: '600', marginBottom: 20 },
  title: { color: '#18392A', fontSize: 44, fontWeight: '700', letterSpacing: 3 },
  subtitle: { color: '#526459', fontSize: 16, marginTop: 12, marginBottom: 36 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24 },
  cardTitle: { color: '#18392A', fontSize: 23, fontWeight: '700', marginBottom: 12 },
  description: { color: '#526459', fontSize: 16, lineHeight: 27, marginBottom: 28 },
  button: {
    backgroundColor: '#2E6247',
    borderRadius: 14,
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: { backgroundColor: '#204A34', opacity: 0.85 },
  buttonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
  result: { color: '#326547', textAlign: 'center', fontSize: 14, marginTop: 20, lineHeight: 22 },
  note: { color: '#65756B', fontSize: 12, lineHeight: 20, marginTop: 28, textAlign: 'center' },
});
