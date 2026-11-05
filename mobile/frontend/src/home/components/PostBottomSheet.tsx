
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { clampSheetHeight, getClosestSheetLevel, getSheetHeights } from './bottomSheetGeometry';
import type { SheetLevel } from './bottomSheetGeometry';
import { PostList } from '../../posts/components/PostList';

export function PostBottomSheet({ bottomInset = 0, token, refreshKey, onSelectPost }: {
  bottomInset?: number; token: string; refreshKey: number; onSelectPost: (id: number) => void;
}) {
  const [screenHeight, setScreenHeight] = useState(0);

  const animatedHeight = useRef(new Animated.Value(0)).current;
  const touchStartY = useRef(0);
  const dragStartHeight = useRef(0);
  const currentHeight = useRef(0);
  const currentLevel = useRef<SheetLevel>('min');
  const isDragging = useRef(false);

  const heights = getSheetHeights(screenHeight);

  // アニメーション途中でも、次に触れた時点の高さから操作を再開する。
  useEffect(() => {
    const listener = animatedHeight.addListener(({ value }) => { currentHeight.current = value; });
    return () => {
      animatedHeight.removeListener(listener);
      animatedHeight.stopAnimation();
    };
  }, [animatedHeight]);

  // 回転・表示領域の変更時にも、選択中の段階を新しい高さに合わせる。
  useEffect(() => {
    if (screenHeight === 0) return;
    animatedHeight.stopAnimation();
    isDragging.current = false;
    const height = getSheetHeights(screenHeight)[currentLevel.current];
    currentHeight.current = height;
    animatedHeight.setValue(height);
  }, [screenHeight, animatedHeight]);

  const moveSheet = (pageY: number) => {
    if (!isDragging.current) return;
    const height = clampSheetHeight(dragStartHeight.current + touchStartY.current - pageY, heights);
    currentHeight.current = height;
    animatedHeight.setValue(height);
  };

  const finishDrag = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const nextLevel = getClosestSheetLevel(currentHeight.current, heights);
    currentLevel.current = nextLevel;
    // 同じ段階へ戻る場合も、必ずアニメーションを開始する。
    Animated.timing(animatedHeight, {
      toValue: heights[nextLevel],
      duration: 250,
      useNativeDriver: false,
    }).start();
  };

  return (
    <View
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFill, { bottom: bottomInset }]}
      onLayout={event =>
        setScreenHeight(event.nativeEvent.layout.height)
      }
    >
      <Animated.View
        style={[styles.sheet, { height: animatedHeight }]}
      >
        {/* 背景は画面全体を覆い、ハンドルと一覧だけ島・ホームバーを避ける。 */}
        <SafeAreaView style={styles.safeContent}>
          <View
            style={styles.handleArea}
            onStartShouldSetResponder={() => true}
            onResponderGrant={event => {
              if (screenHeight === 0) return;
              animatedHeight.stopAnimation();
              touchStartY.current = event.nativeEvent.pageY;
              dragStartHeight.current = currentHeight.current;
              isDragging.current = true;
            }}
            onResponderMove={event => moveSheet(event.nativeEvent.pageY)}
            onResponderRelease={event => {
              moveSheet(event.nativeEvent.pageY);
              finishDrag();
            }}
            onResponderTerminationRequest={() => false}
            onResponderTerminate={finishDrag}
          >
            <View style={styles.handle} />
          </View>

          <Text style={styles.title}>公開投稿</Text>
          <PostList scope="public" token={token} refreshKey={refreshKey} onSelectPost={onSelectPost} />
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeContent: {
    flex: 1,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  handleArea: {
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    width: 44,
    height: 5,
    backgroundColor: '#BBBBBB',
    borderRadius: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 20,
    marginBottom: 12,
    color: '#1D4030',
  },
});
