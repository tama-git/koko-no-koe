// ユーティリティメニュー画面。
// メニュー項目を押すと対応する画面に切り替わる（screen ステートで管理）。

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View, Alert } from 'react-native';
import { AppScreen } from '../../shared/components/AppScreen';
import { ChangePasswordScreen } from './ChangePasswordScreen';
import { DeleteAccountScreen } from './DeleteAccountScreen';
import { HelpScreen } from './HelpScreen';

type Props = { 
  onClose: () => void;
  onLogout: () => Promise<void>; 
  token?: string; 
  user?: {
    name: string;
    email: string;
  };
};

export function UtilityScreen({ onClose, onLogout, token, user }: Props) {
  // ② screen の選択肢に 'help' を追加
  const [screen, setScreen] = useState<'menu' | 'changePassword' | 'deleteAccount' | 'help'>('menu');

  // パスワード変更画面に切り替え
  if (screen === 'changePassword') {
    return (
      <ChangePasswordScreen
        token={token ?? ''}
        onClose={() => setScreen('menu')}
      />
    );
  }

  // 退会画面に切り替え
  if (screen === 'deleteAccount') {
    return (
      <DeleteAccountScreen
        token={token ?? ''}
        onClose={() => setScreen('menu')}
        onDeleted={onLogout}
      />
    );
  }

  // ヘルプ画面に切り替え
  if (screen === 'help') {
    return (
      <HelpScreen
        token={token ?? ''}
        onClose={() => setScreen('menu')} // メニューに戻る
      />
    );
  }

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
    <AppScreen>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.backButton}>
          <Text style={styles.backText}>戻る</Text>
        </Pressable>
      </View>

      <View style={styles.container}>
        <Text style={styles.title}>ユーティリティメニュー</Text>

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
          <Pressable style={styles.menuItem} onPress={() => console.log('問い合わせへ')}>
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