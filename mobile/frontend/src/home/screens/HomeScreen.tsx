import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '../../shared/components/AppScreen';

type Props = {
  busy: boolean;
  message: string;
  onLogout: () => Promise<void>;
};

/** トップ画面担当の編集場所。ログアウトの処理は認証担当に渡す。 */
export function HomeScreen({ busy, message, onLogout }: Props) {
  return (
    <AppScreen>
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.brandName}>ここの声</Text>
          <Text style={styles.title}>トップページ</Text>
          <Text style={styles.description}>ログインしました。ここは仮のトップページです。</Text>
          <Pressable accessibilityRole="button" disabled={busy} onPress={onLogout} style={[styles.button, busy && styles.buttonPressed]}>
            <Text style={styles.buttonText}>{busy ? 'ログアウト中…' : 'ログアウト'}</Text>
          </Pressable>
          {message ? <Text style={styles.message} accessibilityLiveRegion="polite">{message}</Text> : null}
        </View>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 32, paddingBottom: 32, alignItems: 'center' },
  content: { width: '100%', maxWidth: 440 },
  brandName: { color: '#1D4030', fontSize: 20, fontWeight: '700', marginBottom: 36 },
  title: { color: '#1C3D2D', fontSize: 25, fontWeight: '700', marginBottom: 12 },
  description: { color: '#79887B', fontSize: 12 },
  button: { height: 52, backgroundColor: '#2C6049', borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: 25 },
  buttonPressed: { opacity: 0.8 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  message: { color: '#705C38', backgroundColor: '#FCF6E9', overflow: 'hidden', borderRadius: 8, fontSize: 12, lineHeight: 19, marginTop: 14, padding: 12 },
});
