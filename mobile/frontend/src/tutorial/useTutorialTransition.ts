import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';

import { nextTutorialPage } from './tutorialPages';

// 指定した遅延と時間で表示を変化させるアニメーションを作る。
function animate(value: Animated.Value, toValue: number, duration: number, delay = 0) {
  return Animated.timing(value, {
    toValue, duration, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true,
  });
}

// チュートリアルのページ遷移と終了演出を管理し、操作の重複を防ぐ。
export function useTutorialTransition(reduceMotion: boolean, onExit: () => void) {
  const [page, setPage] = useState(0);
  const [moving, setMoving] = useState(false);
  const phase = useRef<'idle' | 'changing' | 'closing'>('idle');
  const fade = useRef<Animated.CompositeAnimation | null>(null);
  const motionPreference = useRef(reduceMotion);
  const [opacity] = useState(() => ({
    screen: new Animated.Value(1),
    slide: new Animated.Value(1),
    icon: new Animated.Value(0),
    title: new Animated.Value(0),
    description: new Animated.Value(0),
  }));

  useLayoutEffect(() => {
    motionPreference.current = reduceMotion;
  }, [reduceMotion]);

  useLayoutEffect(() => {
    const reduce = motionPreference.current;
    const isChangingPage = phase.current === 'changing';
    opacity.icon.setValue(reduce ? 1 : 0);
    opacity.title.setValue(reduce ? 1 : 0);
    opacity.description.setValue(reduce ? 1 : 0);
    opacity.slide.setValue(isChangingPage && !reduce ? 0 : 1);

    const entrance = reduce ? null : Animated.parallel([
      animate(opacity.icon, 1, 700),
      animate(opacity.title, 1, 500, 150),
      animate(opacity.description, 1, 600, 320),
    ]);
    entrance?.start();

    let fadeIn: Animated.CompositeAnimation | undefined;
    if (isChangingPage) {
      // ページ切り替えを完了し、次の操作を受け付ける。
      const unlock = () => {
        phase.current = 'idle';
        setMoving(false);
      };
      if (reduce) {
        unlock();
      } else {
        fadeIn = animate(opacity.slide, 1, 350);
        fade.current = fadeIn;
        fadeIn.start(({ finished }) => {
          if (finished && phase.current === 'changing') unlock();
        });
      }
    }
    return () => {
      entrance?.stop();
      fadeIn?.stop();
    };
  }, [page, opacity]);

  useEffect(() => () => fade.current?.stop(), []);

  // 現在の内容をフェードアウトし、移動先のページに切り替える。
  const go = useCallback((direction: -1 | 1) => {
    if (phase.current !== 'idle') return;
    const next = nextTutorialPage(page, direction);
    if (next === page) return;
    phase.current = 'changing';
    setMoving(true);
    if (motionPreference.current) {
      setPage(next);
      return;
    }
    const fadeOut = animate(opacity.slide, 0, 220);
    fade.current = fadeOut;
    fadeOut.start(({ finished }) => {
      if (finished && phase.current === 'changing') setPage(next);
    });
  }, [page, opacity]);

  // 「はじめる」または「スキップ」で終了し、呼び出し元へ制御を戻す。
  const exit = () => {
    if (phase.current === 'closing') return;
    phase.current = 'closing';
    setMoving(true);
    fade.current?.stop();
    if (motionPreference.current) {
      onExit();
      return;
    }
    const fadeOut = animate(opacity.screen, 0, 320);
    fade.current = fadeOut;
    fadeOut.start(({ finished }) => {
      if (finished) onExit();
    });
  };

  return { page, go, exit, moving, opacity };
}
