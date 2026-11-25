import { Pressable, StyleSheet, Text, View } from 'react-native';
import { uiColors } from '../../shared/uiColors';

const options = [
  { value: true, label: '公開', description: '他の会員も閲覧できます' },
  { value: false, label: '本人のみ公開', description: '投稿した本人だけが閲覧できます' },
] as const;

export function PostVisibilityOptions({ value, onChange, disabled = false }: {
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.heading}>公開設定</Text>
      <View style={styles.row}>
        {options.map(option => {
          const checked = value === option.value;
          return (
            <Pressable key={option.label} accessibilityRole="radio" accessibilityLabel={option.label}
              accessibilityHint={option.description} accessibilityState={{ checked, disabled }}
              disabled={disabled} onPress={() => onChange(option.value)}
              style={[styles.option, checked && styles.checked]}>
              <View style={[styles.radio, checked && styles.radioChecked]}>
                {checked && <View style={styles.dot} />}
              </View>
              <Text style={styles.label}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.description}>{value ? options[0].description : options[1].description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8, marginBottom: 20 },
  heading: { fontSize: 14, fontWeight: '600', color: uiColors.primary },
  row: { flexDirection: 'row', gap: 8 },
  option: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    minHeight: 48, padding: 8, borderWidth: 1, borderColor: uiColors.border, borderRadius: 10, backgroundColor: uiColors.surface,
  },
  checked: { borderColor: uiColors.primary, backgroundColor: uiColors.tint },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: uiColors.primary, alignItems: 'center', justifyContent: 'center' },
  radioChecked: { borderColor: uiColors.primary },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: uiColors.primary },
  label: { flexShrink: 1, fontSize: 14, fontWeight: '600', color: uiColors.text },
  description: { fontSize: 12, color: uiColors.primary },
});
