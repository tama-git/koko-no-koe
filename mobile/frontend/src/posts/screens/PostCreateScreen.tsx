import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, ScrollView, KeyboardAvoidingView, Platform, Image } from 'react-native';
import * as Location from 'expo-location'; // 位置情報（GPS）を取得するためのモジュール
import * as ImagePicker from 'expo-image-picker'; // その場でカメラを起動して撮影するためのモジュール

import { requestCurrentLocation } from '../../location/locationRequest';
import type { LocationResult } from '../../location/locationRequest';
import { PostVisibilityOptions } from '../components/PostVisibilityOptions';

// AとBは別々に測位し、写真を替えたときは前の写真の測位結果を破棄する。
function usePostLocation(source: true | ImagePicker.ImagePickerAsset | null) {
  const [attempt, setAttempt] = useState(0);
  const [measurement, setMeasurement] = useState<{
    source: typeof source;
    attempt: number;
    result: LocationResult;
  } | null>(null);

  useEffect(() => {
    if (source === null) {
      setMeasurement(null);
      return;
    }
    let active = true;
    void requestCurrentLocation({
      requestPermission: () => Location.requestForegroundPermissionsAsync(),
      servicesEnabled: () => Location.hasServicesEnabledAsync(),
      getPosition: () => Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
    }).then(result => {
      if (active) setMeasurement({ source, attempt, result });
    });
    return () => { active = false; };
  }, [source, attempt]);

  return {
    result: measurement?.source === source && measurement.attempt === attempt ? measurement.result : null,
    retry: () => setAttempt(previous => previous + 1),
  };
}

const locationErrors = {
  denied: '位置情報の利用を設定で許可してから、再試行してください。',
  disabled: '端末の位置情報をオンにしてから、再試行してください。',
  timeout: '位置情報の取得に時間がかかっています。もう一度お試しください。',
  error: '位置情報を取得できませんでした。もう一度お試しください。',
};

/** 
 * メッセージ、写真、現在地を入力・取得し、確認画面へデータを渡すための画面 
 */
export function PostCreateScreen({ navigation }: { navigation: any }) {
  // 入力フォームの状態管理
  const [message, setMessage] = useState('');                  // 投稿するテキストメッセージ
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [isPublished, setIsPublished] = useState(true);
  const [cameraOpen, setCameraOpen] = useState(false);
  const cameraBusy = useRef(false);
  const initialLocation = usePostLocation(true);
  const photoLocation = usePostLocation(photo);
  const { result: postLocation, retry: retryLocation } = photo ? photoLocation : initialLocation;
  const canConfirm = !cameraOpen && postLocation?.status === 'ready';
  const locationLabel = photo ? '撮影後の位置' : '投稿作成開始時の位置';

  /**
   * その場でカメラを起動して写真を撮影する処理
   */
  const handleTakePhoto = async () => {
    if (cameraBusy.current) return;
    cameraBusy.current = true;
    setCameraOpen(true);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('エラー', 'カメラの利用が許可されませんでした。設定から許可してください。');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.8 });
      if (!result.canceled && result.assets[0]) {
        // カメラから戻った直後に、この写真にひも付く位置の取得を始める。
        setPhoto(result.assets[0]);
      }
    } catch {
      Alert.alert('エラー', 'カメラで写真を撮影できませんでした。もう一度お試しください。');
    } finally {
      cameraBusy.current = false;
      setCameraOpen(false);
    }
  };

  const handleGoToConfirm = () => {
    if (cameraBusy.current || postLocation?.status !== 'ready') return;
    if (!message.trim() && !photo) {
      Alert.alert('入力を確認してください', 'メッセージまたは写真を入力してください。');
      return;
    }

    const { latitude, longitude } = postLocation.coordinates;
    navigation.navigate('PostConfirm', {
      message,
      imageUri: photo?.uri ?? null,
      latitude,
      longitude,
      isPublished,
      imageMimeType: photo?.mimeType || undefined,
      imageFileName: photo?.fileName || undefined,
    });
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
          <TouchableOpacity style={styles.imagePickerButton} onPress={handleTakePhoto}
            activeOpacity={0.8} disabled={cameraOpen}>
            <Text style={styles.imagePickerButtonText}>
              {photo ? '写真を撮り直す' : 'カメラで写真を撮る'}
            </Text>
          </TouchableOpacity>

          {/* 撮影された画像のプレビュー表示エリア */}
          {photo && (
            <View style={styles.previewContainer}>
              <Image source={{ uri: photo.uri }} style={styles.previewImage} />
              <TouchableOpacity onPress={() => setPhoto(null)} style={styles.removeImageButton} disabled={cameraOpen}>
                <Text style={styles.removeImageButtonText}>写真を削除</Text>
              </TouchableOpacity>
            </View>
          )}

          {postLocation === null ? (
            <Text accessibilityLiveRegion="polite" style={styles.locationNotice}>
              {locationLabel}を取得中…
            </Text>
          ) : postLocation.status !== 'ready' && (
            <View style={styles.locationNotice}>
              <Text accessibilityLiveRegion="polite">{locationLabel}を取得できませんでした。</Text>
              <Text>{locationErrors[postLocation.status]}</Text>
              {photo && <Text>再試行する場合は撮影した場所で行ってください。</Text>}
              <TouchableOpacity accessibilityRole="button" onPress={retryLocation}
                style={styles.locationRetry} disabled={cameraOpen}>
                <Text style={styles.imagePickerButtonText}>位置情報の取得を再試行</Text>
              </TouchableOpacity>
            </View>
          )}

          <PostVisibilityOptions value={isPublished} onChange={setIsPublished} disabled={cameraOpen} />

          {/* 投稿位置が決まってから確認画面へ進む。 */}
          <TouchableOpacity 
            style={[styles.button, !canConfirm && styles.buttonDisabled]}
            onPress={handleGoToConfirm}
            activeOpacity={0.8}
            disabled={!canConfirm}
          >
            <Text style={styles.buttonText}>確認画面へ進む</Text>
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
  previewImage: { width: '100%', height: 180, borderRadius: 10, marginBottom: 8, resizeMode: 'contain' },
  removeImageButton: { paddingVertical: 4 },
  removeImageButtonText: { color: '#D9534F', fontSize: 13, fontWeight: '600' },
  button: { height: 52, backgroundColor: '#2C6049', borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  locationNotice: { marginBottom: 12, color: '#395647' },
  locationRetry: { minHeight: 44, justifyContent: 'center' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
