
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { GestureResponderEvent } from 'react-native';
import {
  clampSheetHeight, getSheetHeights, getSheetLevelAfterDrag, getSheetLevelHeight, getSheetSettleDuration,
  LIST_MIDDLE_RATIO, MIN_SHEET_HEADER_HEIGHT, PIN_DETAIL_MIDDLE_RATIO, SHEET_HANDLE_HEIGHT,
} from './bottomSheetGeometry';
import type { SheetLevel } from './bottomSheetGeometry';
import { getPostModeAfterSwipe, isHorizontalSheetSwipe, POST_MODE_LABELS } from './bottomSheetTabs';
import { PostList, PostListSortButton } from '../../posts/components/PostList';
import type { PostDetailSheetControls } from '../../posts/screens/PostDetailScreen';
import type { ViewerCoordinates } from '../../posts/postService';
import type { PostSortOrder } from '../../posts/sortPosts';
import type { PostListScope, PostListState } from '../../posts/usePostList';

const TAP_SLOP = 6;
const SHEET_DIVIDER_HEIGHT = 1;
const FULL_BACKGROUND_FADE_DISTANCE = 12;
const SHEET_BACKGROUND_COLOR = '#F4F2ED';

type SheetDetail = { id: number } & (
  | { renderPost: (controls: PostDetailSheetControls) => ReactNode }
  | { distanceNotice: ReactNode }
);

export function PostBottomSheet({
  bottomInset, animatedHeight, mode, onSelectMode, list, token, coordinates,
  onSelectPost, detail, onCloseDetail, listOpenRequest,
}: {
  bottomInset: number;
  animatedHeight: Animated.Value;
  mode: PostListScope;
  onSelectMode: (mode: PostListScope) => void;
  list: PostListState;
  token: string;
  coordinates?: ViewerCoordinates;
  onSelectPost: (id: number) => void;
  detail: SheetDetail | null;
  onCloseDetail: () => void;
  listOpenRequest: number;
}) {
  const [containerHeight, setContainerHeight] = useState(0);
  const [listHeaderHeight, setListHeaderHeight] = useState(MIN_SHEET_HEADER_HEIGHT + SHEET_DIVIDER_HEIGHT);
  const [detailBackHeight, setDetailBackHeight] = useState(MIN_SHEET_HEADER_HEIGHT);
  const [sheetLevel, setSheetLevel] = useState<SheetLevel>('half');
  const [middleRatio, setMiddleRatio] = useState(LIST_MIDDLE_RATIO);
  const compact = sheetLevel === 'min';
  const expanded = sheetLevel === 'half' || sheetLevel === 'full';
  const headerDivider = <View pointerEvents="none" style={styles.divider} />;
  const [sortOrders, setSortOrders] = useState<Record<PostListScope, PostSortOrder>>({ public: 'newest', own: 'newest' });
  const detailId = detail?.id ?? null;
  const showingDetail = detailId !== null;
  const postDetail = detail && 'renderPost' in detail ? detail : null;
  const distanceDetail = detail && 'distanceNotice' in detail ? detail : null;
  const hiddenList = sheetLevel === 'hidden' && !showingDetail;
  const modeSwipe = useMemo(() => {
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
          onSelectMode(getPostModeAfterSwipe(mode, initialDx + dx, initialDy + dy));
        }
      },
    });
  }, [mode, onSelectMode]);
  const title = POST_MODE_LABELS[mode];
  const count = list.loading ? '…' : list.error ? '—' : list.posts.length;
  const countLabel = list.loading ? `${title}の件数を読み込み中`
    : list.error ? `${title}の件数を取得できませんでした` : `${title} ${count}件`;
  const backLabel = `${title}に戻る`;
  const sortOrder = sortOrders[mode];

  const touchStart = useRef({ x: 0, y: 0, timestamp: 0 });
  const dragStartHeight = useRef(0);
  const currentHeight = useRef(0);
  const targetHeight = useRef(0);
  const currentLevel = useRef<SheetLevel>('half');
  const previousDetailId = useRef<number | null>(null);
  const previousListOpenRequest = useRef(listOpenRequest);
  const isDragging = useRef(false);
  const moved = useRef(false);

  const headerHeight = showingDetail ? detailBackHeight : listHeaderHeight;
  const heights = useMemo(() => getSheetHeights(containerHeight, headerHeight, middleRatio, !showingDetail),
    [containerHeight, headerHeight, middleRatio, showingDetail]);
  const fullBackgroundOpacity = useMemo(() => animatedHeight.interpolate({
    inputRange: [heights.full - FULL_BACKGROUND_FADE_DISTANCE, heights.full],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  }), [animatedHeight, heights.full]);

  /**
   * ドラッグ中はシートが指に追従し、指を離すと最も近い段階に収まる。
   * 短く素早いフリックでは、払った方向へ一段進む。手動調整の移動時間は残り距離に比例する。
   * 最小表示から詳細を開くときは、地図ピンの移動に合わせて中間まで自動で開く。
   *
   * 修正予定: 中間と最大の切り替えでは、実機で移動速度が揃わないように見えることがある。
   * iPhoneで上下それぞれ、目標に近い場所と遠い場所で指を離し、
   * シートの上端が滑らかに動くかを比較してから調整する。
   */
  const snapTo = useCallback((level: SheetLevel, transition: 'adjust' | 'detail' | 'instant' = 'adjust', nextHeights = heights) => {
    animatedHeight.stopAnimation();
    isDragging.current = false;
    currentLevel.current = level;
    setSheetLevel(level);
    if ((level === 'hidden' || level === 'min') && !showingDetail) setMiddleRatio(LIST_MIDDLE_RATIO);
    const height = getSheetLevelHeight(nextHeights, level);
    targetHeight.current = height;
    if (transition === 'instant' || currentHeight.current === height) {
      currentHeight.current = height;
      animatedHeight.setValue(height);
      return;
    }
    // 詳細への遷移は、地図のピンを中央へ移す処理の開始前に終える。
    const duration = transition === 'detail' ? 250 : getSheetSettleDuration(currentHeight.current, height);
    Animated.timing(animatedHeight, {
      toValue: height, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: false,
    }).start();
  }, [animatedHeight, heights, showingDetail]);

  // アニメーション途中でも、次に触れた時点の高さから操作を再開する。
  useEffect(() => {
    const listener = animatedHeight.addListener(({ value }) => { currentHeight.current = value; });
    return () => {
      animatedHeight.removeListener(listener);
      animatedHeight.stopAnimation();
    };
  }, [animatedHeight]);

  // 一覧・詳細の切り替えでは現在の高さを保ち、本文が隠れている場合や下部メニューから詳細を閉じた場合に展開する。
  useEffect(() => {
    if (containerHeight === 0) return;
    const previousId = previousDetailId.current;
    const listRequested = previousListOpenRequest.current !== listOpenRequest;
    previousDetailId.current = detailId;
    previousListOpenRequest.current = listOpenRequest;
    const level = currentLevel.current;
    const wasShowingDetail = previousId !== null;
    const isCompactOrHidden = level === 'min' || level === 'hidden';
    if (!showingDetail && listRequested && (isCompactOrHidden || wasShowingDetail)) {
      setMiddleRatio(LIST_MIDDLE_RATIO);
      snapTo('half', 'adjust', getSheetHeights(containerHeight, listHeaderHeight, LIST_MIDDLE_RATIO, true));
      return;
    }
    if (previousId !== detailId && showingDetail && isCompactOrHidden) {
      setMiddleRatio(PIN_DETAIL_MIDDLE_RATIO);
      snapTo('half', 'detail', getSheetHeights(containerHeight, headerHeight, PIN_DETAIL_MIDDLE_RATIO));
      return;
    }
    if (!isDragging.current && targetHeight.current !== getSheetLevelHeight(heights, level)) {
      snapTo(level, level === 'min' ? 'adjust' : 'instant');
    }
  }, [containerHeight, detailId, headerHeight, listHeaderHeight, listOpenRequest, showingDetail, heights, snapTo]);

  const toggleSheet = () => snapTo(currentLevel.current === 'half' ? 'min' : 'half');
  const expandSheet = () => snapTo('half');
  const moveSheet = (pageY: number) => {
    if (!isDragging.current) return;
    const height = clampSheetHeight(dragStartHeight.current + touchStart.current.y - pageY, heights);
    currentHeight.current = height;
    animatedHeight.setValue(height);
  };
  const didMove = (pageX: number, pageY: number) =>
    Math.max(Math.abs(pageX - touchStart.current.x), Math.abs(pageY - touchStart.current.y)) >= TAP_SLOP;

  const verticalDrag = {
    onStartShouldSetResponder: () => true,
    onResponderGrant: ({ nativeEvent: { pageX, pageY, timestamp } }: GestureResponderEvent) => {
      if (containerHeight === 0) return;
      animatedHeight.stopAnimation();
      touchStart.current = { x: pageX, y: pageY, timestamp };
      dragStartHeight.current = currentHeight.current;
      isDragging.current = true;
      moved.current = false;
    },
    onResponderMove: ({ nativeEvent: { pageX, pageY } }: GestureResponderEvent) => {
      moved.current ||= didMove(pageX, pageY);
      moveSheet(pageY);
    },
    onResponderTerminationRequest: () => false,
    onResponderTerminate: () => {
      if (isDragging.current) snapTo(currentLevel.current);
    },
  };
  const finishDrag = ({ nativeEvent: { pageX, pageY, timestamp } }: GestureResponderEvent, onTap?: () => void) => {
    if (!isDragging.current) return;
    if (!moved.current && !didMove(pageX, pageY)) {
      if (onTap) onTap();
      else snapTo(currentLevel.current);
      return;
    }
    moveSheet(pageY);
    snapTo(getSheetLevelAfterDrag(dragStartHeight.current, pageY - touchStart.current.y,
      timestamp - touchStart.current.timestamp, heights));
  };

  const interactiveSheet = (
    <SafeAreaView
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFill, { bottom: bottomInset }]}
    >
      {/* シートの移動中に上下のセーフエリアが変わらないよう、可動範囲を先に確保する。 */}
      <View
        pointerEvents="box-none"
        style={styles.sheetTrack}
        onLayout={event => setContainerHeight(event.nativeEvent.layout.height)}
      >
        <Animated.View style={[styles.sheet, { height: animatedHeight }]}
          pointerEvents={hiddenList ? 'none' : 'auto'} accessibilityElementsHidden={hiddenList}
          importantForAccessibility={hiddenList ? 'no-hide-descendants' : 'auto'}>
          <View style={styles.handleArea} {...verticalDrag} collapsable={false}
            accessible accessibilityRole="button" accessibilityLabel="シートの高さを切り替え"
            onAccessibilityTap={toggleSheet}
            accessibilityActions={[{ name: 'activate', label: 'シートの高さを切り替え' }]}
            onAccessibilityAction={event => { if (event.nativeEvent.actionName === 'activate') toggleSheet(); }}
            onResponderRelease={event => finishDrag(event, toggleSheet)}>
            <View style={styles.handle} />
          </View>
          {!showingDetail && (
            <View onLayout={event => setListHeaderHeight(event.nativeEvent.layout.height)}>
              <View style={styles.listHeader}>
                <View style={styles.header} {...verticalDrag} collapsable={false}
                  accessible={compact}
                  accessibilityRole={compact ? 'button' : undefined}
                  accessibilityLabel={compact ? countLabel : undefined}
                  accessibilityHint={compact ? '中間まで展開します' : undefined}
                  onAccessibilityTap={compact ? expandSheet : undefined}
                  accessibilityActions={compact ? [{ name: 'activate', label: '中間まで展開' }] : undefined}
                  onAccessibilityAction={event => {
                    if (compact && event.nativeEvent.actionName === 'activate') expandSheet();
                  }}
                  onResponderRelease={event => finishDrag(event, compact ? expandSheet : undefined)}>
                  <View style={styles.headingRow}>
                    <Text accessibilityRole="header" style={styles.title}>{title}</Text>
                    <Text style={styles.countText}>{count}件</Text>
                  </View>
                </View>
                {list.posts.length > 0 && (
                  <PostListSortButton order={sortOrder} canSortByDistance={mode === 'public' && coordinates !== undefined}
                    onOrderChange={order => setSortOrders(current => ({ ...current, [mode]: order }))} />
                )}
              </View>
              {headerDivider}
            </View>
          )}
          {distanceDetail && (
            <Pressable accessibilityRole="button" onPress={onCloseDetail} style={styles.detailBack}
              onLayout={event => setDetailBackHeight(event.nativeEvent.layout.height)}>
              <Text style={styles.detailBackText}>〈 {backLabel}</Text>
            </Pressable>
          )}

          {/* 一覧の状態を保ったまま、表示領域を一覧と詳細で切り替える。 */}
          <View style={styles.page}>
            <View style={[styles.page, showingDetail && styles.hiddenPage]} {...modeSwipe.panHandlers}
              pointerEvents={!expanded || showingDetail ? 'none' : 'auto'}
              accessibilityElementsHidden={!expanded || showingDetail}
              importantForAccessibility={!expanded || showingDetail ? 'no-hide-descendants' : 'auto'}>
              <PostList key={mode} scope={mode} token={token} coordinates={coordinates} list={list}
                order={sortOrder} onSelectPost={onSelectPost} />
            </View>
            {distanceDetail && (
              <View style={styles.page}
                pointerEvents={compact ? 'none' : 'auto'} accessibilityElementsHidden={compact}
                importantForAccessibility={compact ? 'no-hide-descendants' : 'auto'}>
                {distanceDetail.distanceNotice}
              </View>
            )}
            {postDetail && (
              <View style={styles.page}>
                {postDetail.renderPost({
                  compact,
                  headerDivider: expanded ? headerDivider : null,
                  onExpand: expandSheet,
                  onHeaderLayout: event => setDetailBackHeight(event.nativeEvent.layout.height),
                })}
              </View>
            )}
          </View>
        </Animated.View>
      </View>
    </SafeAreaView>
  );

  return (
    <>
      {/* 背景だけを上のセーフエリアまで伸ばし、シートの高さとハンドルの位置は保つ。 */}
      {heights.full > 0 && (
        <Animated.View pointerEvents={sheetLevel === 'full' ? 'auto' : 'none'} accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[StyleSheet.absoluteFill, { bottom: bottomInset, backgroundColor: SHEET_BACKGROUND_COLOR, opacity: fullBackgroundOpacity }]} />
      )}
      {interactiveSheet}
    </>
  );
}

const styles = StyleSheet.create({
  sheetTrack: {
    flex: 1,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: SHEET_BACKGROUND_COLOR,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  handleArea: {
    height: SHEET_HANDLE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 7,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#BBBBBB',
    borderRadius: 10,
  },
  page: { flex: 1 },
  hiddenPage: { display: 'none' },
  countText: { color: '#1D4030', fontSize: 16, fontWeight: '700' },
  detailBack: { minHeight: MIN_SHEET_HEADER_HEIGHT, paddingHorizontal: 20, justifyContent: 'center' },
  detailBackText: { color: '#1D4030', fontSize: 16, fontWeight: '700' },
  listHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 8 },
  header: { flex: 1, minWidth: 0, minHeight: MIN_SHEET_HEADER_HEIGHT, paddingVertical: 6, justifyContent: 'center' },
  headingRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 6, rowGap: 2 },
  divider: { height: SHEET_DIVIDER_HEIGHT, backgroundColor: '#DDDAD2' },
  title: { fontSize: 18, fontWeight: '700', color: '#1D4030', flexShrink: 1 },
});
