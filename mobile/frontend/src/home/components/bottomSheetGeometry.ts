export type SheetLevel = 'min' | 'half' | 'full';
export type SheetHeights = Record<SheetLevel, number>;

export function getSheetHeights(containerHeight: number): SheetHeights {
  const full = Math.max(0, containerHeight);
  // 投稿カードが少し見え、ハンドルがホーム操作領域に近づきすぎない高さ。
  // 参考画像の約23%を目安に、小さい端末でも150ptを確保する。
  const min = Math.min(full, Math.max(150, full * 0.23));
  return { min, half: Math.max(min, full * 0.5), full };
}

export function clampSheetHeight(height: number, heights: SheetHeights): number {
  return Math.max(heights.min, Math.min(height, heights.full));
}

/** 距離が同じ場合は低い位置にそろえる。スワイプの速さでは判定しない。 */
export function getClosestSheetLevel(height: number, heights: SheetHeights): SheetLevel {
  return (['min', 'half', 'full'] as const).reduce<SheetLevel>((closest, level) =>
    Math.abs(height - heights[level]) < Math.abs(height - heights[closest]) ? level : closest,
  'min');
}
