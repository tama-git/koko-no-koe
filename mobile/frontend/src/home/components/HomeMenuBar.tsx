import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import type { PostListScope } from '../../posts/usePostList';
import { POST_MODE_LABELS } from './bottomSheetTabs';
import { uiColors } from '../../shared/uiColors';

// 「周りの声」「自分の投稿」の切り替えと、「声を残す」の入口を表示する。
export function HomeMenuBar({ mode, onSelectMode, onCompose, onLayout, composeDisabled }: {
  mode: PostListScope;
  onSelectMode: (mode: PostListScope) => void;
  onCompose: () => void;
  onLayout: (event: LayoutChangeEvent) => void;
  composeDisabled: boolean;
}) {
  // 一覧の種類ごとにボタンを表示し、現在の選択状態を反映する。
  const renderMode = (id: PostListScope) => {
    const selected = mode === id;
    return (
      <View style={styles.column}>
        <Pressable accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => onSelectMode(id)}
          style={({ pressed }) => [styles.item, selected && styles.selected, pressed && styles.pressed]}>
          <MenuIcon name={id} color={selected ? uiColors.text : uiColors.primary} />
          <Text style={[styles.label, selected && styles.selectedLabel]}>{POST_MODE_LABELS[id]}</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <SafeAreaView onLayout={onLayout} style={styles.footer}>
      <View style={styles.row}>
        {renderMode('public')}
        <View style={styles.column}>
          <Pressable accessibilityRole="button" disabled={composeDisabled} onPress={onCompose}
            style={({ pressed }) => [styles.item, styles.compose, (pressed || composeDisabled) && styles.pressed]}>
            <MenuIcon name="compose" color={uiColors.onPrimary} />
            <Text style={[styles.label, styles.composeLabel]}>声を残す</Text>
          </Pressable>
        </View>
        {renderMode('own')}
      </View>
    </SafeAreaView>
  );
}

// 地図・投稿作成・本人一覧に対応するアイコンを描く。
function MenuIcon({ name, color }: { name: PostListScope | 'compose'; color: string }) {
  return (
    <Svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {name === 'public' && <Path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Zm6-3v15m6-12v15" />}
      {name === 'compose' && <Path d="M12 5v14M5 12h14" />}
      {name === 'own' && <>
        <Circle cx={12} cy={7} r={3.5} />
        <Path d="M5 21v-1a7 7 0 0 1 14 0v1" />
      </>}
    </Svg>
  );
}

const styles = StyleSheet.create({
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: uiColors.surface,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: uiColors.border },
  row: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 5, gap: 4 },
  column: { flex: 1 },
  item: { flexGrow: 1, minHeight: 48, borderRadius: 20, alignItems: 'center', justifyContent: 'center', gap: 3, padding: 5 },
  selected: { backgroundColor: uiColors.selectionFill },
  label: { fontSize: 12, color: uiColors.primary, fontWeight: '600', textAlign: 'center' },
  selectedLabel: { color: uiColors.text, fontWeight: '700' },
  compose: { backgroundColor: uiColors.primaryFill },
  composeLabel: { color: uiColors.onPrimary },
  pressed: { opacity: 0.6 },
});
