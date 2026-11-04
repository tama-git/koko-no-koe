import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Image, ScrollView, ActivityIndicator, TouchableOpacity, SafeAreaView } from 'react-native';
import { getPostById } from '../postService'; // バックエンドから個別データを取得するAPI

/**
 * 投稿データの型定義
 */
interface PostDetail {
  id: number;
  message: string;
  image?: string | null;
  latitude: number;
  longitude: number;
  is_published: boolean;
  created_at?: string;
}

export function PostDetailScreen({ route, navigation }: { route: any; navigation: any }) {
  // 一覧画面から渡された投稿IDを受け取る
  const { postId } = route.params;

  const [post, setPost] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  /**
   * サーバーから特定の投稿詳細データを取得する処理
   */
  const fetchPostDetail = async () => {
    try {
      setLoading(true);
      // バックエンドからデータを取得
      const data = await getPostById(postId);
      setPost(data);
    } catch (error) {
      console.error('投稿詳細の取得に失敗しました:', error);
    } finally {
      setLoading(false);
    }
  };

  // 画面を開いたときにデータを取得
  useEffect(() => {
    fetchPostDetail();
  }, [postId]);

  // 読み込み中のインジケーター表示
  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#2C6049" />
      </View>
    );
  }

  // データが見つからない場合
  if (!post) {
    return (
      <View style={styles.loaderContainer}>
        <Text style={styles.errorText}>投稿が見つかりませんでした。</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.content}>
          
          {/* 画面タイトル */}
          <Text style={styles.screenTitle}>投稿詳細</Text>

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
              <Image source={{ uri: post.image }} style={styles.postImage} />
            )}

            {/* 位置情報セクション */}
            <View style={styles.locationContainer}>
              <Text style={styles.locationTitle}>📍 撮影場所の位置情報</Text>
              <Text style={styles.locationText}>緯度: {post.latitude.toFixed(4)}</Text>
              <Text style={styles.locationText}>経度: {post.longitude.toFixed(4)}</Text>
            </View>

          </View>

          {/* 前の画面に戻るボタン */}
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Text style={styles.backButtonText}>戻る</Text>
          </TouchableOpacity>

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
  screenTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
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
});