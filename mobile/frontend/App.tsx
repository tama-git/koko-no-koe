import { LoginScreen } from './src/auth/screens/LoginScreen';
import { RegisterScreen, RegistrationCompleteScreen } from './src/auth/screens/RegisterScreen';
import { useAuth } from './src/auth/useAuth';
import { HomeScreen } from './src/home/screens/HomeScreen';
import { TutorialEntry } from './src/tutorial/TutorialEntry';
import { tutorialCompletionKey } from './src/tutorial/tutorialCompletion';

/** アプリの入口。ここでは表示する画面だけを切り替える。 */
export default function App() {
  const auth = useAuth();

  if (auth.session) {
    if (auth.session.source === 'registration' && !auth.session.completionAcknowledged) {
      return <RegistrationCompleteScreen onContinue={auth.continueAfterRegistration} />;
    }

    const home = (
      <HomeScreen token={auth.session.token} busy={auth.busy} message={auth.message}
        onLogout={auth.handleLogout} user={{ name: '', email: auth.email }} />
    );
    if (auth.session.source !== 'registration') return home;

    const completionKey = tutorialCompletionKey(auth.email);
    return (
      <TutorialEntry key={completionKey} completionKey={completionKey}>
        {home}
      </TutorialEntry>
    );
  }

  return auth.mode === 'register'
    ? <RegisterScreen auth={auth} />
    : <LoginScreen auth={auth} />;
}
