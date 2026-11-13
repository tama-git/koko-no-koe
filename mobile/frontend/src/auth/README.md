# ここの声：会員認証の試作

画面の入口は `screens/`、共通の入力画面は `components/AuthForm.tsx`、状態と処理は `useAuth.ts`、見た目は `styles.ts` に分けています。`App.tsx` は表示する画面を選びます。担当の分け方は [画面と機能の分担ガイド](../../../../docs/04_画面と機能の分担ガイド.md) を参照してください。

既存の管理者用ログインと別に、`admin/backend` のDjangoにモバイル用JSON APIを追加しています。`MobileUser` テーブルを使用し、管理者のアカウントではモバイルにログインできません。旧HTML版のログイン・登録・トップ・ログアウトのURLは利用停止の案内（HTTP 410）を返します。旧HTML版のフォームとビューは削除し、会員認証は `api_views.py` に統一しています。

管理者認証の仕組み、変更ファイル、テスト・手動確認は [認証修正と確認手順](../../../../docs/05_認証修正と確認手順.md) を参照してください。

## APIの試作仕様（チーム確認前）

| 操作 | URL | 送信JSON | 応答 |
| --- | --- | --- | --- |
| 認証コード送信 | `POST /api/mobile/register/start/` | `email`, `password` | 成功200と `registration_id`、登録済み409、送信間隔が短い429、送信失敗503 |
| 認証コード再送 | `POST /api/mobile/register/resend/` | `email`, `registration_id` | 成功200と同じ `registration_id`、送信間隔が短い429、送信失敗503 |
| メール認証と会員登録 | `POST /api/mobile/register/` | `email`, `registration_id`, `code` | 成功201、無効・期限切れ400、入力上限429 |
| ログイン | `POST /api/mobile/login/` | `email`, `password` | 成功200と `token`、認証失敗401 |
| ログアウト | `POST /api/mobile/logout/` | `{}`、`Authorization: Bearer トークン` | 成功200、無効・期限切れ401 |

エラーは `{"error":"説明"}` です。6桁の認証コードは10分間有効です。送信から60秒後に再送できます。5回間違えるか期限が切れた場合は再送し、最新のコードを使います。認証に成功した時点で会員を作成し、ログイン画面に戻ります。既存画面の登録条件（8文字以上、英大文字・英小文字・数字・記号のうち3種類以上）をサーバーでも確認します。メールアドレスは前後の空白を除去し小文字で扱います。パスワードはDjangoでハッシュ化し、確認用の値は送信・保存しません。

登録・ログアウトの成功本文には文字列の `message`、ログインには文字列の `token` が必要です。通信側は成功ステータス、JSONの形式、必須項目を確認します。不正JSON、null、配列、項目欠落などは成功扱いせず `ApiError` にします。成功応答を確認できない登録では、サーバーで登録済みの可能性も案内します。

トークンの原文はサーバーのデータベースに保存せず、ハッシュだけを12時間有効として保存し、ログアウトで削除します。アプリ側はメモリだけに保持し、再起動後は再ログインが必要です。通信エラーでログアウトが完了しなかった場合は再試行できます。アプリ終了で消えたトークンのサーバー側記録は期限が切れますが、現状は自動削除しません。

## 認証メールの送信設定

Djangoを起動する環境に次の環境変数を設定します。SMTPはメール送信用のサーバーです。契約先のSMTP設定に合わせてください。

| 変数 | 設定する値 |
| --- | --- |
| `DJANGO_EMAIL_HOST` | SMTPサーバー名 |
| `DJANGO_EMAIL_PORT` | ポート番号（既定は587） |
| `DJANGO_EMAIL_SECURITY` | `tls`（既定）または `ssl` |
| `DJANGO_EMAIL_HOST_USER` | SMTPユーザー名 |
| `DJANGO_EMAIL_HOST_PASSWORD` | SMTP用のパスワード |
| `DJANGO_DEFAULT_FROM_EMAIL` | SMTPで送信を許可された送信元アドレス |

SMTPの認証情報はDjango側だけで管理してください。既存の `accounts` マイグレーション `0003` を適用したDBで利用できます。自動テストではDjangoのメモリ内メールを使います。

## iPhoneでの確認手順

これは開発中の確認用です。HTTP通信ではパスワードとトークンがネットワーク上で暗号化されないため、信頼できる自分のWi-Fiで、他で使っていない仮のメールアドレスとパスワードを使用してください。公開・本運用にはHTTPSなどの対策が必要です。

1. PCとiPhoneを同じWi-Fiに接続します。PowerShellで `ipconfig` を実行し、Wi-FiのIPv4アドレスを確認します（例：`192.168.1.23`）。
2. `admin/backend` のターミナルで次を実行します。初回はPython仮想環境と `requirements.txt` の準備が必要です。`migrate` は未適用のデータベース構造を追加します。今回確認したこのフォルダーの `db.sqlite3` は空で、管理者ログイン確認に使ったデータベースとの関係は未確認です。必要に応じて管理者担当者と確認してください。

   ```powershell
   .\.venv\Scripts\python.exe manage.py migrate
   $env:DJANGO_EXTRA_ALLOWED_HOSTS = "192.168.1.23"
   .\.venv\Scripts\python.exe manage.py runserver 0.0.0.0:8000
   ```

   IPアドレスは自分のPCの値に置き換えます。`0.0.0.0` はPCのネットワークから接続を受けるための指定です。開発サーバーは他の端末からもアクセスできるため、確認が終わったら `Ctrl+C` で止めてください。
3. `mobile/frontend` に `.env.local` というファイルを作り、次の1行を自分のPCのIPアドレスに変更して保存します。このファイルはGitの共有対象外です。

   ```text
   EXPO_PUBLIC_API_BASE_URL=http://192.168.1.23:8000
   ```

4. 別のPowerShellで `mobile/frontend` に移動し、`npx.cmd expo start --go --lan` を実行します。Expo GoでQRコードを読みます。接続先を変更した場合はExpoを再起動し、アプリを再読み込みしてください。
5. 受信できるテスト用メールアドレスを入力し、認証コードの受信・誤入力・再送・登録完了を確認します。重複登録、誤ったパスワード、ログイン、ログアウトも確認します。パスワードの表示切替と通信中の表示も確認します。iPhoneから `localhost` / `127.0.0.1` を使うとiPhone自身を指すため、PCのIPアドレスを指定します。

接続できなければ、DjangoとExpoが起動中か、IPアドレス、同一Wi-Fi、Expo Goのローカルネットワーク許可、Windowsファイアウォールを確認してください。Wi-Fiによっては端末同士の通信が禁止されます。メールやパスワード、トークンはエラー報告に載せないでください。

### このPCでPythonが起動しない場合

今回の確認時、このPCの `.venv` は元のPythonを起動できませんでした。既存の仮想環境は削除せず、以下の一時的な方法で、インストール済みのDjangoとCodex付属Pythonを使用できます。上の手順2の代わりに、`admin/backend` で実行します。IPアドレスは例を自分の値に変えてください。

```powershell
$env:PYTHONPATH = (Resolve-Path '.venv\Lib\site-packages').Path
$env:DJANGO_EXTRA_ALLOWED_HOSTS = "192.168.1.23"
& 'C:\Users\h_tamaki\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' manage.py migrate
& 'C:\Users\h_tamaki\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' manage.py runserver 0.0.0.0:8000
```

これはこのPCの一時的な回避方法です。後で通常のPython環境を確認し、チームの標準環境に合わせてください。

## チームで決めること・本運用までの課題

- APIの配置とURL、データベースの共有、既存のモバイル向けHTML処理との整理。
- メールの大文字・小文字、パスワード条件、登録後の遷移、ログイン状態の保持期間とアプリ再起動後の扱い。
- 長期ログインが必要なら、iPhoneの安全な保存領域を使う設計、端末紛失時の失効、期限切れトークンの定期削除。
- HTTPS、公開用のDjango設定、認証試行の制限、パスワード再設定、監視など。
- 既存の会員データにメールアドレスの大文字・小文字だけが異なる重複があるとログインできないため、統合前に確認すること。

iPhoneでの実機確認が必要です。
