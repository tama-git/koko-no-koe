import React, { useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

import { createPost } from '../postService';
import type { PostPlaceDisplay } from '../postService';
import { PostPlaceCredits } from '../components/PostPlaceCredits';
import { uiColors } from '../../shared/uiColors';

export type PostConfirmDraft = {
  message: string;
  imageUri: string | null;
  imageAspectRatio?: number;
  latitude: number;
  longitude: number;
  isPublished: boolean;
  imageMimeType?: string;
  imageFileName?: string;
  placePreview?: PostPlaceDisplay | null;
};

type Props = {
  route: { params: PostConfirmDraft };
  navigation: { goBack: () => void; navigate: (screen: 'PostDetail', params: { postId: number }) => void };
  token: string;
  onCreated: () => void;
};

// 確認画面で写真をカードの幅と高さに収め、縦横比を保って表示する。
function ConfirmPhoto({ uri, initialAspectRatio }: { uri: string; initialAspectRatio?: number }) {
  const [availableWidth, setAvailableWidth] = useState(0);
  const [aspectRatio, setAspectRatio] = useState(
    initialAspectRatio && Number.isFinite(initialAspectRatio) && initialAspectRatio > 0 ? initialAspectRatio : 4 / 3,
  );
  const maxHeight = 320;
  const width = Math.min(availableWidth, maxHeight * aspectRatio);

  return (
    <View style={styles.photoFrame} onLayout={event => setAvailableWidth(event.nativeEvent.layout.width)}>
      {width > 0 && (
        <Image
          source={{ uri }}
          accessibilityLabel="投稿する写真"
          style={[styles.previewImage, { width, height: width / aspectRatio }]}
          resizeMode="contain"
          onLoad={({ nativeEvent: { source: { width, height } } }) => {
            const ratio = width / height;
            if (Number.isFinite(ratio) && ratio > 0) setAspectRatio(ratio);
          }}
        />
      )}
    </View>
  );
}

// 場所・写真・本文・公開範囲を投稿前のプレビューとして表示する。
export function PostConfirmScreen({ route, navigation, token, onCreated }: Props) {
  const { message, imageUri, imageAspectRatio, latitude, longitude, isPublished, imageMimeType, imageFileName, placePreview } = route.params;
  const hasPostLocation = Number.isFinite(latitude) && Math.abs(latitude) <= 90 &&
    Number.isFinite(longitude) && Math.abs(longitude) <= 180;
  const loadingPlace = hasPostLocation && placePreview === undefined;
  const locationLabel = hasPostLocation
    ? loadingPlace ? '投稿場所を取得中…' : placePreview?.label ?? 'この付近'
    : '入力画面に戻り、投稿位置を取得してください。';
  const busy = useRef(false);
  const [loading, setLoading] = useState(false); // 送信中の通信状態管理

  // 送信の多重実行を防ぎながら確定済みの内容を保存し、保存した投稿へ進む。
  const handleFinalSubmit = async () => {
    if (busy.current || !hasPostLocation || loadingPlace) return;
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

  const cannotSubmit = loading || !hasPostLocation || loadingPlace;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="入力画面に戻る" disabled={loading}
          onPress={navigation.goBack} style={styles.headerBack}>
          <Svg width={20} height={20} viewBox="0 0 24 24" accessible={false}
            fill="none" stroke={uiColors.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="m15 18-6-6 6-6" />
          </Svg>
        </Pressable>
        <Text accessibilityRole="header" style={styles.headerTitle}>投稿内容の確認</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        <View style={styles.content}>
          <View style={styles.intro}>
            <Text accessibilityRole="header" style={styles.title}>この声を残しますか？</Text>
            <Text style={styles.description}>投稿する前に内容を確認しましょう。</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.locationRow}>
              <Svg width={14} height={14} viewBox="0 0 24 24" accessible={false} style={styles.locationPin}
                fill="none" stroke={uiColors.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
                <Circle cx={12} cy={10} r={2.5} />
              </Svg>
              <Text accessibilityLiveRegion="polite" style={styles.locationText}>{locationLabel}</Text>
            </View>
            {placePreview?.attribution && <PostPlaceCredits sources={[placePreview.attribution]} compact />}
            {imageUri && <ConfirmPhoto key={imageUri} uri={imageUri} initialAspectRatio={imageAspectRatio} />}
            {message.trim() !== '' && <Text style={styles.message}>{message}</Text>}
          </View>

          <View style={[styles.card, styles.visibilityCard]}>
            <Svg width={20} height={20} viewBox="0 0 24 24" accessible={false} style={styles.visibilityIcon}
              fill="none" stroke={uiColors.primary} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
              {isPublished ? <>
                <Circle cx={12} cy={12} r={9} />
                <Ellipse cx={12} cy={12} rx={4} ry={9} />
                <Path d="M3 12h18" />
              </> : <>
                <Rect x={5} y={10} width={14} height={11} rx={2} />
                <Path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" />
              </>}
            </Svg>
            <View style={styles.visibilityText}>
              <Text style={styles.visibilityTitle}>{isPublished ? '公開' : '自分のみ'}</Text>
              <Text style={styles.description}>
                {isPublished ? '投稿場所の250m以内で他の人が読めます。' : '自分だけが閲覧できます。'}
              </Text>
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity accessibilityRole="button"
              style={[styles.button, cannotSubmit && styles.buttonDisabled]}
              onPress={handleFinalSubmit} activeOpacity={0.8} disabled={cannotSubmit}>
              <Text style={styles.buttonText}>{loading ? '送信中...' : 'この声を残す'}</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" style={styles.backButton}
              onPress={navigation.goBack} disabled={loading}>
              <Text style={styles.backButtonText}>内容を修正する</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/** 
 * 画面のスタイル定義
 */
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: uiColors.background },
  header: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: 12,
    borderBottomWidth: 1, borderBottomColor: uiColors.border },
  headerBack: { minHeight: 44, width: 44, alignItems: 'center', justifyContent: 'center' },
  headerSpacer: { width: 44 },
  headerTitle: { flex: 1, paddingVertical: 8, fontSize: 17, fontWeight: '600', textAlign: 'center', color: uiColors.text },
  scroll: { flex: 1 },
  container: { paddingHorizontal: 16, paddingVertical: 24, alignItems: 'center' },
  content: { width: '100%', maxWidth: 472, gap: 14 },
  intro: { paddingHorizontal: 4, marginBottom: 4, gap: 6 },
  title: { fontSize: 23, fontWeight: '700', color: uiColors.text },
  description: { fontSize: 14, lineHeight: 21, color: uiColors.primary },
  card: { backgroundColor: uiColors.surface, borderRadius: 12, padding: 14, gap: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: uiColors.border },
  locationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5 },
  locationPin: { flexShrink: 0, marginTop: 2 },
  locationText: { flex: 1, fontSize: 12, lineHeight: 18, color: uiColors.primary },
  message: { fontSize: 16, lineHeight: 24, color: uiColors.text },
  photoFrame: { width: '100%', alignItems: 'center' },
  previewImage: { borderRadius: 10 },
  visibilityCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  visibilityIcon: { flexShrink: 0, marginTop: 1 },
  visibilityText: { flex: 1, gap: 3 },
  visibilityTitle: { fontSize: 15, fontWeight: '600', color: uiColors.text },
  actions: { gap: 6 },
  button: { minHeight: 52, padding: 12, backgroundColor: uiColors.primaryFill, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: uiColors.onPrimary, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  backButton: { minHeight: 44, padding: 8, alignItems: 'center', justifyContent: 'center' },
  backButtonText: { color: uiColors.primary, fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
