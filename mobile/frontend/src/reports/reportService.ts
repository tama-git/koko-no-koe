const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, '') ?? '';

export const REPORT_CATEGORIES = [
  { value: 'spam', label: '迷惑行為・スパム' },
  { value: 'harassment', label: '誹謗中傷・嫌がらせ' },
  { value: 'inappropriate', label: '不適切な内容' },
  { value: 'privacy', label: '個人情報の公開' },
  { value: 'other', label: 'その他' },
] as const;

export type ReportCategory = typeof REPORT_CATEGORIES[number]['value'];
export const REPORT_DETAILS_LIMIT = 100;

export function validateReport(category: ReportCategory | null, details: string): string {
  if (!category) return '通報理由のカテゴリを選択してください。';
  if (category === 'other' && !details.trim()) return 'その他を選んだ場合は理由を入力してください。';
  if (Array.from(details.trim()).length > REPORT_DETAILS_LIMIT) return '自由記述は100文字以内で入力してください。';
  return '';
}

export async function submitReport(postId: number, token: string, category: ReportCategory, details: string) {
  const inputError = validateReport(category, details);
  if (inputError) throw new Error(inputError);
  if (!Number.isSafeInteger(postId) || postId <= 0) throw new Error('通報する投稿を確認できませんでした。');
  if (!token) throw new Error('ログインし直してください。');
  if (!/^https?:\/\//i.test(baseUrl)) throw new Error('接続先が設定されていません。');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  const uncertain = '受付結果を確認できませんでした。通信環境を確認してから、もう一度お試しください。';
  try {
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/api/posts/${postId}/reports/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, details: details.trim() }),
        signal: controller.signal,
      });
    } catch {
      throw new Error(uncertain);
    }
    if (response.status === 409) return 'already_reported';
    if (response.status === 401) throw new Error('ログインし直してください。');
    if (response.status === 404) throw new Error('通報できる投稿が見つかりませんでした。');
    if (response.status === 400) throw new Error('通報理由の入力内容を確認してください。');
    if (response.status !== 201) throw new Error(uncertain);
    const data = await response.json().catch(() => null);
    if (data?.status !== 'received') throw new Error(uncertain);
    return 'received';
  } finally {
    clearTimeout(timer);
  }
}
