import { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, Modal, View } from 'react-native';

import { AppScreen } from '../../shared/components/AppScreen';
import { HomeMap } from '../../map/components/HomeMap';
import { useCurrentLocation } from '../../location/useCurrentLocation';
import { filterNearbyPosts } from '../../map/filterNearbyPosts';
import { PostBottomSheet } from '../components/PostBottomSheet';
import { MessageInputBar } from '../components/MessageInputBar';
import { PostComposerModal } from '../../posts/components/PostComposerModal';
import { PostDetailModal } from '../../posts/components/PostDetailModal';
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
  const [selectedPost, setSelectedPost] = useState<{ id: number; own: boolean } | null>(null);
  const [selectedDistance, setSelectedDistance] = useState<{ meters: number | null } | null>(null);
  const [utilityOpen, setUtilityOpen] = useState(false);
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
  const selectNearbyPost = useCallback((id: number) => setSelectedPost({ id, own: false }), []);
  const selectOwnPost = (id: number) => setSelectedPost({ id, own: true });
  const refreshPosts = () => setRefreshKey(value => value + 1);
  const closePost = () => {
    setSelectedPost(null);
    refreshPosts();
  };
  const closeUtility = () => setUtilityOpen(false);
  return (
    <AppScreen edgeToEdge>
      <View style={{ flex: 1 }}>

        {/* 地図を画面全体に置き、シートの高さは操作ボタンと出典の位置だけに使う。 */}
        <HomeMap postPins={publicPosts.pins} postsLoading={publicPosts.loading} nearbyPostIds={nearbyPostIds}
          location={location} displayPosition={displayPosition} heading={heading} controlsInset={mapControlsInset} onSelectPost={selectNearbyPost}
          onShowDistance={meters => setSelectedDistance({ meters })} />
        <PostBottomSheet bottomInset={inputBarHeight} animatedHeight={sheetHeight}
          nearbyList={nearbyList} ownList={ownPosts} token={token} coordinates={viewerCoordinates}
          onSelectNearbyPost={selectNearbyPost} onSelectOwnPost={selectOwnPost} onOpenSettings={() => setUtilityOpen(true)} />
        <MessageInputBar disabled={busy} onPress={() => setComposerOpen(true)}
          onLayout={event => setInputBarHeight(event.nativeEvent.layout.height)} />
        {composerOpen && <PostComposerModal token={token} onCreated={refreshPosts} onClose={() => setComposerOpen(false)} />}
        {selectedPost !== null && (
          <PostDetailModal postId={selectedPost.id} token={token} onClose={closePost} onHidden={closePost}
            onDeleted={selectedPost.own ? closePost : undefined}
            onVisibilityChanged={selectedPost.own ? refreshPosts : undefined} />
        )}
        {selectedDistance !== null && (
          <PostDetailModal distanceMeters={selectedDistance.meters} onClose={() => setSelectedDistance(null)} />
        )}
        {utilityOpen && (
          <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={closeUtility}>
            <UtilityScreen onClose={closeUtility} token={token} onLogout={onLogout} user={user} />
          </Modal>
        )}

      </View>
    </AppScreen>
  );
}
