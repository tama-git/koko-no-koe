# koko-no-koe

## 旅日記：iPhone表示テスト

タイトルと「タップして確認」ボタンだけの仮画面です。ボタンを押すと回数が増えます。データ保存・地図・位置情報・写真の機能はまだありません。

何も準備していないPCから始める人は、[環境構築マニュアル](環境構築マニュアル_Windows_iPhone.md)を上から順番に進めてください。[PDF版](docs/環境構築マニュアル_Windows_iPhone.pdf)もあります。

新規作成やZIP共有の補足は、[iPhone表示テスト：初めての準備手順](iPhone表示テスト_初めての準備手順.md)にまとめています。

GitHubから取得して各自のiPhoneでテストする流れは、[GitHub共有とiPhoneテスト：チーム手順](GitHub共有とiPhoneテスト_チーム手順.md)にまとめています。

共有リポジトリ：https://github.com/tama-git/koko-no-koe

GitHubで同じソースを共有し、各自のPCでExpoを起動して、自分のiPhoneで確認します。PCとiPhoneは、その人自身の同じExpoアカウントを使います。

## 起動する

Visual Studio Codeでこのフォルダーを開きます。共有版を初めて取得したときは、ターミナルで必要な部品をインストールします。

```powershell
npm.cmd ci
```

PCの開発ツールとiPhoneのExpo Goは、同じExpoアカウントでログインします。PCでは次を実行して、ブラウザでのログイン・承認を完了します。

```powershell
npx.cmd expo login --browser
npx.cmd expo whoami
```

ユーザー名が表示されたら起動します。ログイン済みの場合は、ログイン操作を繰り返す必要はありません。

```powershell
npx.cmd expo start --go --lan
```

PCとiPhoneを同じWi-Fiにつなぎ、PCに表示されるQRコードをiPhoneの標準カメラで読み取ってExpo Goで開きます。Expo Goからローカルネットワークへのアクセス許可を求められたら許可します。PCのターミナルは開いたままにしてください。

接続できない場合はエラー画面と、PC側のターミナルの表示を確認します。学校のWi-Fiでは端末同士の通信が制限されている場合があるため、その場合は別の接続方法を検討します。

Expo GoとアプリのSDKバージョンが合わない場合は、エラーに表示された対応バージョンに合わせて調整します。このプロジェクトはExpo SDK 58で作成しました。

終了するときはPCのターミナルで `Ctrl+C` を押します。

## 編集する場所

- `App.tsx`：仮画面の表示とボタンの動作
- `app.json`：アプリ名などの設定

## PCでの確認

```powershell
npx.cmd tsc --noEmit
npx.cmd expo export --platform ios --output-dir dist
```

iPhone上での表示とタップ操作は実機で別途確認します。EAS Buildの設定はまだ行っていません。
