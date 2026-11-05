import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { createPost } from '../postService'; // バックエンドにデータを送信するAPI関数

/** 
 * 入力画面から渡されたデータ（メッセージ・写真・位置情報・公開設定）を確認し、最終送信を行う画面 
 */
export function PostConfirmScreen({ route, navigation, token, onCreated }: { route: any; navigation: any; token: string; onCreated: () => void }) {
  // 入力画面（PostCreateScreen）から navigation.navigate で渡されたパラメータを受け取る
  const { message, imageUri, latitude, longitude, isPublished, imageMimeType, imageFileName } = route.params;
  const busy = useRef(false);
  const [loading, setLoading] = useState(false); // 送信中の通信状態管理

  /**
   * 「この内容で投稿する」ボタンが押されたときの最終送信処理
   */
  const handleFinalSubmit = async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      setLoading(true); // 送信中フラグをON

      // バックエンド（Django）へデータを送信
      const saved = await createPost({
        message,
        image: imageUri,
        latitude,
        longitude,
        is_published: isPublished,
        imageMimeType,
        imageFileName,
      }, token);
      onCreated();

      // 送信成功時のアラート表示（OKを押したら最初の画面に戻る）
      Alert.alert('成功', '投稿が完了しました！', [
        { 
          text: 'OK', 
          onPress: () => navigation.navigate('PostDetail', { postId: saved.id })
        }
      ]);
    } catch (error: any) {
      // エラーハンドリング
      Alert.alert('エラー', error.message || '投稿に失敗しました');
    } finally {
      busy.current = false;
      // 処理終了後にローディングを解除
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.content}>
        
        {/* 画面タイトル */}
        <Text style={styles.title}>投稿内容の確認</Text>
        {/* 確認用のカード型レイアウト */}
        <View style={styles.card}>
          <Text style={styles.label}>【メッセージ】</Text>
          <Text style={styles.value}>{message ? message : '（メッセージなし）'}</Text>

          <Text style={styles.label}>【写真】</Text>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.previewImage} />
          ) : (
            <Text style={styles.value}>（写真なし）</Text>
          )}

          <Text style={styles.label}>【位置情報】</Text>
          <Text style={styles.value}>緯度: {latitude.toFixed(4)} / 経度: {longitude.toFixed(4)}</Text>

          <Text style={styles.label}>【公開設定】</Text>
          <Text style={styles.value}>{isPublished ? '公開する' : '非公開'}</Text>
        </View>

        {/* 最終送信ボタン */}
        <TouchableOpacity 
          style={[styles.button, loading && styles.buttonDisabled]} 
          onPress={handleFinalSubmit}
          activeOpacity={0.8}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? '送信中...' : 'この内容で投稿する'}</Text>
        </TouchableOpacity>

        {/* 入力画面に戻るための修正ボタン */}
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
          disabled={loading}
        >
          <Text style={styles.backButtonText}>入力画面に戻って修正する</Text>
        </TouchableOpacity>

      </View>
    </ScrollView>
  );
}

/** 
 * 画面のスタイル定義
 */
const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F7F9F7' },
  content: { width: '100%', maxWidth: 440 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: '#1C3D2D' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: '#E2EBE0' },
  label: { fontSize: 13, fontWeight: '600', color: '#5C7A6B', marginTop: 12, marginBottom: 4 },
  value: { fontSize: 15, color: '#1D4030', lineHeight: 22 },
  previewImage: { width: '100%', height: 200, borderRadius: 8, marginTop: 4, resizeMode: 'cover' },
  button: { height: 52, backgroundColor: '#2C6049', borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  backButton: { height: 44, alignItems: 'center', justifyContent: 'center' },
  backButtonText: { color: '#2C6049', fontSize: 14, fontWeight: '600' },
});
