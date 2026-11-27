import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Keyboard, KeyboardAvoidingView, Modal, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { AppScreen } from '../../shared/components/AppScreen';
import { PostPlaceCredits } from '../components/PostPlaceCredits';
import { searchPostPlaceCandidates, updatePostPlaceTag } from '../postService';
import type { PostPlaceCandidate, PostPlaceDisplay, PostPlaceTag } from '../postService';
import { uiColors } from '../../shared/uiColors';

const categoryLabels = [
  ['entertainment.museum', '博物館・美術館'],
  ['education.library', '図書館'],
  ['tourism.sights.city_hall', '公共施設'],
  ['public_transport.train', '鉄道'],
  ['public_transport.subway', '地下鉄'],
  ['leisure.park', '公園'],
  ['commercial.shopping_mall', '商業施設'],
  ['commercial.department_store', '百貨店'],
  ['catering.cafe', 'カフェ'],
  ['catering.restaurant', '飲食店'],
  ['tourism.attraction', '観光施設'],
  ['tourism.sights', '観光施設'],
];

// 施設のカテゴリを候補一覧用の日本語ラベルに変換する。
function formatCategory(categories: string[]) {
  return categoryLabels.find(([key]) => categories.some(category => category === key || category.startsWith(`${key}.`)))?.[1] ?? '施設';
}

type SearchResult =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'ready'; candidates: PostPlaceCandidate[] };

// 投稿地点周辺の施設を検索し、手動の場所タグを設定または解除する画面。
export function PostPlaceEditorScreen({ postId, token, currentPlace, selectedPlaceId, onClose, onSaved }: {
  postId: number;
  token: string;
  currentPlace: PostPlaceDisplay;
  selectedPlaceId: string | null;
  onClose: () => void;
  onSaved: (place: PostPlaceTag) => void;
}) {
  const [input, setInput] = useState('');
  const [request, setRequest] = useState({ q: '' });
  const [results, setResults] = useState<SearchResult>({ state: 'loading' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<{ placeId: string | null; message: string } | null>(null);
  const pendingSave = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let active = true;
    void searchPostPlaceCandidates(postId, token, request.q).then(
      candidates => { if (active) setResults({ state: 'ready', candidates }); },
      reason => {
        if (active) setResults({
          state: 'error',
          message: reason instanceof Error ? reason.message : '施設候補を取得できませんでした。',
        });
      },
    );
    return () => { active = false; };
  }, [postId, token, request]);

  // 施設名の入力を整え、候補をサーバーへ問い合わせ直す。
  const search = (q: string) => {
    if (pendingSave.current || results.state === 'loading') return;
    Keyboard.dismiss();
    setSaveError(null);
    setResults({ state: 'loading' });
    setRequest({ q: q.trim() });
  };

  // 保存処理が終わっているときに場所タグ編集を閉じる。
  const close = () => {
    if (pendingSave.current) return;
    Keyboard.dismiss();
    onClose();
  };

  // 選んだ施設IDを保存する。自動設定に戻すときは施設IDにnullを渡す。
  const save = async (placeId: string | null) => {
    if (pendingSave.current) return;
    pendingSave.current = true;
    Keyboard.dismiss();
    setSaveError(null);
    setSaving(true);
    try {
      const updated = await updatePostPlaceTag(postId, token, placeId);
      if (mounted.current) onSaved(updated);
    } catch (reason) {
      if (mounted.current) setSaveError({
        placeId,
        message: reason instanceof Error ? reason.message : '場所を変更できませんでした。',
      });
    } finally {
      pendingSave.current = false;
      if (mounted.current) setSaving(false);
    }
  };

  const searchDisabled = saving || results.state === 'loading';
  const candidates = results.state === 'ready' ? results.candidates : [];
  const sources = candidates.map(candidate => candidate.attribution);
  if (currentPlace.attribution) sources.push(currentPlace.attribution);

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={close}>
      <AppScreen>
        <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>場所を変更</Text>
            <Pressable accessibilityRole="button" onPress={close} disabled={saving} style={styles.textButton}>
              <Text style={styles.buttonText}>閉じる</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.currentPlace}>
              <Text style={styles.secondary}>現在の場所</Text>
              <Text style={styles.name}>{currentPlace.label}</Text>
              <Pressable accessibilityRole="button" disabled={saving} onPress={() => { void save(null); }}
                style={styles.textButton}>
                <Text style={styles.buttonText}>自動設定に戻す</Text>
              </Pressable>
            </View>
            <View style={styles.searchRow}>
              <TextInput accessibilityLabel="施設名" value={input} onChangeText={setInput}
                editable={!saving} maxLength={100} placeholder="施設名を入力"
                placeholderTextColor={uiColors.primary} returnKeyType="search" style={styles.input}
                onSubmitEditing={() => search(input)} />
              <Pressable accessibilityRole="button" disabled={searchDisabled} onPress={() => search(input)}
                style={[styles.searchButton, searchDisabled && styles.disabled]}>
                <Text style={styles.searchButtonText}>検索</Text>
              </Pressable>
            </View>
            {saveError && (
              <View>
                <Text accessibilityLiveRegion="polite" style={styles.error}>{saveError.message}</Text>
                <Pressable accessibilityRole="button" onPress={() => { void save(saveError.placeId); }} style={styles.textButton}>
                  <Text style={styles.buttonText}>もう一度保存</Text>
                </Pressable>
              </View>
            )}
            {saving && <ActivityIndicator accessibilityLabel="場所を保存中" color={uiColors.primary} />}
            {results.state === 'loading' && <ActivityIndicator accessibilityLabel="施設候補を読み込み中" color={uiColors.primary} />}
            {results.state === 'error' && (
              <View>
                <Text accessibilityLiveRegion="polite" style={styles.error}>{results.message}</Text>
                <Pressable accessibilityRole="button" disabled={saving} onPress={() => search(request.q)} style={styles.textButton}>
                  <Text style={styles.buttonText}>検索を再試行</Text>
                </Pressable>
              </View>
            )}
            {results.state === 'ready' && candidates.length === 0 && (
              <Text accessibilityLiveRegion="polite" style={styles.secondary}>施設名の一部で検索してください</Text>
            )}
            <PostPlaceCredits sources={sources} />
            {candidates.map(candidate => (
              <Pressable key={candidate.place_id} accessibilityRole="button"
                accessibilityState={{ selected: candidate.place_id === selectedPlaceId, disabled: saving }}
                disabled={saving} onPress={() => { void save(candidate.place_id); }}
                style={[styles.candidate, candidate.place_id === selectedPlaceId && styles.selectedCandidate]}>
                <Text style={styles.name}>{candidate.name}</Text>
                <Text style={styles.secondary}>{formatCategory(candidate.categories)} ・ {Math.round(candidate.distance_m)}m</Text>
              </Pressable>
            ))}
          </ScrollView>
        </KeyboardAvoidingView>
      </AppScreen>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: uiColors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: uiColors.border,
  },
  title: { color: uiColors.text, fontSize: 20, fontWeight: '700' },
  content: { padding: 20, gap: 12, width: '100%', maxWidth: 480, alignSelf: 'center' },
  currentPlace: { gap: 4 },
  name: { color: uiColors.text, fontSize: 16, fontWeight: '600' },
  secondary: { color: uiColors.primary, fontSize: 14 },
  textButton: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  buttonText: { color: uiColors.primary, fontSize: 15, fontWeight: '700' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1, minHeight: 44, paddingHorizontal: 12, backgroundColor: uiColors.surface,
    borderWidth: 1, borderColor: uiColors.primary, borderRadius: 8, color: uiColors.text, fontSize: 16,
  },
  searchButton: { backgroundColor: uiColors.primaryFill, borderRadius: 8, minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 },
  searchButtonText: { color: uiColors.onPrimary, fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.6 },
  error: { color: '#A82B25', fontSize: 14 },
  candidate: {
    backgroundColor: uiColors.surface, borderRadius: 8, borderWidth: 1, borderColor: uiColors.border,
    padding: 12, gap: 4, minHeight: 44,
  },
  selectedCandidate: { backgroundColor: uiColors.tint, borderColor: uiColors.primary },
});
