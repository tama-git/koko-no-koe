# 機能別TypeScript雛形

画面を表示する `.tsx` と別に、各機能の処理を書く `.ts` を用意しています。いずれも未実装で、画面からまだ呼び出していません。

| 担当 | ファイル | 今後書く処理の例 |
| --- | --- | --- |
| 地図 | `map/mapService.ts` | 地図や投稿位置のデータを取得する処理 |
| 投稿 | `posts/postService.ts` | 投稿の取得・登録など |
| 通報 | `reports/reportService.ts` | 通報の送信 |
| 自分の旅日記 | `journal/journalService.ts` | 自分の投稿の取得・絞り込み |
| いいね | `likes/likeService.ts` | いいねした投稿の取得など |
| 写真 | `camera/cameraService.ts` | カメラの許可・撮影 |
| アカウント | `account/accountService.ts` | アカウント操作 |
| 位置情報 | `location/getCurrentLocation.ts` | 現在地の取得（既存の雛形） |
| 会員認証 | `auth/api.ts`、`auth/useAuth.ts` | 既存の登録・ログイン処理。重複作成しない |

`Service` は処理をまとめるファイル名の例です。現在の関数は呼び出すと「まだ実装されていません」とエラーになります。架空のデータを返したり、保存や送信が成功したように扱ったりしません。

担当者は、必要な入力や戻り値、APIのURL、認証・権限、失敗時の画面表示をチームで確認してから、関数の引数・戻り値を決めて実装してください。今の引数なし・`Promise<never>` は未実装を示す仮の形で、正式な仕様ではありません。画面のつなぎ込みは `App.tsx` 担当者と調整します。
