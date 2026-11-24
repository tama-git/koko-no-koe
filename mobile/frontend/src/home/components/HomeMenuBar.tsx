import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import type { PostListScope } from '../../posts/usePostList';
import { POST_MODE_LABELS } from './bottomSheetTabs';

export function HomeMenuBar({ mode, onSelectMode, onCompose, onLayout, composeDisabled }: {
  mode: PostListScope;
  onSelectMode: (mode: PostListScope) => void;
  onCompose: () => void;
  onLayout: (event: LayoutChangeEvent) => void;
  composeDisabled: boolean;
}) {
  const renderMode = (id: PostListScope) => {
    const selected = mode === id;
    return (
      <View style={styles.column}>
        <Pressable accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => onSelectMode(id)}
          style={({ pressed }) => [styles.item, selected && styles.selected, pressed && styles.pressed]}>
          <MenuIcon name={id} color={selected ? '#1D4030' : '#53645A'} />
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
            <MenuIcon name="compose" color="#FFFFFF" />
            <Text style={[styles.label, styles.composeLabel]}>声を残す</Text>
          </Pressable>
        </View>
        {renderMode('own')}
      </View>
    </SafeAreaView>
  );
}

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
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#DCE6DA' },
  row: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 5, gap: 4 },
  column: { flex: 1 },
  item: { flexGrow: 1, minHeight: 48, borderRadius: 20, alignItems: 'center', justifyContent: 'center', gap: 3, padding: 5 },
  selected: { backgroundColor: '#E8EFEA' },
  label: { fontSize: 12, color: '#53645A', fontWeight: '600', textAlign: 'center' },
  selectedLabel: { color: '#1D4030', fontWeight: '700' },
  compose: { backgroundColor: '#2C6049' },
  composeLabel: { color: '#FFFFFF' },
  pressed: { opacity: 0.6 },
});
