import React from 'react';
import { Pressable, StyleSheet, Text, View, Alert } from 'react-native';
import { AppScreen } from '../../shared/components/AppScreen';

// 例: ログイン中のユーザー情報を取得するカスタムフックやコンテキストのインポート
// import { useAuth } from '../../shared/context/AuthContext'; 

type Props = { 
  onClose: () => void;
  // 外部からログイン中のユーザーデータを受け取る場合（不要な場合はコンテキストフック内で取得してください）
  user?: {
    name: string;
    email: string;
  };
};

export function UtilityScreen({ onClose, user }: Props) {
  // 例: コンテキストからログインユーザーを取得する場合
  // const { user, logout } = useAuth();

  // ログアウト処理の例
  const handleLogout = () => {
    Alert.alert('確認', 'ログアウトしますか？', [
      { text: 'キャンセル', style: 'cancel' },
      { 
        text: 'ログアウト', 
        style: 'destructive', 
        onPress: () => {
          // 実際のログアウト処理（トークン削除など）
          // logout();
        } 
      },
    ]);
  };

  return (
    <AppScreen>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.backButton}>
          <Text style={styles.backText}>戻る</Text>
        </Pressable>
      </View>

      {/* ユーティリティ（メニュー）画面 */}
      <View style={styles.container}>
        <Text style={styles.title}>ユーティリティメニュー</Text>

        {/* ログイン中のユーザー情報を動的に表示 */}
        <View style={styles.userCard}>
          <Text style={styles.userInfoLabel}>ログイン中のアカウント</Text>
          <Text style={styles.userEmail}>{user?.email || 'メールアドレス未設定'}</Text>
        </View>

        {/* メニュー項目のリスト */}
        <View style={styles.menuContainer}>
          <Pressable style={styles.menuItem} onPress={() => console.log('プロフィール編集へ')}>
            <Text style={styles.menuText}>アカウント設定</Text>
          </Pressable>

          <Pressable style={styles.menuItem} onPress={() => console.log('パスワード変更へ')}>
            <Text style={styles.menuText}>パスワード変更</Text>
          </Pressable>

          <Pressable style={styles.menuItem} onPress={() => console.log('ヘルプへ')}>
            <Text style={styles.menuText}>ヘルプ・問い合わせ</Text>
          </Pressable>

          {/* ログインユーザー向けのアクション */}
          <Pressable style={[styles.menuItem, styles.logoutItem]} onPress={handleLogout}>
            <Text style={styles.logoutText}>ログアウト</Text>
          </Pressable>

          <Pressable style={[styles.menuItem, styles.logoutItem]} onPress={() => console.log('退会処理へ')}>
            <Text style={styles.logoutText}>退会</Text>
          </Pressable>
        </View>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 12, alignItems: 'flex-start' },
  backButton: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' },
  backText: { color: '#2C6049', fontSize: 15, fontWeight: '700' },
  container: { padding: 20, flex: 1, alignItems: 'center' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#1C3D2D', marginBottom: 20 },
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
  userName: { fontSize: 16, fontWeight: 'bold', color: '#1D4030', marginBottom: 2 },
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