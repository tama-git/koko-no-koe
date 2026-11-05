import { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppScreen } from '../../shared/components/AppScreen';
import { PostCreateScreen } from '../screens/PostCreateScreen';
import { PostConfirmScreen } from '../screens/PostConfirmScreen';
import { PostDetailScreen } from '../screens/PostDetailScreen';

type Draft = {
  message: string;
  imageUri: string | null;
  latitude: number;
  longitude: number;
  isPublished: boolean;
  imageMimeType?: string;
  imageFileName?: string;
};

/** 既存フォームのnavigation呼び出しを受け、作成・確認をつなぐ。 */
export function PostComposerModal({ onClose, token, onCreated }: { onClose: () => void; token: string; onCreated: () => void }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);
  const cancel = () => Alert.alert('投稿をやめますか？', '入力した内容や写真は破棄されます。', [
    { text: '続ける', style: 'cancel' },
    { text: '投稿をやめる', style: 'destructive', onPress: onClose },
  ]);
  const navigation = {
    navigate: (screen: 'PostConfirm' | 'PostDetail', params: Draft | { postId: number }) => {
      if (screen === 'PostDetail') setSavedId((params as { postId: number }).postId);
      else setDraft(params as Draft);
    },
    goBack: () => { if (savedId !== null) onClose(); else setDraft(null); },
    popToTop: onClose,
  };

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen"
      onRequestClose={() => { if (savedId !== null) onClose(); else if (!draft) cancel(); }}>
      <AppScreen>
        <View style={styles.header}>
          <Text style={styles.heading}>{savedId !== null ? '保存した投稿' : draft ? '投稿内容の確認' : '新規投稿'}</Text>
          {(!draft || savedId !== null) && <Pressable accessibilityRole="button" accessibilityLabel="投稿画面を閉じる"
            onPress={savedId !== null ? onClose : cancel} style={styles.close}><Text style={styles.closeText}>閉じる</Text></Pressable>}
        </View>
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
  header: { minHeight: 52, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#DCE6DA' },
  heading: { fontSize: 17, fontWeight: '600', color: '#1D4030' },
  close: { padding: 12 },
  closeText: { fontSize: 15, color: '#2C6049' },
  body: { flex: 1 },
  hidden: { display: 'none' },
});
