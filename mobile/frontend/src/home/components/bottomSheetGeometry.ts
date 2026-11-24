type VisibleSheetLevel = 'min' | 'half' | 'full';
export type SheetLevel = 'hidden' | VisibleSheetLevel;
export type SheetHeights = Record<VisibleSheetLevel, number> & { hidden?: 0 };

const detailLevels = ['min', 'half', 'full'] as const;
const listLevels = ['hidden', ...detailLevels] as const;
const MIN_FLICK_DISTANCE = 12;
const MAX_FLICK_DURATION_MS = 220;
const MIN_FLICK_SPEED = 0.45;
const SHEET_SETTLE_POINTS_PER_SECOND = 1000;

export const SHEET_HANDLE_HEIGHT = 19;
export const MIN_SHEET_HEADER_HEIGHT = 44;
export const LIST_MIDDLE_RATIO = 0.4;
export const PIN_DETAIL_MIDDLE_RATIO = 0.5;

export function getSheetHeights(containerHeight: number, headerHeight: number, middleRatio = LIST_MIDDLE_RATIO,
  allowHidden = false): SheetHeights {
  const full = Math.max(0, containerHeight);
  const min = Math.min(full, SHEET_HANDLE_HEIGHT + Math.max(MIN_SHEET_HEADER_HEIGHT, headerHeight));
  return { ...(allowHidden ? { hidden: 0 } : {}), min, half: Math.max(min, full * middleRatio), full };
}

export function getSheetLevelHeight(heights: SheetHeights, level: SheetLevel): number {
  return heights[level] ?? heights.min;
}

export function clampSheetHeight(height: number, heights: SheetHeights): number {
  return Math.max(heights.hidden ?? heights.min, Math.min(height, heights.full));
}

export function getSheetSettleDuration(fromHeight: number, toHeight: number): number {
  return Math.abs(toHeight - fromHeight) * 1000 / SHEET_SETTLE_POINTS_PER_SECOND;
}

/** 距離が同じ場合は低い位置にそろえる。 */
function getClosestSheetLevel(height: number, heights: SheetHeights, levels: readonly SheetLevel[]): SheetLevel {
  return levels.reduce((closest, level) =>
    Math.abs(height - getSheetLevelHeight(heights, level)) < Math.abs(height - getSheetLevelHeight(heights, closest))
      ? level : closest);
}

export function getSheetLevelAfterDrag(startHeight: number, dy: number, elapsedMs: number, heights: SheetHeights): SheetLevel {
  const levels: readonly SheetLevel[] = heights.hidden === undefined ? detailLevels : listLevels;
  const start = getClosestSheetLevel(startHeight, heights, levels);
  const end = clampSheetHeight(startHeight - dy, heights);
  const closest = getClosestSheetLevel(end, heights, levels);
  const distance = Math.abs(dy);
  const flick = distance >= MIN_FLICK_DISTANCE && elapsedMs > 0 && elapsedMs <= MAX_FLICK_DURATION_MS
    && distance / elapsedMs >= MIN_FLICK_SPEED;
  if (closest !== start || !flick) return closest;

  // 短いフリックは途中で指を離しても、払った方向へ一段進める。
  const next = levels[levels.indexOf(start) + (dy < 0 ? 1 : -1)];
  return next && heights[next] !== heights[start] ? next : start;
}
