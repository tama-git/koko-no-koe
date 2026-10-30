import { LoginScreen } from './src/auth/screens/LoginScreen';
import { RegisterScreen } from './src/auth/screens/RegisterScreen';
import { useAuth } from './src/auth/useAuth';
import { HomeScreen } from './src/home/screens/HomeScreen';

/** アプリの入口。ここでは表示する画面だけを切り替える。 */
export default function App() {
  const auth = useAuth();

  if (auth.token) {
    return <HomeScreen busy={auth.busy} message={auth.message} onLogout={auth.handleLogout} />;
  }

  return auth.mode === 'register'
    ? <RegisterScreen auth={auth} />
    : <LoginScreen auth={auth} />;
}
