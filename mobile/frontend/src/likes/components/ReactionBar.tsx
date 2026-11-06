import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  deleteReaction,
  getReactions,
  LikeApiError,
  REACTION_EMOJIS,
  ReactionEmoji,
  ReactionState,
  sendReaction,
} from '../likeService';

type Props = {
  /** リアクション対象の投稿ID */
  postId: number;
  /** 認証トークン */
  token: string;
};

// '.' は内部値なので表示用リストから除外する
const DISPLAY_EMOJIS = REACTION_EMOJIS.filter((e) => e !== '.') as ReactionEmoji[];

/**
 * 投稿へのリアクションバー。
 * タップで選択、同じものを再タップで取り消し、別のものをタップで切り替え
 * APIの結果を待たずに画面を即時更新し、失敗時は元の状態に戻す（楽観的UI更新）
 */
export function ReactionBar({ postId, token }: Props) {
  const [state, setState] = useState<ReactionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // マウント時にリアクション一覧を取得する
  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await getReactions(postId, token);
      setState(data);
    } catch (e) {
      setError(e instanceof LikeApiError ? e.message : 'リアクションを取得できませんでした。');
    } finally {
      setLoading(false);
    }
  }, [postId, token]);

  useEffect(() => { load(); }, [load]);

  const handlePress = async (emoji: ReactionEmoji) => {
    if (!state) return;
    const prev = state; // API失敗時に戻すための保存

    if (state.my_reaction === emoji) {
      // 同じ絵文字をタップ → 取り消し
      setState({ ...state, my_reaction: null, counts: { ...state.counts, [emoji]: Math.max(0, (state.counts[emoji] ?? 0) - 1) } });
      try { await deleteReaction(postId, token); }
      catch { setState(prev); } // 失敗したら元に戻す
    } else {
      // 別の絵文字をタップ → 切り替え（前のリアクションを削除してから新しいものを送信）
      const next: ReactionState = {
        my_reaction: emoji,
        counts: { ...state.counts, [emoji]: (state.counts[emoji] ?? 0) + 1 },
      };
      // 前のリアクションのカウントを減らす
      if (state.my_reaction) next.counts[state.my_reaction] = Math.max(0, (state.counts[state.my_reaction] ?? 0) - 1);
      setState(next);
      try {
        if (state.my_reaction) await deleteReaction(postId, token);
        await sendReaction(postId, emoji, token);
      } catch { setState(prev); } // 失敗したら元に戻す
    }
  };

  if (loading) return <ActivityIndicator size="small" style={styles.loader} />;
  if (error) return <Text style={styles.error}>{error}</Text>;
  if (!state) return null;

  return (
    <View style={styles.row}>
      {DISPLAY_EMOJIS.map((emoji) => {
        const count = state.counts[emoji] ?? 0;
        const active = state.my_reaction === emoji; // 自分が選んでいる絵文字かどうか
        return (
          <TouchableOpacity
            key={emoji}
            style={[styles.btn, active && styles.active]}
            onPress={() => handlePress(emoji)}
            activeOpacity={0.7}
          >
            <Text style={styles.emoji}>{emoji}</Text>
            {/* カウントが0のときは数字を表示しない */}
            {count > 0 && <Text style={styles.count}>{count}</Text>}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  btn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, borderWidth: 1, borderColor: '#ccc', backgroundColor: '#f5f5f5' },
  active: { borderColor: '#4a90e2', backgroundColor: '#e8f0fe' }, // 選択中は青系に変える
  emoji: { fontSize: 18 },
  count: { marginLeft: 4, fontSize: 13, color: '#555' },
  loader: { marginTop: 8 },
  error: { marginTop: 8, fontSize: 12, color: '#c00' },
});
