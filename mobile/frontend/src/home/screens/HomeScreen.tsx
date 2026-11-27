import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ComponentProps } from 'react';
import { Animated, BackHandler, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '../../shared/components/AppScreen';
import { HomeMap } from '../../map/components/HomeMap';
import { useCurrentLocation } from '../../location/useCurrentLocation';
import { filterNearbyPosts } from '../../map/filterNearbyPosts';
import { ownPostsToPins } from '../../map/postPins';
import type { MapPinSelection } from '../../map/postPins';
import { canOpenSelectedPost, getPostProximity } from '../../map/postProximity';
import { PostBottomSheet } from '../components/PostBottomSheet';
import { HomeMenuBar } from '../components/HomeMenuBar';
import { PostComposerModal } from '../../posts/components/PostComposerModal';
import { PostDistanceNotice } from '../../posts/components/PostDetailModal';
import { PostDetailScreen } from '../../posts/screens/PostDetailScreen';
import { usePostList } from '../../posts/usePostList';
import type { PostListScope } from '../../posts/usePostList';
import { TutorialScreen } from '../../tutorial/TutorialScreen';
import { UtilityScreen } from '../../utility/screens/UtilityScreen';
import { uiColors } from '../../shared/uiColors';

type Props = {
  token: string;
  busy: boolean;
  message: string;
  onLogout: () => Promise<void>;
  user: { name: string; email: string };
};

type PostVisit = { pin: MapPinSelection; phase: 'guide' | 'opening' | 'reading' };

/** トップ画面担当の編集場所。ログアウトの処理は認証担当に渡す。 */
export function HomeScreen({ token, busy, onLogout, user }: Props) {
  const [postMode, setPostMode] = useState<{ scope: PostListScope; revision: number }>({ scope: 'public', revision: 0 });
  const activePostMode = useRef(postMode);
  const { scope: mode, revision: modeRevision } = postMode;
  const [openScreen, setOpenScreen] = useState<'compose' | 'settings' | null>(null);
  const [replayingTutorial, setReplayingTutorial] = useState(false);
  const [menuHeight, setMenuHeight] = useState(0);
  const sheetHeight = useRef(new Animated.Value(0)).current;
  const mapControlsInset = useMemo(() => Animated.add(sheetHeight, menuHeight), [sheetHeight, menuHeight]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selection, setSelection] = useState<PostVisit | null>(null);
  const [listOpenRequest, setListOpenRequest] = useState(0);
  const { location, displayPosition, heading, retryLocation } = useCurrentLocation();
  const viewerCoordinates = location.status === 'ready' ? location.coordinates : undefined;
  const selectedPin = selection?.pin ?? null;
  const monitorVisibility = selection?.phase === 'reading' && !selection.pin.own;
  const publicPosts = usePostList(token, 'public', refreshKey, viewerCoordinates, monitorVisibility);
  const ownPosts = usePostList(token, 'own', refreshKey);
  const ownPins = useMemo(() => ownPostsToPins(ownPosts.posts), [ownPosts.posts]);
  const locationFailed = location.status !== 'loading' && location.status !== 'ready';
  const nearbyPosts = useMemo(() => location.status === 'ready'
    ? filterNearbyPosts(publicPosts.posts, location.coordinates.latitude, location.coordinates.longitude)
    : [], [location, publicPosts.posts]);
  const nearbyPostIds = useMemo(() => new Set(nearbyPosts.map(post => post.id)), [nearbyPosts]);
  const proximity = selectedPin && getPostProximity(viewerCoordinates, selectedPin.point);
  const withinRadius = proximity?.withinRadius === true;
  const revoked = selectedPin !== null && !selectedPin.own && (
    publicPosts.pinStatus === 'denied' ||
    (publicPosts.pinStatus === 'verified' && !publicPosts.pins.some(pin => pin.id === selectedPin.id))
  );
  const readContext = useRef({ viewerCoordinates, nearbyPostIds, withinRadius, revoked, selectedPin });
  useLayoutEffect(() => {
    readContext.current = { viewerCoordinates, nearbyPostIds, withinRadius, revoked, selectedPin };
    // 成功前に圏外へ出た場合は取得中の詳細を閉じる。次の到達時は本人がボタンを押して開く。
    if (revoked) setSelection(current => current === selection ? null : current);
    else if (selection?.phase === 'opening' && !selection.pin.own && !withinRadius) {
      setSelection(current => current === selection ? { ...selection, phase: 'guide' } : current);
    }
  }, [selection, viewerCoordinates, nearbyPostIds, withinRadius, revoked, selectedPin]);

  // 選択した投稿について、詳細の取得を始めるか圏外案内を出すかを判断する。
  const beginVisit = useCallback((pin: MapPinSelection) => {
    const current = readContext.current;
    const inRange = getPostProximity(current.viewerCoordinates, pin.point)?.withinRadius === true;
    const canOpen = canOpenSelectedPost(pin.own, inRange, current.nearbyPostIds.has(pin.id));
    setSelection(previous => previous?.pin.id === pin.id ? previous : { pin, phase: canOpen ? 'opening' : 'guide' });
  }, []);
  const nearbyList = {
    ...publicPosts,
    posts: nearbyPosts,
    loading: publicPosts.loading || location.status === 'loading',
    error: locationFailed ? '現在地を取得できませんでした。位置情報の設定を確認して再取得してください。' : publicPosts.error,
    refresh: locationFailed ? retryLocation : publicPosts.refresh,
  };
  // 表示中の一覧から選んだ投稿を探し、地図のピンと同じ流れで開く。
  const selectListPost = (id: number) => {
    if (activePostMode.current.revision !== modeRevision) return;
    const post = (mode === 'own' ? ownPosts.posts : nearbyPosts).find(item => item.id === id);
    if (!post) return;
    const point = post.latitude === null || post.longitude === null
      ? null : { latitude: post.latitude, longitude: post.longitude };
    beginVisit({ id, own: mode === 'own' || post.is_own === true, point });
  };
  // 「周りの声」と「自分の投稿」を切り替え、前のモードの投稿選択を解除する。
  const selectMode = useCallback((nextMode: PostListScope) => {
    const current = activePostMode.current;
    if (nextMode === current.scope) return;
    const next = { scope: nextMode, revision: current.revision + 1 };
    activePostMode.current = next;
    setPostMode(next);
    setSelection(null);
  }, []);
  // 下部メニューから対応する一覧を選び、詳細の選択を解除して一覧の表示を要求する。
  const selectMenuMode = (nextMode: PostListScope) => {
    selectMode(nextMode);
    setSelection(null);
    setListOpenRequest(request => request + 1);
  };
  // 切り替え前の表示に属するピン操作を除き、現在のモードのピンを開く。
  const selectMapPin = useCallback((pinSelection: MapPinSelection, revision: number) => {
    // 切り替えボタンを押した直後は、Reactの再描画前に届いた旧ピンのイベントも破棄する。
    if (activePostMode.current.revision === revision) beginVisit(pinSelection);
  }, [beginVisit]);
  // 投稿一覧と地図ピンを再取得するための更新番号を進める。
  const refreshPosts = () => setRefreshKey(value => value + 1);
  // 閲覧中の投稿選択を解除して一覧へ戻る。
  const closeDetail = () => setSelection(null);
  // 削除や非表示が終わった投稿を閉じ、一覧と地図ピンを更新する。
  const finishPostChange = () => {
    setSelection(current => current?.pin === selectedPin ? null : current);
    refreshPosts();
  };
  const showingDetail = selection !== null && !revoked;

  useEffect(() => {
    if (!showingDetail) return;
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      setSelection(null);
      return true;
    });
    return () => back.remove();
  }, [showingDetail]);

  const showPost = selection?.phase === 'reading' ||
    (selection?.phase === 'opening' && (selection.pin.own || withinRadius));
  const arrived = withinRadius && selectedPin !== null && nearbyPostIds.has(selectedPin.id) && !revoked;
  // 「声を読む」が押された時点の閲覧条件を確認し、投稿詳細の取得を始める。
  const openArrivedPost = () => {
    const current = readContext.current;
    if (current.revoked || !current.withinRadius || !selectedPin || !current.nearbyPostIds.has(selectedPin.id)) return;
    setSelection(visit => visit?.pin === selectedPin && visit.phase === 'guide' ? { ...visit, phase: 'opening' } : visit);
  };
  const detail: ComponentProps<typeof PostBottomSheet>['detail'] = !selection || revoked ? null : showPost ? {
    id: selection.pin.id,
    renderPost: sheet => (
      <PostDetailScreen key={selection.pin.id} route={{ params: { postId: selection.pin.id } }} token={token}
        navigation={{ goBack: closeDetail }} sheet={sheet} onHidden={finishPostChange}
        viewerAccess={selection.pin.own ? undefined : {
          getCoordinates: () => {
            const current = readContext.current;
            return current.selectedPin === selection.pin && !current.revoked && current.withinRadius
              ? current.viewerCoordinates : undefined;
          },
          onOpened: () => setSelection(current =>
            current === selection && current.phase === 'opening' ? { ...current, phase: 'reading' } : current),
        }}
        onDeleted={selection.pin.own ? finishPostChange : undefined}
        onVisibilityChanged={selection.pin.own ? refreshPosts : undefined}
        onPlaceChanged={(postId, place) => {
          ownPosts.updatePlaceDisplay(postId, place);
          publicPosts.updatePlaceDisplay(postId, place);
        }} />
    ),
  } : {
    id: selection.pin.id,
    distanceNotice: <PostDistanceNotice key={selection.pin.id} proximity={proximity} arrived={arrived}
      onRead={openArrivedPost} />,
  };
  return (
    <AppScreen edgeToEdge>
      <View style={styles.home}>
        {/* 地図を画面全体に置き、シートの高さは操作ボタンと出典の位置だけに使う。 */}
        <HomeMap postPins={mode === 'own' ? ownPins : publicPosts.pins} modeRevision={modeRevision} nearbyPostIds={nearbyPostIds}
          selectedPin={revoked ? null : selectedPin}
          location={location} displayPosition={displayPosition} heading={heading} controlsInset={mapControlsInset}
          onSelectPin={selectMapPin} onOpenSettings={() => setOpenScreen('settings')} />
        <PostBottomSheet bottomInset={menuHeight} animatedHeight={sheetHeight} mode={mode} onSelectMode={selectMode}
          list={mode === 'public' ? nearbyList : ownPosts} token={token}
          coordinates={mode === 'public' ? viewerCoordinates : undefined}
          detail={detail} onCloseDetail={closeDetail} listOpenRequest={listOpenRequest}
          onSelectPost={selectListPost} />
        <HomeMenuBar mode={mode} onSelectMode={selectMenuMode} composeDisabled={busy}
          onCompose={() => setOpenScreen('compose')}
          onLayout={event => setMenuHeight(event.nativeEvent.layout.height)} />
        {openScreen === 'compose' && (
          <PostComposerModal token={token} onCreated={refreshPosts} onClose={() => setOpenScreen(null)} />
        )}
        {openScreen === 'settings' && (
          <Modal visible animationType="slide" presentationStyle="fullScreen"
            onRequestClose={replayingTutorial ? () => setReplayingTutorial(false) : () => setOpenScreen(null)}>
            {replayingTutorial ? (
              <TutorialScreen onExit={() => setReplayingTutorial(false)} />
            ) : (
              <AppScreen>
                <View style={styles.settingsHeader}>
                  <Text accessibilityRole="header" style={styles.settingsTitle}>設定</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel="設定を閉じる"
                    style={styles.closeSettings} onPress={() => setOpenScreen(null)}>
                    <Text style={styles.closeSettingsText}>閉じる</Text>
                  </Pressable>
                </View>
                <UtilityScreen token={token} onLogout={onLogout} user={user}
                  onOpenTutorial={() => setReplayingTutorial(true)} />
              </AppScreen>
            )}
          </Modal>
        )}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  home: { flex: 1 },
  settingsHeader: { paddingHorizontal: 20, paddingVertical: 8, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: uiColors.border, marginBottom: 12 },
  settingsTitle: { fontSize: 20, fontWeight: '700', color: uiColors.text, flexShrink: 1 },
  closeSettings: { minHeight: 44, paddingLeft: 12, justifyContent: 'center' },
  closeSettingsText: { fontWeight: '600', color: uiColors.primary },
});
