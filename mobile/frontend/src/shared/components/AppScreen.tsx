import { StatusBar } from 'expo-status-bar';
import type { PropsWithChildren } from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';

type Props = PropsWithChildren<{ edgeToEdge?: boolean }>;

/** 通常は安全な余白を確保し、地図などの背景だけ全画面表示を選べる。 */
export function AppScreen({ children, edgeToEdge = false }: Props) {
  const Container = edgeToEdge ? View : SafeAreaView;
  return (
    <Container style={styles.safeArea}>
      <StatusBar style="dark" />
      {children}
    </Container>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
});
