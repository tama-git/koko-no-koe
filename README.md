# ここの声 / koko-no-koe

iPhoneアプリと、PCブラウザーで使う管理者コンソールの開発リポジトリです。画面の実装場所と未接続の雛形は [画面と機能の分担ガイド](docs/04_画面と機能の分担ガイド.md) を参照してください。

## フォルダー

```text
koko-no-koe/
├─ mobile/            モバイル側
│  └─ frontend/       iPhoneアプリ（React Native・Expo）
├─ admin/             管理者側
│  ├─ frontend/       管理者画面のHTML・CSS
│  └─ backend/        管理者画面とモバイルAPIを動かすDjango
├─ docs/              説明資料・チーム向け手順書
├─ .gitignore
├─ LICENSE
└─ README.md
```

管理者画面のHTML・CSSは `admin/frontend/` にあります。Djangoがこれを読み込んで表示するので、管理者側を動かすためのNode.jsサーバーは不要です。

モバイルAPIとデータベースの設定は管理者コンソールと同じ `admin/backend/` にあります。APIのURLは [DjangoのURL設定](admin/backend/config/urls.py) を参照してください。

## チームの人が最初に読む資料

- **すでにiPhoneで表示できた人**：[チームの起動手順](docs/01_チームの起動手順.md)
- **これから準備する人**：[初めての環境構築](docs/02_初めての環境構築.md)
- **編集する場所・GitHub共有の方法**：[フォルダー構成と開発手順](docs/03_フォルダー構成と開発手順.md)
- **画面・機能を分担して作る人**：[画面と機能の分担ガイド](docs/04_画面と機能の分担ガイド.md)

説明資料は [docs](docs/README.md) にまとめています。旧構成の手順書は `docs/archive/` に保管しています。通常は上の最新版を使ってください。

## 投稿場所の地名表示

Djangoを起動するPCで [Geoapifyの管理画面](https://myprojects.geoapify.com/) からAPIキーを取得し、リポジトリのルートで初回設定を行います。入力欄にコピーしたキー全体を貼り付けます。入力は画面に表示されません。

```powershell
.\start-dev.ps1 -ConfigureGeoapify
```

キーはWindowsのユーザー・PCに紐づけて暗号化し、`%LOCALAPPDATA%\koko-no-koe\geoapify.clixml` に保存します。次回からは `.\start-dev.ps1` で保存済みキーを読み込み、Djangoの `GEOAPIFY_API_KEY` に渡します。既に同じPowerShellにキーを設定している場合は、その値を優先します。サブDjangoのPCでも初回設定を行ってください。キーを交換するときも `-ConfigureGeoapify` を使います。

キーはExpoの環境変数やGitに入れないでください。設定済みのキーを使ってDjangoが投稿時や施設検索時にGeoapifyへ問い合わせます。この変更を使うDBには投稿アプリのマイグレーション `0005_post_place` を適用してからDjangoを起動します。地名が空の投稿は「この付近」と表示し、新規投稿の地名取得に失敗した理由はDjangoのログで確認できます。

既存投稿の地名を補う場合は、`admin/backend` で対象件数を確認します。

```powershell
.\.venv\Scripts\python.exe manage.py backfill_post_places --settings=config.settings
```

同じコマンドに `--apply` を付けると、地名が空で有効な座標がある既存投稿（非公開・非表示を含む）の座標をGeoapifyへ送信し、取得できた地名と出典を保存します。既存投稿の座標送信が承認された範囲で実行してください。処理が中断した場合は、保存済みの地名を保持したまま再実行できます。

投稿時は公開設定にかかわらず、地名取得のために投稿地点の緯度・経度をGeoapifyへ送信します。投稿入力画面の「確認画面へ進む」の前に、この送信を案内します。公開に向けて、プライバシーポリシーにも利用目的・送信項目・送信先・処理地域と [Geoapifyのプライバシーポリシー](https://www.geoapify.com/privacy-policy/) を記載してください。

## 起動の早見表（Windows PowerShell）

以下はリポジトリのルート（このREADMEがある場所）から実行します。コードは1行ずつ入力し、エラーが出たら次へ進まず内容を確認してください。

### ターミナル①：iPhone

```powershell
Set-Location .\mobile\frontend
npm.cmd ci
npx.cmd expo whoami
npx.cmd expo start --go --lan
```

`npm.cmd ci` は初回または依存関係が変わったときに実行します。ログイン済みであれば、毎回ログインする必要はありません。`Not logged in` の場合は [起動手順](docs/01_チームの起動手順.md) のログイン手順を使います。PCとiPhoneは各自の同じExpoアカウント・同じWi-Fiで接続してください。

### ターミナル②　管理者コンソールとモバイルAPI

Python 3.13のインストール後、新しいターミナルをリポジトリのルートで開いて実行します。

```powershell
Set-Location .\admin\backend
py -3.13 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
```

仮想環境の作成は初回のみ、部品のインストールは初回または `requirements.txt` の変更時に行います。仮想環境を有効化する操作は不要です。

PCのChromeまたはEdgeで `http://127.0.0.1:8000/` を開くと、管理者ログイン画面に移動します。管理者コンソールでは、投稿・通報・問い合わせの一覧と対応操作を利用できます。

## 確認コマンド

`mobile/frontend/` で：

```powershell
npx.cmd tsc --noEmit
npx.cmd expo export --platform ios --output-dir dist
```

`admin/backend/` で：

```powershell
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe manage.py test
```
