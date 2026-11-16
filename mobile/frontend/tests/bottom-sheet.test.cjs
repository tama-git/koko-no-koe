const assert = require('node:assert/strict');
const test = require('node:test');
const { getSheetHeights, clampSheetHeight, getClosestSheetLevel } = require('../src/home/components/bottomSheetGeometry.ts');
const { getSheetTabAfterSwipe, isHorizontalSheetSwipe } = require('../src/home/components/bottomSheetTabs.ts');

test('preview height keeps posts visible and adapts to the available height', () => {
  assert.deepEqual(getSheetHeights(800), { min: 184, half: 400, full: 800 });
  assert.deepEqual(getSheetHeights(600), { min: 150, half: 300, full: 600 });
  assert.deepEqual(getSheetHeights(1000), { min: 230, half: 500, full: 1000 });
  assert.deepEqual(getSheetHeights(40), { min: 40, half: 40, full: 40 });
});

test('dragging follows the finger continuously and stays within the sheet bounds', () => {
  const heights = getSheetHeights(800);
  // 400pxから指を上へ120px動かすと、高さは520px。ドラッグ中は固定位置に丸めない。
  assert.equal(clampSheetHeight(400 + 120, heights), 520);
  assert.equal(clampSheetHeight(400 - 100, heights), 300);
  assert.equal(clampSheetHeight(-200, heights), 184);
  assert.equal(clampSheetHeight(1200, heights), 800);
});

test('release picks the nearest stop including returning to the original stop', () => {
  const heights = getSheetHeights(800);
  for (const [position, expected] of [[184,'min'], [292,'min'], [293,'half'],
    [400,'half'], [520,'half'], [600,'half'], [601,'full'], [799,'full']]) {
    assert.equal(getClosestSheetLevel(position, heights), expected);
  }
});

test('horizontal swipes switch one tab at a time and stop at the ends', () => {
  assert.equal(getSheetTabAfterSwipe('public', -48, 4), 'own');
  assert.equal(getSheetTabAfterSwipe('own', -80, -10), 'settings');
  assert.equal(getSheetTabAfterSwipe('settings', 80, 10), 'own');
  assert.equal(getSheetTabAfterSwipe('own', 48, -4), 'public');
  assert.equal(getSheetTabAfterSwipe('settings', -80, 0), 'settings');
  assert.equal(getSheetTabAfterSwipe('public', 80, 0), 'public');
});

test('tap, short swipe and vertical or diagonal gestures do not switch tabs', () => {
  assert.equal(isHorizontalSheetSwipe(15, 0), false);
  assert.equal(isHorizontalSheetSwipe(-16, 0), true);
  assert.equal(isHorizontalSheetSwipe(40, -80), false);
  assert.equal(getSheetTabAfterSwipe('own', 47, 0), 'own');
  assert.equal(getSheetTabAfterSwipe('own', 80, -60), 'own');
});
