import React, { useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { ActionSheetIOS, Alert, BackHandler, Platform, Pressable, StyleSheet, Text, View, Image, ScrollView, ActivityIndicator, TouchableOpacity, SafeAreaView, Modal } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { deletePost, getPostById, getPostImage, getPostPlaceDisplay, PostApiError, hidePostApi, updatePostVisibility } from '../postService';
import type { PostPlaceDisplay, SavedPost } from '../postService';
import { formatPostDate } from '../formatPostDate';
import { getCurrentLocation } from '../../location/getCurrentLocation';
import { PostManagementMenu } from '../components/PostManagementMenu';
import { PostPlaceCredits } from '../components/PostPlaceCredits';
import { PostPlaceEditorScreen } from './PostPlaceEditorScreen';
import { ReportScreen } from '../../reports/screens/ReportScreen';
import { ReactionBar } from '../../likes/components/ReactionBar';

const locationUnavailable = '現在地を取得できませんでした。もう一度お試しください。';
const cannotReadPost = 'この投稿は現在地から閲覧できません。';
const maxPhotoHeight = 320;

export type PostDetailSheetControls = {
  compact: boolean;
  headerDivider: ReactNode;
  onExpand: () => void;
  onHeaderLayout: (event: LayoutChangeEvent) => void;
};

function PostDetailPhoto({ uri, onError }: { uri: string; onError: () => void }) {
  const [aspectRatio, setAspectRatio] = useState(4 / 3);

  return (
    <Image
      source={{ uri }}
      style={[styles.postImage, { aspectRatio, maxWidth: maxPhotoHeight * aspectRatio }]}
      resizeMode="contain"
      onLoad={({ nativeEvent: { source: { width, height } } }) => {
        const ratio = width / height;
        if (Number.isFinite(ratio) && ratio > 0) setAspectRatio(ratio);
      }}
      onError={onError}
    />
  );
}

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
export function PostDetailScreen({ route, navigation, token, onDeleted, onHidden, onVisibilityChanged, onPlaceChanged, sheet }: {
  route: { params: { postId: number } };
  navigation: { goBack: () => void };
  token: string;
  onDeleted?: () => void;
  onHidden?: () => void;
  onVisibilityChanged?: () => void;
  onPlaceChanged?: (postId: number, place: PostPlaceDisplay) => void;
  sheet?: PostDetailSheetControls;
}) {
  // 一覧画面から渡された投稿IDを受け取る
  const { postId } = route.params;
  const Container = sheet ? View : SafeAreaView;
  const containerStyle = [styles.screen, !sheet && styles.standalone];
  const compact = sheet?.compact ?? false;

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
  const [managementPostId, setManagementPostId] = useState<number | null>(null);
  const [editingPlacePostId, setEditingPlacePostId] = useState<number | null>(null);
  const deletionPending = useRef(false);
  const visibilityPending = useRef(false);
  const highidingPending = useRef(false);
  const isOwnPost = post?.id === postId && post.is_own === true;
  const canChangeVisibility = isOwnPost && Boolean(onVisibilityChanged) && post.is_admin_hidden !== true;
  const showingManagement = !compact && isOwnPost && managementPostId === postId;

  useEffect(() => {
    if (compact) setManagementPostId(null);
  }, [compact]);

  useEffect(() => {
    if (!showingManagement) return;
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      setManagementPostId(null);
      return true;
    });
    return () => back.remove();
  }, [showingManagement]);

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
    if (!isOwnPost || !onDeleted || deletionPending.current || visibilityPending.current) return;
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
    if (!canChangeVisibility || !onVisibilityChanged || visibilityPending.current || deletionPending.current) return;
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
    if (!canChangeVisibility || (post.is_published === true) === next) return;
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

  const actionsBusy = deleting || savingVisibility || hiding;
  const canOpenActions = !loading && post?.id === postId && (isOwnPost || post.can_report === true);
  const header = (
    <View style={[styles.header, sheet ? styles.sheetHeader : styles.standaloneHeader]} onLayout={sheet?.onHeaderLayout}>
      <Pressable accessibilityRole="button" style={styles.detailBackButton}
        onPress={navigation.goBack} disabled={!sheet && actionsBusy}>
        <Text style={styles.detailBackText}>{sheet ? '〈 一覧に戻る' : '〈 戻る'}</Text>
      </Pressable>
      {canOpenActions && (
        <Pressable accessibilityRole="button"
          accessibilityLabel={isOwnPost ? (showingManagement ? '投稿管理メニューを閉じる' : '投稿を管理') : '投稿の操作'}
          accessibilityState={{ disabled: actionsBusy, busy: actionsBusy, expanded: isOwnPost ? showingManagement : undefined }}
          disabled={actionsBusy} style={styles.actionButton}
          onPress={() => {
            if (sheet?.compact) sheet.onExpand();
            if (isOwnPost) setManagementPostId(showingManagement ? null : postId);
            else openPostActions();
          }}>
          {actionsBusy ? <ActivityIndicator color="#2C6049" /> : <Text style={styles.actionText}>…</Text>}
        </Pressable>
      )}
    </View>
  );

  // 読み込み中のインジケーター表示
  if (loading) {
    return (
      <Container style={containerStyle}>
        {header}
        {sheet?.headerDivider}
        {!compact && <View style={styles.loaderContainer}><ActivityIndicator size="large" color="#2C6049" /></View>}
      </Container>
    );
  }

  // データが見つからない場合
  if (!post || post.id !== postId) {
    return (
      <Container style={containerStyle}>
        {header}
        {sheet?.headerDivider}
        {!compact && (
          <ScrollView contentContainerStyle={styles.loaderContainer}>
            <Text style={styles.errorText}>{error || '投稿が見つかりませんでした。'}</Text>
            <TouchableOpacity onPress={() => setRevision(value => value + 1)} style={styles.backButton}><Text style={styles.backButtonText}>再取得</Text></TouchableOpacity>
          </ScrollView>
        )}
      </Container>
    );
  }

  const report = reportOpen && post.can_report === true
    ? <ReportScreen postId={post.id} message={post.message} token={token} onClose={() => setReportOpen(false)} />
    : null;
  if (report && !sheet) return report;
  const postDate = formatPostDate(post.created_at);
  const hasMessage = post.message.trim().length > 0;
  const place = getPostPlaceDisplay(post);
  const closeManagement = () => setManagementPostId(null);
  const fromManagement = (action: () => void) => {
    closeManagement();
    action();
  };

  return (
    <Container style={containerStyle}>
      {report && <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setReportOpen(false)}>
        {report}
      </Modal>}
      {isOwnPost && editingPlacePostId === postId && (
        <PostPlaceEditorScreen postId={postId} token={token} currentPlace={place}
          selectedPlaceId={post.manual_place?.place_id ?? null}
          onClose={() => setEditingPlacePostId(null)}
          onSaved={updated => {
            setPost(current => current?.id === postId ? { ...current, ...updated } : current);
            onPlaceChanged?.(postId, updated.place_display);
            setEditingPlacePostId(null);
          }}
        />
      )}
      {header}
      {sheet?.headerDivider}
      <View style={styles.body} pointerEvents={compact ? 'none' : 'auto'}>
        <ScrollView contentContainerStyle={[styles.scrollContent, sheet && styles.sheetScrollContent]}
          accessibilityElementsHidden={compact || showingManagement}
          importantForAccessibility={compact || showingManagement ? 'no-hide-descendants' : 'auto'}>
          <View style={styles.card}>
            <View style={styles.placeHeading}>
              <Text style={styles.placeLabel}>投稿場所</Text>
              <View style={styles.placeNameRow}>
                <Svg accessible={false} style={styles.placePin} width={16} height={16} viewBox="0 0 24 24"
                  fill="none" stroke="#2C6049" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
                  <Circle cx={12} cy={10} r={2.5} />
                </Svg>
                <Text accessibilityRole="header" style={styles.placeName}>{place.label}</Text>
              </View>
            </View>
            {post.is_admin_hidden === true && (
              <Text style={styles.dateText}>管理者により非表示</Text>
            )}

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
              <PostDetailPhoto key={post.id} uri={imageUri}
                onError={() => { setImageUri(null); setImageError('写真を表示できませんでした。'); }} />
            ) : <ActivityIndicator accessibilityLabel="写真を取得中" color="#2C6049" />)}

            {/* リアクションバー（公開投稿のみ表示） */}
            {post.is_published === true && post.is_admin_hidden !== true && (
              <ReactionBar postId={post.id} token={token} />
            )}

            {hasMessage && <Text style={styles.messageText}>{post.message}</Text>}
            {postDate ? <Text style={styles.dateText}>{postDate}</Text> : null}
            {place.attribution && <PostPlaceCredits sources={[place.attribution]} compact />}
          </View>
        </ScrollView>
        {showingManagement && (
          <PostManagementMenu visibility={post.is_published} adminHidden={post.is_admin_hidden === true}
            onChangeVisibility={canChangeVisibility
              ? () => fromManagement(() => confirmVisibilityChange(post.is_published !== true)) : undefined}
            onEditPlace={() => fromManagement(() => setEditingPlacePostId(postId))}
            onDelete={onDeleted ? () => fromManagement(confirmDeletion) : undefined}
            onClose={closeManagement} />
        )}
      </View>
    </Container>
  );
}

/** 
 * 画面のスタイル定義
 */
const styles = StyleSheet.create({
  screen: { flex: 1 },
  standalone: { backgroundColor: '#FFFFFF' },
  loaderContainer: {
    flexGrow: 1,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 15,
    color: '#D9534F',
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 8,
    paddingBottom: 16,
  },
  sheetScrollContent: { paddingTop: 8 },
  body: { flex: 1, minHeight: 0, width: '100%', maxWidth: 472, alignSelf: 'center' },
  card: {
    paddingHorizontal: 8,
    paddingVertical: 10,
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderColor: '#DDDAD2',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
  },
  header: { width: '100%', flexShrink: 0, minHeight: 44, gap: 8, flexDirection: 'row', alignItems: 'center' },
  sheetHeader: { paddingHorizontal: 20 },
  standaloneHeader: { maxWidth: 472, alignSelf: 'center', paddingHorizontal: 12 },
  placeHeading: { gap: 3 },
  placeLabel: { fontSize: 12, fontWeight: '600', color: '#53645A' },
  placeNameRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  placePin: { flexShrink: 0, marginTop: 3 },
  placeName: { flex: 1, minWidth: 0, fontSize: 18, fontWeight: '600', color: '#1D4030' },
  actionButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontSize: 24, fontWeight: '700', color: '#2C6049' },
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
    alignSelf: 'center',
    maxHeight: maxPhotoHeight,
    marginVertical: 2,
    borderRadius: 10,
    backgroundColor: '#F7F9F7',
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
  detailBackButton: { flex: 1, minHeight: 44, justifyContent: 'center' },
  detailBackText: { color: '#1D4030', fontSize: 16, fontWeight: '700' },
});
