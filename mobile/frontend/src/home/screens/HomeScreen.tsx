import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentProps } from 'react';
import { Animated, BackHandler, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '../../shared/components/AppScreen';
import { HomeMap } from '../../map/components/HomeMap';
import { useCurrentLocation } from '../../location/useCurrentLocation';
import { filterNearbyPosts } from '../../map/filterNearbyPosts';
import { ownPostsToPins } from '../../map/postPins';
import type { MapPinSelection } from '../../map/postPins';
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
  const [selection, setSelection] = useState<MapPinSelection | null>(null);
  const [listOpenRequest, setListOpenRequest] = useState(0);
  const { location, displayPosition, heading, retryLocation } = useCurrentLocation();
  const viewerCoordinates = location.status === 'ready' ? location.coordinates : undefined;
  const publicPosts = usePostList(token, 'public', refreshKey, viewerCoordinates);
  const ownPosts = usePostList(token, 'own', refreshKey);
  const ownPins = useMemo(() => ownPostsToPins(ownPosts.posts), [ownPosts.posts]);
  const locationFailed = location.status !== 'loading' && location.status !== 'ready';
  const nearbyPosts = useMemo(() => location.status === 'ready'
    ? filterNearbyPosts(publicPosts.posts, location.coordinates.latitude, location.coordinates.longitude)
    : [], [location, publicPosts.posts]);
  const nearbyPostIds = useMemo(() => new Set(nearbyPosts.map(post => post.id)), [nearbyPosts]);
  const nearbyList = {
    ...publicPosts,
    posts: nearbyPosts,
    loading: publicPosts.loading || location.status === 'loading',
    error: locationFailed ? '現在地を取得できませんでした。位置情報の設定を確認して再取得してください。' : publicPosts.error,
    refresh: locationFailed ? retryLocation : publicPosts.refresh,
  };
  const selectListPost = (id: number) => {
    if (activePostMode.current.revision !== modeRevision) return;
    setSelection({ id, own: mode === 'own' || nearbyPosts.some(post => post.id === id && post.is_own === true) });
  };
  const selectMode = useCallback((nextMode: PostListScope) => {
    const current = activePostMode.current;
    if (nextMode === current.scope) return;
    const next = { scope: nextMode, revision: current.revision + 1 };
    activePostMode.current = next;
    setPostMode(next);
    setSelection(null);
  }, []);
  const selectMenuMode = (nextMode: PostListScope) => {
    selectMode(nextMode);
    setSelection(null);
    setListOpenRequest(request => request + 1);
  };
  const selectMapPin = useCallback((pinSelection: MapPinSelection, revision: number) => {
    // 切り替えボタンを押した直後は、Reactの再描画前に届いた旧ピンのイベントも破棄する。
    if (activePostMode.current.revision === revision) setSelection(pinSelection);
  }, []);
  const refreshPosts = () => setRefreshKey(value => value + 1);
  const closeDetail = () => setSelection(null);
  const finishPostChange = () => {
    setSelection(current => current === selection ? null : current);
    refreshPosts();
  };
  const showingDetail = selection !== null;

  useEffect(() => {
    if (!showingDetail) return;
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      setSelection(null);
      return true;
    });
    return () => back.remove();
  }, [showingDetail]);

  const detail: ComponentProps<typeof PostBottomSheet>['detail'] = !selection ? null : 'own' in selection ? {
    id: selection.id,
    renderPost: sheet => (
      <PostDetailScreen key={selection.id} route={{ params: { postId: selection.id } }} token={token}
        navigation={{ goBack: closeDetail }} sheet={sheet} onHidden={finishPostChange}
        onDeleted={selection.own ? finishPostChange : undefined}
        onVisibilityChanged={selection.own ? refreshPosts : undefined}
        onPlaceChanged={(postId, place) => {
          ownPosts.updatePlaceDisplay(postId, place);
          publicPosts.updatePlaceDisplay(postId, place);
        }} />
    ),
  } : { id: selection.id, distanceNotice: <PostDistanceNotice distanceMeters={selection.distanceMeters} /> };
  return (
    <AppScreen edgeToEdge>
      <View style={styles.home}>
        {/* 地図を画面全体に置き、シートの高さは操作ボタンと出典の位置だけに使う。 */}
        <HomeMap postPins={mode === 'own' ? ownPins : publicPosts.pins} modeRevision={modeRevision} nearbyPostIds={nearbyPostIds}
          selectedPin={selection}
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
