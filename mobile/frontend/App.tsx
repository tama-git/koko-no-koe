import { LoginScreen } from './src/auth/screens/LoginScreen';
import { RegisterScreen } from './src/auth/screens/RegisterScreen';
import { useAuth } from './src/auth/useAuth';
import { HomeScreen } from './src/home/screens/HomeScreen';
import { TutorialEntry } from './src/tutorial/TutorialEntry';
import { tutorialCompletionKey } from './src/tutorial/tutorialCompletion';

/** アプリの入口。ここでは表示する画面だけを切り替える。 */
export default function App() {
  const auth = useAuth();

  if (auth.token) {
    const completionKey = tutorialCompletionKey(auth.email);
    return (
      <TutorialEntry key={completionKey} completionKey={completionKey}>
        <HomeScreen token={auth.token} busy={auth.busy} message={auth.message}
          onLogout={auth.handleLogout} user={{ name: '', email: auth.email }} />
      </TutorialEntry>
    );
  }

  return auth.mode === 'register'
    ? <RegisterScreen auth={auth} />
    : <LoginScreen auth={auth} />;
}
