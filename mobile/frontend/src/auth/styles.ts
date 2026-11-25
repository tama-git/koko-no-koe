import { StyleSheet } from 'react-native';
import { uiColors } from '../shared/uiColors';

export const styles = StyleSheet.create({
  keyboard: { flex: 1 },
  container: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 32, paddingBottom: 32, alignItems: 'center' },
  content: { width: '100%', maxWidth: 440 },
  brandName: { color: uiColors.text, fontSize: 20, fontWeight: '700', marginBottom: 36 },
  title: { color: uiColors.text, fontSize: 25, fontWeight: '700', marginBottom: 12 },
  card: { backgroundColor: uiColors.background },
  label: { color: uiColors.primary, fontSize: 13, fontWeight: '600', marginTop: 16, marginBottom: 7 },
  input: { height: 50, paddingHorizontal: 14, borderWidth: 1, borderColor: uiColors.border, borderRadius: 10, backgroundColor: uiColors.surface, color: uiColors.text, fontSize: 15 },
  inputError: { borderColor: '#BC6A5C' },
  hint: { color: uiColors.primary, fontSize: 11, lineHeight: 17, marginTop: 7 },
  error: { color: '#AA4B3F', fontSize: 12, lineHeight: 18, marginTop: 7 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44, marginTop: 7 },
  checkbox: { width: 20, height: 20, borderWidth: 1, borderColor: uiColors.primary, borderRadius: 3, alignItems: 'center', justifyContent: 'center', marginRight: 9 },
  checkboxChecked: { backgroundColor: uiColors.primaryFill, borderColor: uiColors.primary },
  checkmark: { color: uiColors.onPrimary, fontSize: 15, fontWeight: '700', lineHeight: 18 },
  checkboxLabel: { color: uiColors.primary, fontSize: 13 },
  button: { height: 52, backgroundColor: uiColors.primaryFill, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: 25 },
  buttonPressed: { opacity: 0.8 },
  buttonText: { color: uiColors.onPrimary, fontSize: 15, fontWeight: '700' },
  message: { color: '#705C38', backgroundColor: '#FCF6E9', overflow: 'hidden', borderRadius: 8, fontSize: 12, lineHeight: 19, marginTop: 14, padding: 12 },
  switchRow: { alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  switchText: { color: uiColors.primary, fontSize: 12 },
  switchButton: { paddingHorizontal: 18, paddingVertical: 10 },
  switchLink: { color: uiColors.primary, fontWeight: '700', fontSize: 13 },
});
