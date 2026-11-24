import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export function PostManagementMenu({ visibility, adminHidden, onChangeVisibility, onEditPlace, onDelete, onClose }: {
  visibility: boolean | null;
  adminHidden: boolean;
  onChangeVisibility?: () => void;
  onEditPlace: () => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const visibilityLabel = visibility === true ? '公開' : visibility === false ? '本人のみ公開' : '未設定';

  return (
    <View style={[StyleSheet.absoluteFill, styles.layer]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessible={false} />
      <ScrollView style={styles.menu} bounces={false} accessibilityViewIsModal>
        <View style={styles.status}>
          <Text style={styles.statusText}>現在の公開範囲：{visibilityLabel}</Text>
          {adminHidden && <Text style={styles.statusText}>管理者により非表示</Text>}
        </View>
        {onChangeVisibility && <MenuItem label={visibility ? '本人のみ公開に変更' : '公開に変更'} onPress={onChangeVisibility} />}
        <MenuItem label="場所タグを編集" onPress={onEditPlace} />
        {onDelete && <MenuItem label="投稿を削除" onPress={onDelete} destructive />}
        <MenuItem label="閉じる" onPress={onClose} />
      </ScrollView>
    </View>
  );
}

function MenuItem({ label, onPress, destructive = false }: {
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress}
      style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
      <Text style={[styles.label, destructive && styles.destructive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  layer: { alignItems: 'flex-end', zIndex: 1, paddingHorizontal: 16, paddingBottom: 8 },
  menu: {
    flexGrow: 0, flexShrink: 1, width: '100%', maxWidth: 280,
    borderRadius: 12, borderWidth: 1, borderColor: '#DCE6DA', backgroundColor: '#FFFFFF',
  },
  status: { paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#F4F6F4', gap: 4 },
  statusText: { color: '#465C50', fontSize: 14, fontWeight: '600' },
  item: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 8, justifyContent: 'center',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#DCE6DA' },
  pressed: { backgroundColor: '#EDF2EE' },
  label: { color: '#1D4030', fontSize: 15 },
  destructive: { color: '#B3261E' },
});
