const assert = require('node:assert/strict');
const test = require('node:test');
const { getSheetHeights, clampSheetHeight, getClosestSheetLevel } = require('../src/home/components/bottomSheetGeometry.ts');

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
