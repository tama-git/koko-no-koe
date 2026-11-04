/**
 * 位置情報取得の担当場所。現在は許可の要求や取得は行わない。
 * 使用ライブラリ・失敗時の扱い・精度などを確認してから実装する。
 * 未実装のまま呼び出されても、仮の座標を返して成功扱いにしない。
 */
export async function getCurrentLocation(): Promise<never> {
  throw new Error('位置情報の取得はまだ実装されていません。');
}
