
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { clampSheetHeight, getClosestSheetLevel, getSheetHeights } from './bottomSheetGeometry';
import type { SheetLevel } from './bottomSheetGeometry';
import { getSheetTabAfterSwipe, isHorizontalSheetSwipe, SHEET_TABS } from './bottomSheetTabs';
import type { SheetTab } from './bottomSheetTabs';
import { PostList } from '../../posts/components/PostList';
import type { ViewerCoordinates } from '../../posts/postService';
import type { PostListState } from '../../posts/usePostList';

export function PostBottomSheet({
  bottomInset = 0, animatedHeight, nearbyList, ownList, token, coordinates,
  onSelectNearbyPost, onSelectOwnPost, onOpenSettings,
}: {
  bottomInset?: number;
  animatedHeight: Animated.Value;
  nearbyList: PostListState;
  ownList: PostListState;
  token: string;
  coordinates?: ViewerCoordinates;
  onSelectNearbyPost: (id: number) => void;
  onSelectOwnPost: (id: number) => void;
  onOpenSettings: () => void;
}) {
  const [screenHeight, setScreenHeight] = useState(0);
  const [tab, setTab] = useState<SheetTab>('public');
  const tabSwipe = useMemo(() => {
    // PanResponderは取得時にdx・dyを0へ戻すため、そこまでの移動を保存する。
    let initialDx = 0;
    let initialDy = 0;
    let hasMultipleTouches = false;
    return PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, { dx, dy, numberActiveTouches }) => {
        if (numberActiveTouches !== 1 || !isHorizontalSheetSwipe(dx, dy)) return false;
        initialDx = dx;
        initialDy = dy;
        hasMultipleTouches = false;
        return true;
      },
      onPanResponderStart: (_, { numberActiveTouches }) => {
        if (numberActiveTouches > 1) hasMultipleTouches = true;
      },
      onPanResponderRelease: (_, { dx, dy }) => {
        if (!hasMultipleTouches) {
          setTab(currentTab => getSheetTabAfterSwipe(currentTab, initialDx + dx, initialDy + dy));
        }
      },
    });
  }, []);
  const title = tab === 'public' ? `近くで読める声 ${nearbyList.posts.length}件`
    : tab === 'own' ? `自分の投稿 ${ownList.posts.length}件` : '設定';

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

          <View style={styles.page} {...tabSwipe.panHandlers}>
            <View style={styles.header}>
              <Text accessibilityRole="header" style={styles.title}>{title}</Text>
              <View accessibilityRole="tablist" style={styles.tabs}>
                {SHEET_TABS.map(({ id, label }) => (
                  <Pressable key={id} accessibilityRole="tab" accessibilityLabel={label}
                    accessibilityState={{ selected: tab === id }} onPress={() => setTab(id)}
                    style={[styles.tab, tab === id && styles.selectedTab]}>
                    <SheetTabIcon tab={id} color={tab === id ? '#1D4030' : '#53645A'} />
                  </Pressable>
                ))}
              </View>
            </View>
            {tab === 'settings' ? (
              <Pressable accessibilityRole="button" onPress={onOpenSettings} style={styles.settings}>
                <Text style={styles.settingsText}>アプリの設定</Text>
              </Pressable>
            ) : (
              <PostList key={tab} scope={tab} token={token} coordinates={tab === 'public' ? coordinates : undefined}
                list={tab === 'public' ? nearbyList : ownList}
                onSelectPost={tab === 'public' ? onSelectNearbyPost : onSelectOwnPost} />
            )}
          </View>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

function SheetTabIcon({ tab, color }: { tab: SheetTab; color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {tab === 'public' && <Path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-3.7-.8L4 21l1.8-4.8a9 9 0 0 1-.8-3.7A8.5 8.5 0 0 1 13.5 4H14a8.5 8.5 0 0 1 7 7.5Z" />}
      {tab === 'own' && <>
        <Circle cx={12} cy={7} r={3.5} />
        <Path d="M5 21v-1a7 7 0 0 1 14 0v1" />
      </>}
      {tab === 'settings' && <>
        <Path d="m9.5 4 .7-2h3.6l.7 2 1.6.9 2.1-.4 1.8 3.1-1.4 1.6v1.8L20 12.6l-1.8 3.1-2.1-.4-1.6.9-.7 2h-3.6l-.7-2-1.6-.9-2.1.4L4 12.6 5.4 11V9.2L4 7.6l1.8-3.1 2.1.4 1.6-.9Z" transform="translate(0 1.9)" />
        <Circle cx={12} cy={12} r={2.5} />
      </>}
    </Svg>
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
  page: { flex: 1 },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 8,
    rowGap: 4,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  title: { fontSize: 18, fontWeight: '700', color: '#1D4030', maxWidth: '100%' },
  tabs: { flexDirection: 'row', padding: 2, borderRadius: 24, backgroundColor: '#E8EFEA', marginLeft: 'auto' },
  tab: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  selectedTab: { backgroundColor: '#FFFFFF' },
  settings: {
    marginHorizontal: 20,
    minHeight: 44,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#F4F6F4',
  },
  settingsText: { fontSize: 15, fontWeight: '600', color: '#1D4030' },
});
