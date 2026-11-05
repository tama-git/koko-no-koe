
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { clampSheetHeight, getClosestSheetLevel, getSheetHeights } from './bottomSheetGeometry';
import type { SheetLevel } from './bottomSheetGeometry';
import { loadPosts } from '../../posts/postService';
import type { SavedPost } from '../../posts/postService';

export function PostBottomSheet({ bottomInset = 0, token, refreshKey, onSelectPost }: {
  bottomInset?: number; token: string; refreshKey: number; onSelectPost: (id: number) => void;
}) {
  const [screenHeight, setScreenHeight] = useState(0);
  const [posts, setPosts] = useState<SavedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void loadPosts(token).then(data => { if (active) setPosts(data); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : '投稿を取得できませんでした。'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, refreshKey, retry]);

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

          <Text style={styles.title}>自分の投稿</Text>

          <ScrollView style={styles.list}>
            {loading && <ActivityIndicator color="#2C6049" />}
            {error ? <View>
              <Text accessibilityLiveRegion="polite">{error}</Text>
              <Pressable accessibilityRole="button" onPress={() => setRetry(value => value + 1)}><Text>再取得</Text></Pressable>
            </View> : null}
            {!loading && !error && posts.length === 0 && <Text>まだ投稿がありません。下のバーから投稿できます。</Text>}
            {posts.map(post => (
              <Pressable key={post.id} accessibilityRole="button" onPress={() => onSelectPost(post.id)} style={styles.post}>
                <Text style={styles.postText}>{post.message || '写真の投稿'}</Text>
                <Text>{post.is_published ? '公開' : '非公開'} ・ {new Date(post.created_at).toLocaleString('ja-JP')}</Text>
              </Pressable>
            ))}
          </ScrollView>
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
  list: {
    flex: 1,
    paddingHorizontal: 20,
  },
  post: {
    padding: 18,
    backgroundColor: '#F4F6F4',
    borderRadius: 12,
    marginBottom: 12,
  },
  postText: {
    fontSize: 14,
    color: '#333333',
  },
});
