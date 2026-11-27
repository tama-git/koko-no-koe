import { AuthForm } from '../components/AuthForm';
import type { AuthController } from '../useAuth';

type Props = { auth: AuthController };

// 共通の認証フォームをログイン用として表示する。
export function LoginScreen({ auth }: Props) {
  return <AuthForm auth={auth} title="ログイン" />;
}
