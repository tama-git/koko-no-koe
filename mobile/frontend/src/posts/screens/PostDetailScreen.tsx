import React, { useState, useEffect, useRef } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, StyleSheet, Text, View, Image, ScrollView, ActivityIndicator, TouchableOpacity, SafeAreaView } from 'react-native';
import { deletePost, getPostById, PostApiError, hidePostApi } from '../postService';
import type { SavedPost } from '../postService';
import { PostLocationMap } from '../../map/components/PostLocationMap';
import { ReportScreen } from '../../reports/screens/ReportScreen';

/**
 * 投稿データの型定義
 */
export function PostDetailScreen({ route, navigation, token, onDeleted, onHidden}: {
  route: { params: { postId: number } };
  navigation: { goBack: () => void };
  token: string;
  onDeleted?: () => void;
  onHidden?: () => void;
}) {
  // 一覧画面から渡された投稿IDを受け取る
  const { postId } = route.params;

  const [post, setPost] = useState<SavedPost | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [hiding, setHidden] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const deletionPending = useRef(false);
  const highidingPending = useRef(false);

  /**
   * サーバーから特定の投稿詳細データを取得する処理
   */
  useEffect(() => {
    let active = true;
    setLoading(true);
    setPost(null);
    setError('');
    void getPostById(postId, token).then(data => {
      if (active) setPost(data);
    }).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : '投稿を取得できませんでした。');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [postId, token, revision]);

  const removePost = async () => {
    if (!onDeleted || deletionPending.current) return;
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
      <SafeAreaView style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#2C6049" />
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><Text style={styles.backButtonText}>戻る</Text></TouchableOpacity>
      </SafeAreaView>
    );
  }

  // データが見つからない場合
  if (!post) {
    return (
      <SafeAreaView style={styles.loaderContainer}>
        <Text style={styles.errorText}>{error || '投稿が見つかりませんでした。'}</Text>
        <TouchableOpacity onPress={() => setRevision(value => value + 1)} style={styles.backButton}><Text style={styles.backButtonText}>再取得</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><Text style={styles.backButtonText}>戻る</Text></TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (reportOpen && post.can_report === true) {
    return <ReportScreen postId={post.id} message={post.message} token={token} onClose={() => setReportOpen(false)} />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
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

          {/* 投稿内容を表示するカード */}
          <View style={styles.card}>
            
            {/* 投稿日時 */}
            {post.created_at && (
              <Text style={styles.dateText}>{post.created_at}</Text>
            )}

            {/* メッセージ本文 */}
            <Text style={styles.messageText}>
              {post.message ? post.message : '（メッセージなし）'}
            </Text>

            {/* 写真がある場合は表示 */}
            {post.image && (
              <Image source={{ uri: post.image, headers: { Authorization: `Bearer ${token}` } }} style={styles.postImage} />
            )}

            {/* 位置情報セクション */}
            <View style={styles.locationContainer}>
              <Text style={styles.locationTitle}>投稿場所</Text>
              {post.latitude !== null && post.longitude !== null ? <>
                <PostLocationMap coordinate={{ latitude: post.latitude, longitude: post.longitude }} />
                <Text style={styles.locationText}>緯度: {post.latitude.toFixed(4)}</Text>
                <Text style={styles.locationText}>経度: {post.longitude.toFixed(4)}</Text>
              </> : <Text style={styles.locationText}>位置情報なし</Text>}
            </View>

          </View>

          {/* 前の画面に戻るボタン */}
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
            disabled={deleting}
            activeOpacity={0.8}
          >
            <Text style={styles.backButtonText}>戻る</Text>
          </TouchableOpacity>
          {onDeleted && (
            <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: deleting, busy: deleting }}
              style={styles.deleteButton} disabled={deleting} onPress={confirmDeletion}>
              <Text style={styles.deleteButtonText}>{deleting ? '削除中…' : '投稿を削除'}</Text>
            </TouchableOpacity>
          )}

        </View>
      </ScrollView>
    </SafeAreaView>
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
    flex: 1,
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
    color: '#8CA397',
    marginBottom: 12,
  },
  messageText: {
    fontSize: 16,
    color: '#1D4030',
    lineHeight: 24,
    marginBottom: 16,
  },
  postImage: {
    width: '100%',
    height: 240,
    borderRadius: 10,
    marginBottom: 16,
    resizeMode: 'cover',
  },
  locationContainer: {
    backgroundColor: '#F3F7F4',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#DCE6DA',
  },
  locationTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2C6049',
    marginBottom: 4,
  },
  locationText: {
    fontSize: 13,
    color: '#5C7A6B',
    marginTop: 4,
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
