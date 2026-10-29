# ここの声 / koko-no-koe

iPhoneアプリと、PCブラウザーで使う管理者画面の開発リポジトリです。現在は両方とも表示確認用の仮画面です。

## フォルダー

```text
koko-no-koe/
├─ mobile/            モバイル側
│  ├─ frontend/       iPhoneアプリ（React Native・Expo）
│  └─ backend/        モバイル向け処理の置き場所（未実装）
├─ admin/             管理者側
│  ├─ frontend/       管理者画面のHTML・CSS
│  └─ backend/        管理者画面を動かすDjango
├─ docs/              説明資料・チーム向け手順書
├─ .gitignore
├─ LICENSE
└─ README.md
```

管理者画面のHTML・CSSは `admin/frontend/` にあります。Djangoがこれを読み込んで表示するので、管理者側を動かすためのNode.jsサーバーは不要です。

`mobile/backend/` は説明ファイルだけの準備用フォルダーです。iPhoneと管理者側で共有するAPI・データベースの構成は、実装前に決定します。

## チームの人が最初に読む資料

- **すでにiPhoneで表示できた人**：[チームの起動手順](docs/01_チームの起動手順.md)
- **これから準備する人**：[初めての環境構築](docs/02_初めての環境構築.md)
- **編集する場所・GitHub共有の方法**：[フォルダー構成と開発手順](docs/03_フォルダー構成と開発手順.md)

説明資料は [docs](docs/README.md) にまとめています。旧構成の手順書は `docs/archive/` に保管しています。通常は上の最新版を使ってください。

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

### ターミナル②：管理者用の仮ページ

Python 3.13のインストール後、新しいターミナルをリポジトリのルートで開いて実行します。

```powershell
Set-Location .\admin\backend
py -3.13 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
```

仮想環境の作成は初回のみ、部品のインストールは初回または `requirements.txt` の変更時に行います。仮想環境を有効化する操作は不要です。

PCのChromeまたはEdgeで **http://127.0.0.1:8000/** を開きます。Expoアカウントや管理者用のパスワードは、この仮ページでは使いません。

## 現在確認できること

- iPhone：タイトルの表示、ボタンでタップ回数が増えること
- 管理者：サンプル通報の一覧、状態の絞り込み、詳細への移動、一覧に戻る操作

管理者の認証・権限、実際の投稿・通報の保存、投稿の非表示、iPhoneとのデータ共有は未実装です。管理者ページは架空データを使うローカル開発専用で、インターネット公開用ではありません。

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
