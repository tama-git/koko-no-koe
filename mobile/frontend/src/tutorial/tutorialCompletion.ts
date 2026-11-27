type TutorialStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

// Djangoのログインと同じ表記に揃え、同じ端末でもアカウントごとに判定する。
export function tutorialCompletionKey(email: string) {
  return `@koko-no-koe/tutorial/v1/${email.trim().toLowerCase()}`;
}

// 会員ごとの完了状態を端末から読み、登録後に初回チュートリアルを表示するか判定する。
export async function shouldShowTutorial(storage: Pick<TutorialStorage, 'getItem'>, key: string) {
  try {
    return (await storage.getItem(key)) !== 'complete';
  } catch {
    // 端末内の保存を読み出せない場合も、登録完了後はホームを使えるようにする。
    return false;
  }
}

// 初回チュートリアルの完了を端末内の会員別キーに記録する。
export async function rememberTutorialCompletion(storage: Pick<TutorialStorage, 'setItem'>, key: string) {
  try {
    await storage.setItem(key, 'complete');
  } catch {
    // 保存できなくてもホームに進む。
  }
}
