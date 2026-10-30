import { AuthForm } from '../components/AuthForm';
import type { AuthController } from '../useAuth';

type Props = { auth: AuthController };

export function RegisterScreen({ auth }: Props) {
  return <AuthForm auth={auth} title="会員登録" />;
}
