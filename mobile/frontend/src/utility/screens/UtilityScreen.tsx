import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChangePasswordScreen } from './ChangePasswordScreen';
import { DeleteAccountScreen } from './DeleteAccountScreen';
import { HelpScreen } from './HelpScreen';
import { ContactScreen } from './ContactScreen';

type Props = {
  onLogout: () => Promise<void>;
  token: string;
  user: { name: string; email: string };
};

export function UtilityScreen({ onLogout, token, user }: Props) {
  const [screen, setScreen] = useState<'changePassword' | 'deleteAccount' | 'help' | 'contact' | null>(null);
  const closeScreen = () => setScreen(null);
  const screenProps = { token, onClose: closeScreen };

  const handleLogout = () => {
    Alert.alert('確認', 'ログアウトしますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: 'ログアウト',
        style: 'destructive',
        onPress: () => onLogout().then(() => Alert.alert('完了', 'ログアウトしました。')),
      },
    ]);
  };

  return (
    <>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        {/* ログイン中のメールアドレスを表示 */}
        <View style={styles.userCard}>
          <Text style={styles.userInfoLabel}>ログイン中のアカウント</Text>
          <Text style={styles.userEmail}>{user?.email || 'メールアドレス未設定'}</Text>
        </View>

        <View style={styles.menuContainer}>
          {/* パスワード変更 */}
          <Pressable style={styles.menuItem} onPress={() => setScreen('changePassword')}>
            <Text style={styles.menuText}>パスワード変更</Text>
          </Pressable>

          {/* ヘルプ */}
          <Pressable style={styles.menuItem} onPress={() => setScreen('help')}>
            <Text style={styles.menuText}>ヘルプ</Text>
          </Pressable>

          {/* 問い合わせ */}
          <Pressable style={styles.menuItem} onPress={() => setScreen('contact')}>
            <Text style={styles.menuText}>問い合わせ</Text>
          </Pressable>

          {/* ログアウト */}
          <Pressable style={[styles.menuItem, styles.logoutItem]} onPress={handleLogout}>
            <Text style={styles.logoutText}>ログアウト</Text>
          </Pressable>

          {/* 退会 */}
          <Pressable style={[styles.menuItem, styles.logoutItem]} onPress={() => setScreen('deleteAccount')}>
            <Text style={styles.logoutText}>退会</Text>
          </Pressable>
        </View>
      </ScrollView>
      {screen !== null && (
        <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={closeScreen}>
          {screen === 'changePassword' && <ChangePasswordScreen {...screenProps} />}
          {screen === 'deleteAccount' && <DeleteAccountScreen {...screenProps} onDeleted={onLogout} />}
          {screen === 'help' && <HelpScreen {...screenProps} />}
          {screen === 'contact' && <ContactScreen {...screenProps} />}
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  container: { paddingHorizontal: 20, paddingBottom: 20, alignItems: 'center' },
  userCard: { 
    width: '100%', 
    maxWidth: 440, 
    backgroundColor: '#FFFFFF', 
    borderRadius: 12, 
    padding: 16, 
    marginBottom: 24, 
    borderWidth: 1, 
    borderColor: '#E2EBE0' 
  },
  userInfoLabel: { fontSize: 12, color: '#7D8C80', marginBottom: 4 },
  userEmail: { fontSize: 13, color: '#5C7A6B' },
  menuContainer: { width: '100%', maxWidth: 440 },
  menuItem: { 
    backgroundColor: '#FFFFFF', 
    padding: 16, 
    borderRadius: 10, 
    marginBottom: 10, 
    borderWidth: 1, 
    borderColor: '#E2EBE0' 
  },
  menuText: { fontSize: 15, color: '#1D4030', fontWeight: '600' },
  logoutItem: { borderColor: '#FEB2B2', backgroundColor: '#FFF5F5' },
  logoutText: { fontSize: 15, color: '#C53030', fontWeight: '600' },
});