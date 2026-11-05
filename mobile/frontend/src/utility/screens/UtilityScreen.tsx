import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppScreen } from '../../shared/components/AppScreen';
import { PreparingScreen } from '../../shared/components/PreparingScreen';

type Props = { onClose: () => void };

export function UtilityScreen({ onClose }: Props) {
  return (
    <AppScreen>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.backButton}>
          <Text style={styles.backText}>戻る</Text>
        </Pressable>
      </View>
      {/* ユーティリティ担当者はここをメニューの内容に置き換えます。 */}
      <PreparingScreen title="ユーティリティ" description="メニューは準備中です。" />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 12, alignItems: 'flex-start' },
  backButton: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' },
  backText: { color: '#2C6049', fontSize: 15, fontWeight: '700' },
});
