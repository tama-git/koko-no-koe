/** カメラ利用許可と撮影を実装する場所。現在はカメラを起動しない。 */
export async function takePhoto(): Promise<never> {
  throw new Error('写真の撮影はまだ実装されていません。');
}
