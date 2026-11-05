import { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppScreen } from '../../shared/components/AppScreen';
import { PostCreateScreen } from '../screens/PostCreateScreen';
import { PostConfirmScreen } from '../screens/PostConfirmScreen';

type Draft = {
  message: string;
  imageUri: string | null;
  latitude: number;
  longitude: number;
  isPublished: boolean;
};

/** 既存フォームのnavigation呼び出しを受け、作成・確認をつなぐ。 */
export function PostComposerModal({ onClose }: { onClose: () => void }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const cancel = () => Alert.alert('投稿をやめますか？', '入力した内容や写真は破棄されます。', [
    { text: '続ける', style: 'cancel' },
    { text: '投稿をやめる', style: 'destructive', onPress: onClose },
  ]);
  const navigation = {
    navigate: (_screen: 'PostConfirm', params: Draft) => setDraft(params),
    goBack: () => setDraft(null),
    popToTop: onClose,
  };

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen"
      onRequestClose={() => { if (!draft) cancel(); }}>
      <AppScreen>
        <View style={styles.header}>
          <Text style={styles.heading}>{draft ? '投稿内容の確認' : '新規投稿'}</Text>
          {!draft && <Pressable accessibilityRole="button" accessibilityLabel="投稿作成を閉じる"
            onPress={cancel} style={styles.close}><Text style={styles.closeText}>閉じる</Text></Pressable>}
        </View>
        {/* 確認中も作成画面を残し、「修正」で入力内容と写真を維持する。 */}
        <View style={[styles.body, draft !== null && styles.hidden]}>
          <PostCreateScreen navigation={navigation} />
        </View>
        {draft && <PostConfirmScreen route={{ params: draft }} navigation={navigation} />}
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
