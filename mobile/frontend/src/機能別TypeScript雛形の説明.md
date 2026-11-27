# 機能別のTypeScript実装

画面の入口と関連するAPIの一覧は [画面と機能の分担ガイド](../../../docs/04_画面と機能の分担ガイド.md) を参照してください。

| 機能 | 主なファイル | 実装されている処理 |
| --- | --- | --- |
| 地図 | `map/components/HomeMap.tsx`、`map/openFreeMapDocument.ts` | 投稿ピンの表示、現在地と方角への追従 |
| 投稿・本人の投稿一覧 | `posts/postService.ts`、`posts/usePostList.ts` | 投稿の保存・取得と一覧の更新 |
| 通報 | `reports/reportService.ts` | 入力の確認と通報の送信 |
| リアクション | `likes/likeService.ts` | リアクションの取得・送信・取り消し |
| 撮影 | `posts/screens/PostCreateScreen.tsx` | カメラの利用許可、撮影、撮り直し |
| 会員向けの設定 | `utility/screens/UtilityScreen.tsx`、`utility/api.ts` | 設定項目の表示、パスワード変更、問い合わせ、退会 |
| 位置情報 | `location/getCurrentLocation.ts`、`location/useCurrentLocation.ts` | 現在地の取得と、位置・方角の更新 |
| 会員認証 | `auth/api.ts`、`auth/useAuth.ts` | 会員登録、メール認証、ログイン、ログアウト |
