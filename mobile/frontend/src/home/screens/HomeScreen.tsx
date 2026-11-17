import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, BackHandler, View } from 'react-native';

import { AppScreen } from '../../shared/components/AppScreen';
import { HomeMap } from '../../map/components/HomeMap';
import { useCurrentLocation } from '../../location/useCurrentLocation';
import { filterNearbyPosts } from '../../map/filterNearbyPosts';
import { PostBottomSheet } from '../components/PostBottomSheet';
import { MessageInputBar } from '../components/MessageInputBar';
import { PostComposerModal } from '../../posts/components/PostComposerModal';
import { PostDistanceNotice } from '../../posts/components/PostDetailModal';
import { PostDetailScreen } from '../../posts/screens/PostDetailScreen';
import { usePostList } from '../../posts/usePostList';
import { UtilityScreen } from '../../utility/screens/UtilityScreen';

type Props = {
  token: string;
  busy: boolean;
  message: string;
  onLogout: () => Promise<void>;
  user: { name: string; email: string };
};

/** トップ画面担当の編集場所。ログアウトの処理は認証担当に渡す。 */
export function HomeScreen({ token, busy, message, onLogout, user }: Props) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [inputBarHeight, setInputBarHeight] = useState(0);
  const sheetHeight = useRef(new Animated.Value(0)).current;
  const mapControlsInset = useMemo(() => Animated.add(sheetHeight, inputBarHeight), [sheetHeight, inputBarHeight]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selection, setSelection] = useState<{ id: number; own: boolean } | { id: number; distanceMeters: number | null } | null>(null);
  const { location, displayPosition, heading, retryLocation } = useCurrentLocation();
  const viewerCoordinates = location.status === 'ready' ? location.coordinates : undefined;
  const publicPosts = usePostList(token, 'public', refreshKey, viewerCoordinates);
  const ownPosts = usePostList(token, 'own', refreshKey);
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
  const selectNearbyPost = useCallback((id: number) => setSelection({ id, own: false }), []);
  const selectOwnPost = (id: number) => setSelection({ id, own: true });
  const showDistance = useCallback((id: number, distanceMeters: number | null) => setSelection({ id, distanceMeters }), []);
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

  const detail = !selection ? null : 'own' in selection ? (
    <PostDetailScreen key={selection.id} route={{ params: { postId: selection.id } }} token={token}
      navigation={{ goBack: closeDetail }} embedded onHidden={finishPostChange}
      onDeleted={selection.own ? finishPostChange : undefined}
      onVisibilityChanged={selection.own ? refreshPosts : undefined} />
  ) : <PostDistanceNotice distanceMeters={selection.distanceMeters} />;
  return (
    <AppScreen edgeToEdge>
      <View style={{ flex: 1 }}>

        {/* 地図を画面全体に置き、シートの高さは操作ボタンと出典の位置だけに使う。 */}
        <HomeMap postPins={publicPosts.pins} postsLoading={publicPosts.loading} nearbyPostIds={nearbyPostIds}
          selectedPin={selection}
          location={location} displayPosition={displayPosition} heading={heading} controlsInset={mapControlsInset} onSelectPost={selectNearbyPost}
          onShowDistance={showDistance} />
        <PostBottomSheet bottomInset={inputBarHeight} animatedHeight={sheetHeight}
          nearbyList={nearbyList} ownList={ownPosts} token={token} coordinates={viewerCoordinates}
          detail={detail} onCloseDetail={closeDetail}
          onSelectNearbyPost={selectNearbyPost} onSelectOwnPost={selectOwnPost}
          settingsMenu={<UtilityScreen token={token} onLogout={onLogout} user={user} />} />
        <MessageInputBar disabled={busy} onPress={() => setComposerOpen(true)}
          onLayout={event => setInputBarHeight(event.nativeEvent.layout.height)} />
        {composerOpen && <PostComposerModal token={token} onCreated={refreshPosts} onClose={() => setComposerOpen(false)} />}
      </View>
    </AppScreen>
  );
}
