import React, { useState, useEffect, useRef } from 'react';
import { ActionSheetIOS, Alert, Linking, Platform, Pressable, StyleSheet, Text, View, Image, ScrollView, ActivityIndicator, TouchableOpacity, SafeAreaView, Modal } from 'react-native';
import { deletePost, getPostById, getPostImage, PostApiError, hidePostApi, updatePostVisibility } from '../postService';
import type { SavedPost } from '../postService';
import { formatPostDate } from '../formatPostDate';
import { getCurrentLocation } from '../../location/getCurrentLocation';
import { PostVisibilityOptions } from '../components/PostVisibilityOptions';
import { ReportScreen } from '../../reports/screens/ReportScreen';
import { ReactionBar } from '../../likes/components/ReactionBar';

const locationUnavailable = '現在地を取得できませんでした。もう一度お試しください。';
const cannotReadPost = 'この投稿は現在地から閲覧できません。';

async function measureViewerCoordinates() {
  const location = await getCurrentLocation();
  if (location.status !== 'ready') throw new PostApiError(locationUnavailable, 400);
  return location.coordinates;
}

function readErrorMessage(reason: unknown, fallback: string) {
  if (reason instanceof PostApiError) {
    if (reason.status === 400) return locationUnavailable;
    if (reason.status === 404) return cannotReadPost;
    if (reason.status === 401) return 'ログインの有効期限を確認し、ログインし直してください。';
  }
  return reason instanceof Error ? reason.message : fallback;
}

/**
 * 投稿データの型定義
 */
export function PostDetailScreen({ route, navigation, token, onDeleted, onHidden, onVisibilityChanged, embedded = false }: {
  route: { params: { postId: number } };
  navigation: { goBack: () => void };
  token: string;
  onDeleted?: () => void;
  onHidden?: () => void;
  onVisibilityChanged?: () => void;
  embedded?: boolean;
}) {
  // 一覧画面から渡された投稿IDを受け取る
  const { postId } = route.params;
  const Container = embedded ? View : SafeAreaView;

  const [post, setPost] = useState<SavedPost | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageError, setImageError] = useState('');
  const [imageRevision, setImageRevision] = useState(0);
  const [needsViewerLocation, setNeedsViewerLocation] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [savingVisibility, setSavingVisibility] = useState(false);
  const [hiding, setHidden] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const deletionPending = useRef(false);
  const visibilityPending = useRef(false);
  const highidingPending = useRef(false);

  /**
   * サーバーから特定の投稿詳細データを取得する処理
   */
  useEffect(() => {
    let active = true;
    setLoading(true);
    setPost(null);
    setError('');
    setImageUri(null);
    setImageError('');
    const load = async () => {
      try {
        let data: SavedPost;
        let needsLocation = false;
        try {
          data = await getPostById(postId, token);
        } catch (reason) {
          if (!active || !(reason instanceof PostApiError) || reason.status !== 400) throw reason;
          needsLocation = true;
          const coordinates = await measureViewerCoordinates();
          if (!active) return;
          data = await getPostById(postId, token, coordinates);
        }
        if (active) {
          setNeedsViewerLocation(needsLocation);
          setPost(data);
        }
      } catch (reason) {
        if (active) setError(readErrorMessage(reason, '投稿を取得できませんでした。'));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [postId, token, revision]);

  const imagePostId = post?.image ? post.id : null;
  useEffect(() => {
    if (imagePostId === null || imagePostId !== postId) return;
    let active = true;
    setImageError('');
    const load = async () => {
      try {
        const coordinates = needsViewerLocation ? await measureViewerCoordinates() : undefined;
        if (!active) return;
        const uri = await getPostImage(imagePostId, token, coordinates);
        if (active) setImageUri(uri);
      } catch (reason) {
        if (active) setImageError(readErrorMessage(reason, '写真を取得できませんでした。'));
      }
    };
    void load();
    return () => { active = false; };
  }, [imagePostId, postId, token, needsViewerLocation, imageRevision]);

  const removePost = async () => {
    if (!onDeleted || deletionPending.current || visibilityPending.current) return;
    deletionPending.current = true;
    setDeleting(true);
    try {
      await deletePost(postId, token);

      // 削除完了アラートを表示
      Alert.alert('投稿を削除しました', '自分の投稿一覧を更新します。');
    } catch (reason) {
      if (reason instanceof PostApiError && reason.status === 404) {
        Alert.alert('投稿が見つかりませんでした', '自分の投稿一覧を更新します。');
        onDeleted();
      } else {
        Alert.alert('削除を完了できませんでした', reason instanceof Error ? reason.message : '時間をおいてもう一度お試しください。');
      }
      return;
    } finally {
      deletionPending.current = false;
      setDeleting(false);
    }
    onDeleted();
  };

  const confirmDeletion = () => {
    Alert.alert('投稿を削除しますか？', '本文と写真が削除されます。削除後は元に戻せません。', [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除する', style: 'destructive', onPress: () => { void removePost(); } },
    ]);
  };

  const saveVisibility = async (next: boolean) => {
    if (!onVisibilityChanged || visibilityPending.current || deletionPending.current) return;
    visibilityPending.current = true;
    setSavingVisibility(true);
    try {
      await updatePostVisibility(postId, token, next);
      setPost(current => current?.id === postId ? { ...current, is_published: next } : current);
      onVisibilityChanged();
    } catch (reason) {
      Alert.alert('公開設定を変更できませんでした', reason instanceof Error ? reason.message : '時間をおいてもう一度お試しください。');
      setRevision(value => value + 1);
      onVisibilityChanged();
    } finally {
      visibilityPending.current = false;
      setSavingVisibility(false);
    }
  };

  const confirmVisibilityChange = (next: boolean) => {
    if (!post || (post.is_published === true) === next || post.is_admin_hidden === true) return;
    Alert.alert(
      next ? '投稿を公開しますか？' : '本人のみ公開に変更しますか？',
      next ? '他の会員もこの投稿を閲覧できるようになります。' : '他の会員の地図や一覧から外れます。',
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: '変更する', onPress: () => { void saveVisibility(next); } },
      ],
    );
  };

  /**
   * 投稿を非表示する実際の処理
   */
  const hidePost = async () => {
    if (!onHidden || highidingPending.current) return;
    highidingPending.current = true;
    setHidden(true);
    try {
      await hidePostApi(postId, token);
      Alert.alert('投稿を非表示にしました', 'この投稿は非表示になりました。自分の投稿一覧を更新します。');
    } catch (reason) {
      if (reason instanceof PostApiError && reason.status === 404) {
        Alert.alert('投稿が見つかりませんでした', '自分の投稿一覧を更新します。');
        onHidden();
      } else {
        Alert.alert('非表示を完了できませんでした', reason instanceof Error ? reason.message : '時間をおいてもう一度お試しください。');
      }
      return;
    } finally {
      highidingPending.current = false;
      setHidden(false);
    }
    onHidden();
  };

  /**
   * 投稿を非表示にするか確認するダイアログを表示する
   */
  const confirmHide = () => {
    Alert.alert('投稿を非表示にしますか？', 'この操作を行うと、この投稿は非表示になり、一度実行すると元に戻すことはできません。本当によろしいですか？', [
      { text: 'キャンセル', style: 'cancel' },
      { text: '非表示にする', style: 'destructive', onPress: () => { void hidePost(); } },
    ]);
  };
  
  const openPostActions = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions({
        options: ['通報', '非表示', 'キャンセル'],
        cancelButtonIndex: 2,     
      }, index => {
        if (index === 0) setReportOpen(true);
        if (index === 1) confirmHide();
      });
      return;
    }
    Alert.alert('投稿の操作', undefined, [
      { text: '通報', onPress: () => setReportOpen(true) },
      { text: '非表示', onPress: () => confirmHide() },
      { text: 'キャンセル', style: 'cancel' },
    ]);
  };

  // 読み込み中のインジケーター表示
  if (loading) {
    return (
      <Container style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#2C6049" />
        {!embedded && <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><Text style={styles.backButtonText}>戻る</Text></TouchableOpacity>}
      </Container>
    );
  }

  // データが見つからない場合
  if (!post) {
    return (
      <Container style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.loaderContainer}>
          <Text style={styles.errorText}>{error || '投稿が見つかりませんでした。'}</Text>
          <TouchableOpacity onPress={() => setRevision(value => value + 1)} style={styles.backButton}><Text style={styles.backButtonText}>再取得</Text></TouchableOpacity>
          {!embedded && <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><Text style={styles.backButtonText}>戻る</Text></TouchableOpacity>}
        </ScrollView>
      </Container>
    );
  }

  const report = reportOpen && post.can_report === true
    ? <ReportScreen postId={post.id} message={post.message} token={token} onClose={() => setReportOpen(false)} />
    : null;
  if (report && !embedded) return report;
  const postDate = formatPostDate(post.created_at);
  const hasMessage = post.message.trim().length > 0;
  const placeAttribution = post.place_name ? post.place_attribution : null;
  const sourceUrl = placeAttribution?.url;

  return (
    <Container style={styles.safeArea}>
      {report && <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setReportOpen(false)}>
        {report}
      </Modal>}
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.content}>
          
          {/* 画面タイトル */}
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.screenTitle}>投稿詳細</Text>
            {post.can_report === true && (
              <Pressable accessibilityRole="button" accessibilityLabel="投稿の操作" onPress={openPostActions} style={styles.actionButton}>
                <Text style={styles.actionText}>…</Text>
              </Pressable>
            )}
          </View>

          {onVisibilityChanged && post.is_admin_hidden !== true && (
            <PostVisibilityOptions value={post.is_published === true} onChange={confirmVisibilityChange}
              disabled={deleting || savingVisibility} />
          )}
          {savingVisibility && <ActivityIndicator color="#2C6049" accessibilityLabel="公開設定を保存中" />}

          {/* 投稿内容を表示するカード */}
          <View style={styles.card}>
            {post.is_admin_hidden === true && (
              <Text style={styles.locationText}>管理者により非表示</Text>
            )}

            <View>
              <Text style={[styles.dateText, styles.locationTitle]}>投稿場所</Text>
              <Text style={[styles.messageText, styles.placeName]}>{post.place_name ? `${post.place_name}周辺` : 'この付近'}</Text>
              {placeAttribution && (
                <View style={styles.placeCredits}>
                  <Text accessibilityRole="link" style={[styles.dateText, styles.placeCreditLink]}
                    onPress={() => { void Linking.openURL('https://www.geoapify.com/').catch(() => {}); }}>
                    Powered by Geoapify
                  </Text>
                  {sourceUrl ? (
                    <Text accessibilityRole="link" style={[styles.dateText, styles.placeCreditLink]}
                      onPress={() => { void Linking.openURL(sourceUrl).catch(() => {}); }}>
                      {placeAttribution.label}
                    </Text>
                  ) : <Text style={styles.dateText}>{placeAttribution.label}</Text>}
                </View>
              )}
            </View>

            {/* 写真がある場合は表示 */}
            {post.image && (imageError ? (
              <>
                <Text style={styles.errorText}>{imageError}</Text>
                <TouchableOpacity style={styles.backButton}
                  onPress={() => { setImageError(''); setImageRevision(value => value + 1); }}>
                  <Text style={styles.backButtonText}>写真を再取得</Text>
                </TouchableOpacity>
              </>
            ) : imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.postImage}
                onError={() => { setImageUri(null); setImageError('写真を表示できませんでした。'); }} />
            ) : <ActivityIndicator accessibilityLabel="写真を取得中" color="#2C6049" />)}

            {/* リアクションバー（公開投稿のみ表示） */}
            {post.is_published === true && post.is_admin_hidden !== true && (
              <ReactionBar postId={post.id} token={token} />
            )}

            {hasMessage && <Text style={styles.messageText}>{post.message}</Text>}
            {postDate ? <Text style={styles.dateText}>{postDate}</Text> : null}
          </View>

          {/* 単独表示時は画面内に戻るボタンを出し、シート内では固定ヘッダーを使う。 */}
          {!embedded && <TouchableOpacity
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
            disabled={deleting || savingVisibility}
            activeOpacity={0.8}
          >
            <Text style={styles.backButtonText}>戻る</Text>
          </TouchableOpacity>}
          {onDeleted && (
            <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: deleting || savingVisibility, busy: deleting }}
              style={styles.deleteButton} disabled={deleting || savingVisibility} onPress={confirmDeletion}>
              <Text style={styles.deleteButtonText}>{deleting ? '削除中…' : '投稿を削除'}</Text>
            </TouchableOpacity>
          )}

        </View>
      </ScrollView>
    </Container>
  );
}

/** 
 * 画面のスタイル定義
 */
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F9F7',
  },
  loaderContainer: {
    flexGrow: 1,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7F9F7',
  },
  errorText: {
    fontSize: 15,
    color: '#D9534F',
    fontWeight: '600',
  },
  container: {
    flexGrow: 1,
    padding: 20,
    alignItems: 'center',
  },
  content: {
    width: '100%',
    maxWidth: 440,
  },
  header: { minHeight: 44, justifyContent: 'center', marginBottom: 20 },
  actionButton: { position: 'absolute', right: 0, top: 0, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontSize: 26, fontWeight: '700', color: '#2C6049' },
  screenTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingHorizontal: 44,
    color: '#1C3D2D',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    gap: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2EBE0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  dateText: {
    fontSize: 12,
    color: '#5C7A6B',
  },
  messageText: {
    fontSize: 16,
    color: '#1D4030',
    lineHeight: 24,
  },
  postImage: {
    width: '100%',
    height: 240,
    borderRadius: 10,
    resizeMode: 'contain',
  },
  locationTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  placeName: {
    fontSize: 13,
    lineHeight: 20,
  },
  locationText: {
    fontSize: 13,
    color: '#5C7A6B',
    marginTop: 4,
  },
  placeCredits: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 8,
    rowGap: 4,
    marginTop: 8,
  },
  placeCreditLink: {
    textDecorationLine: 'underline',
  },
  backButton: {
    height: 48,
    backgroundColor: '#2C6049',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  deleteButton: {
    minHeight: 48,
    marginTop: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#B3261E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: { color: '#B3261E', fontSize: 15, fontWeight: '700' },
});
