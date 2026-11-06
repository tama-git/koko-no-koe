import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, ScrollView, KeyboardAvoidingView, Platform, Image } from 'react-native';
import * as Location from 'expo-location'; // 位置情報（GPS）を取得するためのモジュール
import * as ImagePicker from 'expo-image-picker'; // その場でカメラを起動して撮影するためのモジュール

import { PostVisibilityOptions } from '../components/PostVisibilityOptions';

/** 
 * メッセージ、写真、現在地を入力・取得し、確認画面へデータを渡すための画面 
 */
export function PostCreateScreen({ navigation }: { navigation: any }) {
  // 入力フォームの状態管理
  const [message, setMessage] = useState('');                  // 投稿するテキストメッセージ
  const [imageUri, setImageUri] = useState<string | null>(null); // 撮影された写真の保存先URI
  const [isPublished, setIsPublished] = useState(true);          // 公開範囲
  const [loading, setLoading] = useState(false);               // 処理中（連打防止用）の状態管理
  const busy = useRef(false);
  const [imageMimeType, setImageMimeType] = useState<string | undefined>();
  const [imageFileName, setImageFileName] = useState<string | undefined>();

  /**
   * その場でカメラを起動して写真を撮影する処理
   */
  const handleTakePhoto = async () => {
    // デバイスのカメラ機能に対するアクセス許可をリクエスト
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('エラー', 'カメラの利用が許可されませんでした。設定から許可してください。');
      return;
    }

    // カメラを起動して撮影を実行
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true, // 撮影後にトリミング（切り抜き）を許可
      aspect: [4, 3],      // アスペクト比
      quality: 0.8,        // 画質設定
    });

    // ユーザーがキャンセルせず撮影完了した場合、画像のURIを状態に保存
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
      setImageMimeType(result.assets[0].mimeType || undefined);
      setImageFileName(result.assets[0].fileName || undefined);
    }
  };

  /**
   * 「確認画面へ進む」ボタンが押されたときの処理
   */
  const handleGoToConfirm = async () => {
    if (busy.current) return;
    if (!message.trim() && !imageUri) {
      Alert.alert('入力を確認してください', 'メッセージまたは写真を入力してください。');
      return;
    }
    busy.current = true;
    try {
      setLoading(true); // 処理中フラグをON

      // 位置情報のパーミッション（権限）をリクエスト
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('エラー', '位置情報の利用が許可されませんでした。設定から許可してください。');
        setLoading(false);
        return;
      }

      // 高精度な設定で現在のGPS座標（緯度・経度）を取得
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      const latitude = location.coords.latitude;   // 緯度
      const longitude = location.coords.longitude; // 経度

      // 画面遷移（navigation）を使って、確認画面にすべてのデータをバトンタッチする
      navigation.navigate('PostConfirm', {
        message,
        imageUri,
        latitude,
        longitude,
        isPublished,
        imageMimeType,
        imageFileName,
      });

    } catch (error: any) {
      // エラーハンドリング
      Alert.alert('エラー', error.message || '位置情報の取得に失敗しました');
    } finally {
      busy.current = false;
      // 処理終了後にローディングを解除
      setLoading(false);
    }
  };

  return (
    // キーボード表示時に画面が隠れないように調整するコンポーネント
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboard}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          
          {/* 画面タイトル */}
          <Text style={styles.title}>新規投稿作成</Text>

          {/* メッセージ入力セクション */}
          <Text style={styles.label}>メッセージ</Text>
          <TextInput
            style={styles.input}
            placeholder="いまどうしてる？"
            placeholderTextColor="#7D8C80"
            value={message}
            onChangeText={setMessage}
            multiline // 複数行入力を許可
          />

          {/* カメラ撮影セクション */}
          <Text style={styles.label}>写真の添付</Text>
          <TouchableOpacity style={styles.imagePickerButton} onPress={handleTakePhoto} activeOpacity={0.8}>
            <Text style={styles.imagePickerButtonText}>
              {imageUri ? '写真を撮り直す' : 'カメラで写真を撮る'}
            </Text>
          </TouchableOpacity>

          {/* 撮影された画像のプレビュー表示エリア */}
          {imageUri && (
            <View style={styles.previewContainer}>
              <Image source={{ uri: imageUri }} style={styles.previewImage} />
              <TouchableOpacity onPress={() => setImageUri(null)} style={styles.removeImageButton}>
                <Text style={styles.removeImageButtonText}>写真を削除</Text>
              </TouchableOpacity>
            </View>
          )}

          <PostVisibilityOptions value={isPublished} onChange={setIsPublished} disabled={loading} />

          {/* 確認画面へ進むボタン（処理中は連打防止のため無効化） */}
          <TouchableOpacity 
            style={[styles.button, loading && styles.buttonDisabled]} 
            onPress={handleGoToConfirm}
            activeOpacity={0.8}
            disabled={loading}
          >
            <Text style={styles.buttonText}>{loading ? '取得中...' : '確認画面へ進む'}</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** 
 * 画面のスタイル定義
 */
const styles = StyleSheet.create({
  keyboard: { flex: 1, backgroundColor: '#fff' },
  container: { flexGrow: 1, padding: 24, justifyContent: 'center', alignItems: 'center' },
  content: { width: '100%', maxWidth: 440 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 24, textAlign: 'center', color: '#1C3D2D' },
  label: { fontSize: 14, marginBottom: 8, fontWeight: '600', color: '#395647' },
  input: { borderWidth: 1, borderColor: '#DCE6DA', borderRadius: 10, padding: 14, height: 100, marginBottom: 16, textAlignVertical: 'top', fontSize: 15, backgroundColor: '#FBFCFA', color: '#1D4030' },
  imagePickerButton: { height: 46, borderWidth: 1, borderColor: '#2C6049', borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 16, backgroundColor: '#F3F7F4' },
  imagePickerButtonText: { color: '#2C6049', fontSize: 14, fontWeight: '600' },
  previewContainer: { alignItems: 'center', marginBottom: 20 },
  previewImage: { width: '100%', height: 180, borderRadius: 10, marginBottom: 8, resizeMode: 'cover' },
  removeImageButton: { paddingVertical: 4 },
  removeImageButtonText: { color: '#D9534F', fontSize: 13, fontWeight: '600' },
  button: { height: 52, backgroundColor: '#2C6049', borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
