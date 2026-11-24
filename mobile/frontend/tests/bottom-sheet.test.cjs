const assert = require('node:assert/strict');
const test = require('node:test');
const {
  getSheetHeights, clampSheetHeight, getSheetLevelAfterDrag, getSheetSettleDuration, LIST_MIDDLE_RATIO, PIN_DETAIL_MIDDLE_RATIO,
} = require('../src/home/components/bottomSheetGeometry.ts');
const { getPostModeAfterSwipe, isHorizontalSheetSwipe } = require('../src/home/components/bottomSheetTabs.ts');

const getListHeights = (height, headerHeight = 45) => getSheetHeights(height, headerHeight, LIST_MIDDLE_RATIO, true);

test('the list compact stop fits the header and divider, and the detail minimum fits the back row', () => {
  assert.deepEqual(getListHeights(800), { hidden: 0, min: 64, half: 320, full: 800 });
  assert.deepEqual(getListHeights(600, 65), { hidden: 0, min: 84, half: 240, full: 600 });
  assert.deepEqual(getSheetHeights(800, 44), { min: 63, half: 320, full: 800 });
  assert.deepEqual(getSheetHeights(600, 64), { min: 83, half: 240, full: 600 });
  assert.deepEqual(getSheetHeights(110, 64), { min: 83, half: 83, full: 110 });
  assert.deepEqual(getSheetHeights(40, 44), { min: 40, half: 40, full: 40 });
});

test('a pin opened from the hidden list can use half of the available height', () => {
  assert.deepEqual(getSheetHeights(800, 44, PIN_DETAIL_MIDDLE_RATIO), { min: 63, half: 400, full: 800 });
});

test('a different detail header height only changes the minimum when the sheet has enough room', () => {
  const listHeights = getListHeights(800);
  const detailHeights = getSheetHeights(800, 64);
  assert.equal(detailHeights.min, 83);
  assert.equal(detailHeights.half, listHeights.half);
  assert.equal(detailHeights.full, listHeights.full);
});

test('dragging follows the finger continuously and stays within the sheet bounds', () => {
  const heights = getListHeights(800);
  assert.equal(clampSheetHeight(320 + 120, heights), 440);
  assert.equal(clampSheetHeight(320 - 100, heights), 220);
  assert.equal(clampSheetHeight(-200, heights), 0);
  assert.equal(clampSheetHeight(-200, getSheetHeights(800, 44)), 63);
  assert.equal(clampSheetHeight(1200, heights), 800);
});

test('slow drags settle at the nearest stop using the release position', () => {
  const heights = getListHeights(800);
  assert.equal(getSheetLevelAfterDrag(heights.half, 40, 700, heights), 'half');
  assert.equal(getSheetLevelAfterDrag(heights.half, 190, 800, heights), 'min');
  assert.equal(getSheetLevelAfterDrag(heights.min, 65, 600, heights), 'hidden');
  assert.equal(getSheetLevelAfterDrag(heights.hidden, -65, 600, heights), 'min');
  assert.equal(getSheetLevelAfterDrag(heights.half, -280, 1000, heights), 'full');
  assert.equal(getSheetLevelAfterDrag(heights.min, -180, 650, heights), 'half');
  assert.equal(getSheetLevelAfterDrag(heights.full, 290, 900, heights), 'half');
});

test('a short downward flick steps through compact in the list and stops at minimum in detail', () => {
  const list = getListHeights(800);
  const detail = getSheetHeights(800, 44);
  assert.equal(getSheetLevelAfterDrag(list.half, 20, 35, list), 'min');
  assert.equal(getSheetLevelAfterDrag(list.min, 20, 35, list), 'hidden');
  assert.equal(getSheetLevelAfterDrag(detail.min, 20, 35, detail), 'min');
});

test('settling time follows the remaining distance at the same speed in both directions', () => {
  const near = getSheetSettleDuration(360, 320);
  const far = getSheetSettleDuration(480, 320);
  assert.ok(near > 0);
  assert.equal(far, 4 * near);
  assert.equal(getSheetSettleDuration(320, 480), far);
  assert.equal(getSheetSettleDuration(320, 320), 0);
});

test('a short flick advances one stop while a tap or slow motion does not', () => {
  const heights = getSheetHeights(800, 44);
  assert.equal(getSheetLevelAfterDrag(heights.half, 20, 35, heights), 'min');
  assert.equal(getSheetLevelAfterDrag(heights.half, -20, 35, heights), 'full');
  assert.equal(getSheetLevelAfterDrag(heights.min, -24, 40, heights), 'half');
  assert.equal(getSheetLevelAfterDrag(heights.full, 24, 40, heights), 'half');
  assert.equal(getSheetLevelAfterDrag(heights.half, 5, 10, heights), 'half');
  assert.equal(getSheetLevelAfterDrag(heights.half, 20, 120, heights), 'half');
  assert.equal(getSheetLevelAfterDrag(heights.half, 20, 0, heights), 'half');
});

test('long drags can span two stops and neither end can be overshot', () => {
  const heights = getSheetHeights(800, 44);
  assert.equal(getSheetLevelAfterDrag(heights.min, -900, 800, heights), 'full');
  assert.equal(getSheetLevelAfterDrag(heights.full, 900, 800, heights), 'min');
  assert.equal(getSheetLevelAfterDrag(heights.min, 100, 100, heights), 'min');
  assert.equal(getSheetLevelAfterDrag(heights.full, -100, 100, heights), 'full');
});

test('horizontal swipes are limited to the two post modes', () => {
  assert.equal(getPostModeAfterSwipe('public', -48, 4), 'own');
  assert.equal(getPostModeAfterSwipe('own', -80, -10), 'own');
  assert.equal(getPostModeAfterSwipe('own', 48, -4), 'public');
  assert.equal(getPostModeAfterSwipe('public', 80, 0), 'public');
});

test('tap, short swipe and vertical or diagonal gestures do not switch modes', () => {
  assert.equal(isHorizontalSheetSwipe(15, 0), false);
  assert.equal(isHorizontalSheetSwipe(-16, 0), true);
  assert.equal(isHorizontalSheetSwipe(40, -80), false);
  assert.equal(getPostModeAfterSwipe('own', 47, 0), 'own');
  assert.equal(getPostModeAfterSwipe('own', 80, -60), 'own');
});
