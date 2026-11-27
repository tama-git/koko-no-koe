import { useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentRef } from 'react';
import {
  AccessibilityInfo, Animated, Easing, PanResponder, Pressable, SafeAreaView, ScrollView, StyleSheet,
  Text, View, useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { TutorialIllustration } from './TutorialIllustration';
import { tutorialPages, tutorialSwipeDirection } from './tutorialPages';
import { useTutorialTransition } from './useTutorialTransition';
import { uiColors } from '../shared/uiColors';

export const tutorialColors = {
  background: uiColors.background,
  illustrationBackground: uiColors.illustrationFill,
  accent: uiColors.primary,
  button: uiColors.primaryFill,
  title: uiColors.text,
  description: uiColors.primary,
  muted: uiColors.neutral,
};

// 端末の動きを減らす設定を読み込んでからチュートリアルを表示する。
export function TutorialScreen({ onExit }: { onExit: () => void }) {
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    let changed = false;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', enabled => {
      changed = true;
      setReduceMotion(enabled);
    });
    // 設定変更の通知が先に届いた場合、その値を古い初期値で上書きしない。
    const setInitial = (enabled: boolean) => {
      if (active && !changed) setReduceMotion(enabled);
    };
    void AccessibilityInfo.isReduceMotionEnabled().then(setInitial, () => setInitial(true));
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      {reduceMotion !== null && <TutorialSlides onExit={onExit} reduceMotion={reduceMotion} />}
    </SafeAreaView>
  );
}

// 説明ページと移動ボタンを表示し、横スワイプでもページを切り替える。
function TutorialSlides({ onExit, reduceMotion }: { onExit: () => void; reduceMotion: boolean }) {
  const { width, height } = useWindowDimensions();
  const diameter = Math.min(152, Math.max(88, Math.round(Math.min(width, height) * 0.36)));
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const { page, go, exit, moving, opacity } = useTutorialTransition(reduceMotion, onExit);
  const slide = tutorialPages[page];
  const lastPage = page === tutorialPages.length - 1;
  const backDisabled = page === 0 || moving;

  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [page]);

  const swipe = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, gesture) =>
      gesture.numberActiveTouches === 1 && Math.abs(gesture.dx) > 16 &&
      Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
    onPanResponderRelease: (_, gesture) => {
      const direction = tutorialSwipeDirection(gesture.dx, gesture.dy);
      if (direction !== null) go(direction);
    },
  }), [go]);

  // フェードと上方向への移動を組み合わせ、動きを減らす設定では移動を省く。
  const rise = (value: Animated.Value) => ({
    opacity: value,
    transform: [{ translateY: reduceMotion ? 0 : value.interpolate({ inputRange: [0, 1], outputRange: [9, 0] }) }],
  });

  return (
    <Animated.View style={[styles.fill, { opacity: opacity.screen }]}>
      <View style={styles.header}>
        <Text style={styles.brand}>ここの声</Text>
        <Pressable accessibilityRole="button" onPress={exit} style={styles.skip}>
          <Text style={styles.secondaryText}>スキップ</Text>
        </Pressable>
      </View>

      <View style={styles.fill} {...swipe.panHandlers}>
        <ScrollView ref={scroll} style={styles.fill} contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.panel}>
            <Animated.View style={[styles.hero, { opacity: opacity.slide }]}>
              <Animated.View importantForAccessibility="no-hide-descendants" style={[styles.illustration, {
                width: diameter, height: diameter, borderRadius: diameter / 2, opacity: opacity.icon,
                transform: [{ scale: reduceMotion ? 1 : opacity.icon.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
              }]}>
                <TutorialIllustration icon={slide.icon} size={Math.round(diameter * 0.59)} color={tutorialColors.accent} />
              </Animated.View>
              <Animated.Text accessibilityRole="header" style={[styles.title, rise(opacity.title)]}>
                {slide.title}
              </Animated.Text>
              <Animated.Text style={[styles.description, rise(opacity.description)]}>
                {slide.description}
              </Animated.Text>
            </Animated.View>

            <View style={styles.footer}>
              <PageIndicator page={page} reduceMotion={reduceMotion} />
              <View style={styles.buttons}>
                <Pressable accessibilityRole="button" disabled={backDisabled}
                  style={[styles.button, styles.backButton, backDisabled && styles.disabled]} onPress={() => go(-1)}>
                  <Text style={styles.secondaryText}>戻る</Text>
                </Pressable>
                <Pressable accessibilityRole="button" disabled={moving} style={[styles.button, styles.nextButton]}
                  onPress={lastPage ? exit : () => go(1)}>
                  <Text style={styles.nextText}>{lastPage ? 'はじめる' : '次へ'}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </Animated.View>
  );
}

// 現在のページに対応する点を横長にして表示する。
function PageIndicator({ page, reduceMotion }: { page: number; reduceMotion: boolean }) {
  const [widths] = useState(() => tutorialPages.map((_, index) => new Animated.Value(index === page ? 22 : 7)));
  useEffect(() => {
    if (reduceMotion) {
      widths.forEach((width, index) => width.setValue(index === page ? 22 : 7));
      return;
    }
    const animation = Animated.parallel(widths.map((width, index) => Animated.timing(width, {
      toValue: index === page ? 22 : 7, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: false,
    })));
    animation.start();
    return () => animation.stop();
  }, [page, reduceMotion, widths]);

  return (
    <View accessible accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: tutorialPages.length, now: page + 1,
        text: `${tutorialPages.length}ページ中${page + 1}ページ目` }}
      style={styles.indicator}>
      {widths.map((width, index) => (
        <Animated.View key={tutorialPages[index].icon}
          style={[styles.dot, index === page && styles.activeDot, { width }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tutorialColors.background },
  fill: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 24,
    width: '100%', maxWidth: 720, alignSelf: 'center' },
  brand: { flexShrink: 1, fontSize: 17, fontWeight: '700', color: tutorialColors.title },
  skip: { minHeight: 44, justifyContent: 'center', flexShrink: 1 },
  scrollContent: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 24, paddingBottom: 16 },
  panel: { flexGrow: 1, width: '100%', maxWidth: 480 },
  hero: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 24 },
  illustration: { alignItems: 'center', justifyContent: 'center', backgroundColor: tutorialColors.illustrationBackground },
  title: { marginTop: 24, fontSize: 26, fontWeight: '700', textAlign: 'center', color: tutorialColors.title },
  description: { marginTop: 12, fontSize: 16, lineHeight: 25, textAlign: 'center', color: tutorialColors.description },
  footer: { gap: 20 },
  indicator: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7 },
  dot: { height: 7, borderRadius: 4, backgroundColor: tutorialColors.muted },
  activeDot: { backgroundColor: tutorialColors.accent },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  button: { flexGrow: 1, flexBasis: 120, minHeight: 48, paddingVertical: 10, paddingHorizontal: 14,
    alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  backButton: { borderWidth: 1, borderColor: uiColors.neutral },
  disabled: { opacity: 0.45 },
  nextButton: { backgroundColor: tutorialColors.button },
  nextText: { fontSize: 16, fontWeight: '600', textAlign: 'center', color: uiColors.onPrimary },
  secondaryText: { fontSize: 15, fontWeight: '600', textAlign: 'center', color: uiColors.primary },
});
