import { AuthForm } from '../components/AuthForm';
import type { AuthController } from '../useAuth';

type Props = { auth: AuthController };

export function LoginScreen({ auth }: Props) {
  return <AuthForm auth={auth} title="ログイン" />;
}
