export const tutorialPages = [
  {
    icon: 'welcome',
    title: 'ようこそ、ここの声へ。',
    description: '場所は同じでも、見える景色は人それぞれ。\n誰かの視点に出会う、新しい旅のかたち。',
  },
  {
    icon: 'map',
    title: '誰かの声を探そう。',
    description: '地図を開いて、その場所に残された誰かの気づきや思い出を見つけましょう。',
  },
  {
    icon: 'range',
    title: 'その場所で出会う声。',
    description: '投稿場所から250m以内に入ると、他の人が残した声を読むことができます。',
  },
  {
    icon: 'write',
    title: 'あなたの声を残そう。',
    description: '心に残った景色や小さな発見を、写真や文章でその場所に残しましょう。',
  },
  {
    icon: 'book',
    title: '自分の声を振り返ろう。',
    description: 'あなたが残した声は、離れた場所からでもいつでも見返すことができます。',
  },
  {
    icon: 'start',
    title: 'さあ、はじめましょう。',
    description: 'まだ知らない誰かの視点に出会い、\nあなたの声も、この場所に。',
  },
] as const;

export type TutorialIcon = typeof tutorialPages[number]['icon'];

export function nextTutorialPage(page: number, direction: -1 | 1) {
  return Math.min(tutorialPages.length - 1, Math.max(0, page + direction));
}

export function tutorialSwipeDirection(dx: number, dy: number) {
  if (Math.abs(dx) < 48 || Math.abs(dx) <= Math.abs(dy) * 1.5) return null;
  return dx < 0 ? 1 : -1;
}
