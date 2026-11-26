import { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppScreen } from '../../shared/components/AppScreen';
import { PostCreateScreen } from '../screens/PostCreateScreen';
import { PostConfirmScreen } from '../screens/PostConfirmScreen';
import type { PostConfirmDraft } from '../screens/PostConfirmScreen';
import { PostDetailScreen } from '../screens/PostDetailScreen';
import { uiColors } from '../../shared/uiColors';
import { createPostPlacePreviewLoader } from '../postService';

/** 既存フォームのnavigation呼び出しを受け、作成・確認をつなぐ。 */
export function PostComposerModal({ onClose, token, onCreated }: { onClose: () => void; token: string; onCreated: () => void }) {
  const [draft, setDraft] = useState<PostConfirmDraft | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);
  const loadPlacePreview = useMemo(() => createPostPlacePreviewLoader(token), [token]);
  const cancel = () => Alert.alert('投稿をやめますか？', '入力した内容や写真は破棄されます。', [
    { text: '続ける', style: 'cancel' },
    { text: '投稿をやめる', style: 'destructive', onPress: onClose },
  ]);
  const navigation = {
    navigate: (screen: 'PostConfirm' | 'PostDetail', params: PostConfirmDraft | { postId: number }) => {
      if (screen === 'PostDetail') {
        setSavedId((params as { postId: number }).postId);
      } else {
        const nextDraft = params as PostConfirmDraft;
        setDraft(nextDraft);
        void loadPlacePreview(nextDraft).then(placePreview => {
          setDraft(current => current === nextDraft ? { ...current, placePreview } : current);
        });
      }
    },
    goBack: () => { if (savedId !== null) onClose(); else setDraft(null); },
    popToTop: onClose,
  };

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen"
      onRequestClose={() => { if (savedId !== null) onClose(); else if (!draft) cancel(); }}>
      <AppScreen>
        {(!draft || savedId !== null) && (
          <View style={styles.header}>
            <Text style={styles.heading}>{savedId !== null ? '保存した投稿' : '新規投稿'}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="投稿画面を閉じる"
              onPress={savedId !== null ? onClose : cancel} style={styles.close}><Text style={styles.closeText}>閉じる</Text></Pressable>
          </View>
        )}
        {/* 確認中も作成画面を残し、「修正」で入力内容と写真を維持する。 */}
        <View style={[styles.body, (draft !== null || savedId !== null) && styles.hidden]}>
          <PostCreateScreen navigation={navigation} />
        </View>
        {draft && savedId === null && <PostConfirmScreen token={token} onCreated={onCreated} route={{ params: draft }} navigation={navigation} />}
        {savedId !== null && <PostDetailScreen token={token} route={{ params: { postId: savedId } }} navigation={navigation} />}
      </AppScreen>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { minHeight: 52, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: uiColors.border },
  heading: { fontSize: 17, fontWeight: '600', color: uiColors.text },
  close: { padding: 12 },
  closeText: { fontSize: 15, color: uiColors.primary },
  body: { flex: 1 },
  hidden: { display: 'none' },
});
