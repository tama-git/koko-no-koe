import { Pressable, SafeAreaView, StyleSheet, Text } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';

type Props = { onPress: () => void; onLayout: (event: LayoutChangeEvent) => void; disabled?: boolean };

/** 入力欄に見える投稿作成の入口。実際の入力は投稿フォームで行う。 */
export function MessageInputBar({ onPress, onLayout, disabled }: Props) {
  return (
    <SafeAreaView onLayout={onLayout} style={styles.footer}>
      <Pressable accessibilityRole="button" accessibilityLabel="投稿フォームを開く"
        disabled={disabled} onPress={onPress}
        style={({ pressed }) => [styles.bar, (pressed || disabled) && styles.pressed]}>
        <Text style={styles.plus}>＋</Text>
        <Text style={styles.placeholder}>ここにメッセージを残す…</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFFFFF', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#DCE6DA' },
  bar: { minHeight: 48, marginHorizontal: 16, marginVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: '#DCE6DA', borderRadius: 24, backgroundColor: '#F4F6F4', flexDirection: 'row', alignItems: 'center', gap: 10 },
  plus: { fontSize: 24, color: '#2C6049' },
  placeholder: { flexShrink: 1, fontSize: 15, color: '#5C7A6B' },
  pressed: { opacity: 0.6 },
});
