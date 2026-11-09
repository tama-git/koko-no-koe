import { useState } from 'react';
import { Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '../../shared/components/AppScreen';
import { HomeMap } from '../../map/components/HomeMap';
import { PostBottomSheet } from '../components/PostBottomSheet';
import { MessageInputBar } from '../components/MessageInputBar';
import { PostComposerModal } from '../../posts/components/PostComposerModal';
import { PostDetailModal } from '../../posts/components/PostDetailModal';
import { OwnPostsModal } from '../../posts/components/OwnPostsModal';
import { usePostList } from '../../posts/usePostList';
import { UtilityScreen } from '../../utility/screens/UtilityScreen';

type Props = {
  token: string;
  busy: boolean;
  message: string;
  onLogout: () => Promise<void>;
};

/** トップ画面担当の編集場所。ログアウトの処理は認証担当に渡す。 */
export function HomeScreen({ token, busy, message, onLogout }: Props) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [inputBarHeight, setInputBarHeight] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedPost, setSelectedPost] = useState<number | null>(null);
  const [ownPostsOpen, setOwnPostsOpen] = useState(false);
  const [utilityOpen, setUtilityOpen] = useState(false);
  const publicPosts = usePostList(token, 'public', refreshKey);
  const refreshPosts = () => setRefreshKey(value => value + 1);
  const closePost = () => {
    setSelectedPost(null);
    refreshPosts();
  };
  const closeUtility = () => setUtilityOpen(false);
  return (
    <AppScreen edgeToEdge>
      <View style={{ flex: 1 }}>

        {/* 地図の上に、後から描画するボトムシートを重ねる */}
        <HomeMap posts={publicPosts.posts} onSelectPost={setSelectedPost} />
        <SafeAreaView pointerEvents="box-none" style={styles.topActions}>
          <View pointerEvents="box-none" style={styles.topActionRow}>
            <Pressable accessibilityRole="button" onPress={() => setOwnPostsOpen(true)} style={styles.topAction}>
              <Text numberOfLines={1} style={styles.topActionText}>自分の投稿</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setUtilityOpen(true)} style={styles.topAction}>
              <Text numberOfLines={1} style={styles.topActionText}>ユーティリティ</Text>
            </Pressable>
          </View>
        </SafeAreaView>
        {/* 投稿一覧のボトムシート */}
        <PostBottomSheet bottomInset={inputBarHeight} list={publicPosts} onSelectPost={setSelectedPost} />
        <MessageInputBar disabled={busy} onPress={() => setComposerOpen(true)}
          onLayout={event => setInputBarHeight(event.nativeEvent.layout.height)} />
        {composerOpen && <PostComposerModal token={token} onCreated={refreshPosts} onClose={() => setComposerOpen(false)} />}
        {selectedPost !== null && <PostDetailModal postId={selectedPost} token={token} onClose={closePost} onHidden={closePost} />}
        {ownPostsOpen && <OwnPostsModal token={token} refreshKey={refreshKey}
          onClose={() => setOwnPostsOpen(false)} onPostDeleted={refreshPosts} onVisibilityChanged={refreshPosts} />}
        {utilityOpen && (
          <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={closeUtility}>
            <UtilityScreen onClose={closeUtility} token={token} onLogout={onLogout} />
          </Modal>
        )}

      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  topActions: { position: 'absolute', top: 0, left: 0, right: 72 },
  topActionRow: { flexDirection: 'row', gap: 8, marginLeft: 12, marginVertical: 12 },
  topAction: { flexShrink: 1, paddingHorizontal: 12, minHeight: 44, justifyContent: 'center', borderRadius: 22, backgroundColor: '#FFFFFF', elevation: 3 },
  topActionText: { color: '#1D4030', fontSize: 15, fontWeight: '700' },
  container: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 32, paddingBottom: 32, alignItems: 'center' },
  content: { width: '100%', maxWidth: 440 },
  brandName: { color: '#1D4030', fontSize: 20, fontWeight: '700', marginBottom: 36 },
  title: { color: '#1C3D2D', fontSize: 25, fontWeight: '700', marginBottom: 12 },
  description: { color: '#79887B', fontSize: 12 },
  button: { height: 52, backgroundColor: '#2C6049', borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: 25 },
  buttonPressed: { opacity: 0.8 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  message: { color: '#705C38', backgroundColor: '#FCF6E9', overflow: 'hidden', borderRadius: 8, fontSize: 12, lineHeight: 19, marginTop: 14, padding: 12 },
});
