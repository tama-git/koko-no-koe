import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { AppScreen } from '../../shared/components/AppScreen';
import { styles } from '../styles';
import { AuthForm } from '../components/AuthForm';
import type { AuthController } from '../useAuth';

type Props = { auth: AuthController };

export function RegisterScreen({ auth }: Props) {
  if (!auth.isVerifyingRegistration) {
    return <AuthForm auth={auth} title="会員登録" />;
  }

  return (
    <AppScreen>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            <Text style={styles.brandName}>ここの声</Text>
            <Text style={styles.title}>メールアドレスの認証</Text>
            <Text style={styles.label}>{auth.email.trim()} に届いた6桁の認証コードを入力してください。</Text>
            <TextInput
              accessibilityLabel="認証コード"
              autoComplete="one-time-code"
              keyboardType="number-pad"
              maxLength={6}
              returnKeyType="done"
              onSubmitEditing={auth.handleSubmit}
              onChangeText={(value) => {
                auth.setCode(value.replace(/[^0-9]/g, ''));
                auth.setMessage('');
              }}
              style={styles.input}
              value={auth.code}
              editable={!auth.busy}
            />
            <Pressable
              accessibilityRole="button"
              disabled={auth.busy}
              onPress={auth.handleSubmit}
              style={({ pressed }) => [styles.button, (pressed || auth.busy) && styles.buttonPressed]}
            >
              <Text style={styles.buttonText}>認証して登録する</Text>
            </Pressable>
            {auth.message ? <Text style={styles.message} accessibilityLiveRegion="polite">{auth.message}</Text> : null}
            <View style={styles.switchRow}>
              <Pressable accessibilityRole="button" disabled={auth.busy} onPress={auth.resendRegistrationCode} style={styles.switchButton}>
                <Text style={styles.switchLink}>認証コードを再送する</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={auth.busy} onPress={() => auth.changeMode('register')} style={styles.switchButton}>
                <Text style={styles.switchLink}>登録情報の入力に戻る</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={auth.busy} onPress={() => auth.changeMode('login')} style={styles.switchButton}>
                <Text style={styles.switchLink}>ログインへ</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}
