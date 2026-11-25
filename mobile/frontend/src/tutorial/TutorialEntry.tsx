import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { rememberTutorialCompletion, shouldShowTutorial } from './tutorialCompletion';
import { TutorialScreen, tutorialColors } from './TutorialScreen';

export function TutorialEntry({ completionKey, children }: PropsWithChildren<{ completionKey: string }>) {
  const [screen, setScreen] = useState<'checking' | 'tutorial' | 'home'>('checking');

  useEffect(() => {
    let active = true;
    void shouldShowTutorial(AsyncStorage, completionKey).then(show => {
      if (active) setScreen(show ? 'tutorial' : 'home');
    });
    return () => { active = false; };
  }, [completionKey]);

  if (screen === 'home') return children;
  if (screen === 'checking') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator accessibilityLabel="読み込み中" color={tutorialColors.accent} />
      </View>
    );
  }

  return <TutorialScreen onExit={async () => {
    await rememberTutorialCompletion(AsyncStorage, completionKey);
    setScreen('home');
  }} />;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: tutorialColors.background },
});
