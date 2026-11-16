export const SHEET_TABS = [
  { id: 'public', label: '周りの声' },
  { id: 'own', label: '自分の投稿' },
  { id: 'settings', label: '設定' },
] as const;

export type SheetTab = typeof SHEET_TABS[number]['id'];

export function isHorizontalSheetSwipe(dx: number, dy: number) {
  return Math.abs(dx) >= 16 && Math.abs(dx) > Math.abs(dy) * 1.5;
}

export function getSheetTabAfterSwipe(tab: SheetTab, dx: number, dy: number): SheetTab {
  if (Math.abs(dx) < 48 || !isHorizontalSheetSwipe(dx, dy)) return tab;

  const currentIndex = SHEET_TABS.findIndex(({ id }) => id === tab);
  const nextIndex = currentIndex + (dx < 0 ? 1 : -1);
  return SHEET_TABS[nextIndex]?.id ?? tab;
}
