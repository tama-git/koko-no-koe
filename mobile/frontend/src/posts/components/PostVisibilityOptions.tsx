import { Pressable, StyleSheet, Text, View } from 'react-native';

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
  heading: { fontSize: 14, fontWeight: '600', color: '#395647' },
  row: { flexDirection: 'row', gap: 8 },
  option: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    minHeight: 48, padding: 8, borderWidth: 1, borderColor: '#DCE6DA', borderRadius: 10, backgroundColor: '#FBFCFA',
  },
  checked: { borderColor: '#2C6049', backgroundColor: '#F3F7F4' },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#718477', alignItems: 'center', justifyContent: 'center' },
  radioChecked: { borderColor: '#2C6049' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2C6049' },
  label: { flexShrink: 1, fontSize: 14, fontWeight: '600', color: '#1D4030' },
  description: { fontSize: 12, color: '#526658' },
});
