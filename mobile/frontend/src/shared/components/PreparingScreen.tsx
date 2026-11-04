import { StyleSheet, Text, View } from 'react-native';

/** 未接続の画面雛形で共通して使う表示。完成した画面では必要に応じて置き換える。 */
export function PreparingScreen({ title, description }: { title: string; description: string }) {
  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      <Text style={styles.message}>この画面は準備中です。</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', gap: 12 },
  title: { fontSize: 24, fontWeight: 'bold' },
  message: { fontSize: 18 },
  description: { fontSize: 15, lineHeight: 22 },
});
