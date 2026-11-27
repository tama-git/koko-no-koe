const japanDate = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  calendar: 'gregory',
  numberingSystem: 'latn',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});
const minute = 60_000;
const hour = 60 * minute;
const day = 24 * hour;

// 投稿日時を、日本時間の日付または投稿からの経過時間に変換する。
export function formatPostDate(value: string, now = Date.now()): string {
  const postedAt = Date.parse(value);
  if (!Number.isFinite(postedAt) || !Number.isFinite(now)) return '';

  const parts = japanDate.formatToParts(postedAt);
  const year = parts.find(part => part.type === 'year')?.value;
  const month = parts.find(part => part.type === 'month')?.value;
  const date = parts.find(part => part.type === 'day')?.value;
  const currentYear = japanDate.formatToParts(now).find(part => part.type === 'year')?.value;
  const monthDay = `${month}月${date}日`;

  if (year !== currentYear) return `${year}年${monthDay}`;
  const elapsed = now - postedAt;
  if (elapsed < minute) return 'たった今';
  if (elapsed < hour) return `${Math.floor(elapsed / minute)}分前`;
  if (elapsed < day) return `${Math.floor(elapsed / hour)}時間前`;
  if (elapsed < 7 * day) return `${Math.floor(elapsed / day)}日前`;
  return monthDay;
}
