# 旅日記：初めてのiPhone表示テスト

作成日：2026年10月27日

WindowsのPCとiPhoneを使い、初めて準備する人向けの手順です。目標は、iPhoneに仮画面を表示して、ボタンを押せることを確認するところまでです。

## 1．用意するもの

- WindowsのPC
- iPhone
- インターネット接続
- PCとiPhoneを接続できる同じWi-Fi
- 自分のExpoアカウント

**PCとiPhoneは、自分の同じExpoアカウントでログインします。メンバー全員で1つのパスワードを使う必要はありません。**

**この資料は「各自のPCでアプリを起動し、各自のiPhoneで確認する」手順です。** チームの組織にDeveloperとして招待しても、代表者のPCで起動中の画面を、別アカウントのiPhoneから同じQRコードで開けるようにはなりません。

メンバーがPCを起動せず、iPhoneだけで共有版を見たい場合は、別途プレビューの配信を設定します。Expo Goに対応する構成なら、組織所有のプロジェクトへEAS Updateを配信する方法があります。対応SDKや設定の確認が必要で、この資料の手順ではその配信は行いません。

この手順はExpo Goでの表示確認です。EAS Buildの設定は、今回は行いません。

## 2．PCに必要なソフトをインストールする

以下の公式サイトからインストールします。すでに入っているものは、入れ直す必要はありません。

| ソフト | 用途 | 公式サイト |
| --- | --- | --- |
| Visual Studio Code | プログラムを編集する | https://code.visualstudio.com/ |
| Node.jsのLTS版 | Expoを動かす | https://nodejs.org/ja/download |
| Git | チームでプログラムを共有・管理する | https://git-scm.com/downloads/win |

Node.jsを入れると、npmとnpxも一緒に入ります。npmは必要な部品を入れるため、npxはExpoなどのツールを実行するために使います。

インストール後は、開いているVisual Studio Codeとターミナルを一度閉じ、開き直します。

## 3．最初に実行するコマンド

Visual Studio Codeで、上のメニューから「ターミナル」→「新しいターミナル」を開きます。Windows PowerShellを使う想定です。

次を1行ずつ入力します。

```powershell
node --version
npm.cmd --version
npx.cmd --version
git --version
```

すべてバージョン番号が出れば、次へ進みます。番号そのものが、この資料を作ったPCと完全に同じである必要はありません。Node.jsはExpoが対応するLTS版を使います。

「見つかりません」「認識されていません」と出たら、そのソフトのインストールと、ターミナルを開き直したかを確認します。

この手順では、PowerShellの実行ポリシーに影響されにくいように `npm.cmd` と `npx.cmd` を使います。

## 4．アプリのフォルダーを用意する

**A・B・Cのどれか一つだけを行ってください。チームではGitHubで管理する方針なので、Cを使います。AはZIPで確認する場合、Bは練習用に新規作成する場合の手順です。**

### A．共有された仮画面を使う

1. 配布された `tabinikki-mobile_共有用.zip` をPCに保存します。
2. ZIPを右クリックして「すべて展開」を選びます。ZIPの中を表示したまま作業せず、必ず展開してください。
3. 展開先にある `tabinikki-mobile` フォルダーを確認します。
4. Visual Studio Codeで「ファイル」→「フォルダーを開く」から、そのフォルダーを開きます。
5. 左側に `App.tsx` と `package.json`、`package-lock.json` が表示されていれば、正しいフォルダーです。
6. 「ターミナル」→「新しいターミナル」を開き、次を実行します。

```powershell
npm.cmd ci
```

必要な部品がインストールされます。初回は数分かかる場合があります。入力できる状態に戻るまで待ちます。

共有版はExpo SDK 58で作成しています。Expo Go側にもSDK 58への対応が必要です。SDKは、Expoの機能一式のバージョンを指します。

### B．何もない状態から、自分で新規作成する

この方法では、まずExpo標準の仮画面を作ります。共有版の旅日記の画面とは表示内容が異なります。

ターミナルで、作業用フォルダーを用意します。

```powershell
New-Item -ItemType Directory -Path "$env:USERPROFILE\Documents\TabinikkiDev" -Force
Set-Location "$env:USERPROFILE\Documents\TabinikkiDev"
```

続けて、アプリを新規作成します。次の長いコマンドは、全体を1行として実行してください。

```powershell
npx.cmd --yes create-expo-app@5.0.0 tabinikki-mobile --template blank-typescript@sdk-58 --no-install --no-agents-md --yes
```

アプリのフォルダーへ移動して、必要な部品を入れます。

```powershell
Set-Location tabinikki-mobile
npm.cmd install
code .
```

最後の `code .` は、このフォルダーをVisual Studio Codeで開くコマンドです。使えない場合は「ファイル」→「フォルダーを開く」から同じフォルダーを開いてください。

**すでに `tabinikki-mobile` フォルダーがある場合、新規作成コマンドは繰り返し実行しません。** そのフォルダーを開いて作業を再開します。

SDK 58を指定しているのは、この資料の共有版と合わせるためです。Expo Goの対応バージョンが異なる場合は、第10項を確認してください。

### C．GitHubからチームのアプリを取得する

作業用フォルダーを用意し、GitHubから取得します。

```powershell
New-Item -ItemType Directory -Path "$env:USERPROFILE\Documents\TabinikkiDev" -Force
Set-Location "$env:USERPROFILE\Documents\TabinikkiDev"
git clone https://github.com/tama-git/koko-no-koe.git
Set-Location koko-no-koe
code .
npm.cmd ci
```

すでに取得済みの場合はcloneを繰り返さず、同じフォルダーを開きます。以降のログイン・起動は第5〜8項へ進みます。変更の共有やGitHubからの更新は、[GitHub共有とiPhoneテスト：チーム手順](GitHub共有とiPhoneテスト_チーム手順.md)を確認してください。

## 5．iPhoneにExpo Goを入れる

1. App Storeで「Expo Go」を検索してインストールします。
2. Expo Goを開きます。
3. 最初の学習内容の質問は、画面下の「Skip」で進めます。
4. 下の「Home」を開きます。
5. 「Local Network Access Needed」が出ていたらタップし、ローカルネットワークへのアクセスを許可します。
6. 設定画面へ移動した場合は、Expo Goの「ローカルネットワーク」をオンにして、Expo Goへ戻ります。

公式のApp Storeページ：https://apps.apple.com/jp/app/expo-go/id982107779

初回画面の表示は、Expo Goのバージョンによって変わる場合があります。

## 6．Expoアカウントを用意して、PCとiPhoneでログインする

### アカウントがまだない場合

PCの普段使うブラウザで https://expo.dev/signup を開き、アカウントを作成します。メール認証を求められたら認証します。今回の表示確認のために有料プランを選ぶ必要はありません。

登録後に初期設定が出た場合の入力例です。

- アカウントの種類：今回の個人の学習・表示確認では「Personal」
- Organization name／slug：自動入力された内容を確認して進める
- Invite members、Organization avatar：任意なので、今回の表示確認では未入力で進められる
- Create a project：新規プロジェクトを作る場合の例は、Display nameが「旅日記（表示テスト）」、Slugが「tabinikki-mobile」

すでにチームで用意したプロジェクトを使う場合、各自が同じクラウドプロジェクトを作り直す必要はありません。表示される案内が違う場合は、画面を確認して進めてください。

### PCの開発ツールにログインする

Visual Studio Codeで、アプリの `package.json` があるフォルダーを開きます。ターミナルで次を実行します。

```powershell
npx.cmd expo login --browser
```

ブラウザが開いたら、作成したExpoアカウントでログインします。Appleで登録した場合は「Continue with Apple」など、登録時と同じ方法を使います。

「Allow expo-cli to access your Expo account?」が出たら、アカウントが自分のものかを確認し、**自分が今実行したログインに対する画面であることを確認して「Approve」**を押します。

ターミナルに `Logged in`、またはブラウザに `Authentication successful` と出れば、開発ツールへのログインが完了しています。

続けて、次で確認します。

```powershell
npx.cmd expo whoami
```

自分のユーザー名が表示されれば完了です。`Not logged in` なら、開発ツールへのログインはまだ完了していません。

**ExpoのWebサイトにログインしただけでは、PCの開発ツールへのログインが完了していない場合があります。上のコマンドで確認してください。**

### ブラウザが開かない・自動起動でエラーになる場合

必要に応じて `Ctrl+C` で失敗した処理を終了してから、次を実行します。

```powershell
$env:BROWSER = 'none'
npx.cmd expo login --browser
```

ターミナルに表示された **`https://expo.dev/login?...` から始まるURL全体**をコピーし、Expoにログインしているブラウザ（例：Chrome）のアドレス欄に貼り付けて開きます。

このログイン待ちのターミナルは閉じずに残します。「Approve」まで進め、処理が終わったら `npx.cmd expo whoami` を実行してください。

別のブラウザで開くとログイン状態が引き継がれないため、再度ログインが必要になる場合があります。過去のログイン用URLは再利用せず、今表示されたURLを使います。

### iPhoneでログインする

Expo Goの右上の人のマークから、**PCの `expo whoami` に表示されたユーザーと同じアカウント**でログインします。

## 7．PCで仮画面を起動する

PCとiPhoneを同じWi-Fiにつなぎます。PC側で、アプリのフォルダーのターミナルから次を実行します。

```powershell
npx.cmd expo start --go --lan
```

QRコードと `exp://...` から始まる接続先が表示されれば、読み取りに進めます。ターミナルは開いたままにしてください。

**各自が、その時に自分のPCへ表示されたQRコードを使ってください。** 接続先はPCやネットワークによって変わるため、この資料を作った人のQRコードを使い回す手順にはしません。

## 8．iPhoneでQRコードを読み取る

1. iPhoneの標準の「カメラ」を開きます。
2. PCのターミナルに表示されたQRコードを読み取ります。
3. 表示された案内をタップして、Expo Goで開きます。
4. 最初の読み込みが終わるまで待ちます。

### 成功の確認

第4項のAまたはCで共有版を使った場合は、次を確認します。

- 「旅日記」「iPhone 表示テスト」が表示される
- 「タップして確認」を押すと、「タップできました！ 1回」などと回数が増える

第4項のBで新規作成した場合は、Expo標準の `Open up App.tsx...` などの画面が表示されれば、接続は成功です。共有版と同じ旅日記の画面にするには、配布ZIPにある `App.tsx` を自分のプロジェクトの `App.tsx` にコピーして保存します。

## 9．2回目以降の起動と終了

2回目以降は、Visual Studio Codeで同じアプリのフォルダーを開き、次を実行します。

```powershell
npx.cmd expo whoami
npx.cmd expo start --go --lan
```

ログインが切れていた場合は、第6項でログインし直します。毎回の新規作成や、毎回の `npm install` は不要です。

GitHubやZIPからソース一式を新しく取得したとき、またはチームで必要な部品の一覧が変わったときは、起動前に次を実行します。

```powershell
npm.cmd ci
```

このコマンドは `package-lock.json` がある共有プロジェクトで使います。作業中のサーバーがあれば終了してから実行します。

終了するときは、起動中のターミナルで `Ctrl+C` を押します。PCのサーバーを終了すると、開発中のアプリの読み込み・更新もできなくなります。

## 10．うまくいかない場合

| 状況 | 確認すること |
| --- | --- |
| `node` や `npm` が認識されない | Node.jsをインストールしたか。インストール後にVisual Studio Codeとターミナルを開き直したか |
| `npm.ps1` の実行が禁止されている | この資料どおり `npm.cmd`／`npx.cmd` を使う |
| `package.json` が見つからない | アプリのフォルダーを開いているか。展開先のさらに内側に `tabinikki-mobile` がないか |
| PCで `Not logged in` と出る | `npx.cmd expo login --browser` とブラウザでの「Approve」を完了する |
| アカウントについてエラーが出る | PCの `expo whoami` とiPhoneのユーザーが同じか。ログイン後にサーバーを起動し直したか |
| Expo Goのバージョンが対応していないと出る | エラーに書かれた対応SDKと、アプリのSDKを確認する。この共有版はSDK 58。チームの部品を独断で更新せず、表示を共有してバージョンをそろえる |
| Homeにアプリが表示されない | まずPCのターミナルのQRコードを標準カメラで読み取る。ローカルネットワークの許可も確認する |
| 読み込みが続く・タイムアウトする | 同じWi-Fiか、PCのサーバーが動いているか。学校のWi-Fiでは端末間通信が制限される場合がある |
| 使用中のポートについて質問される | 既に起動済みのターミナルを確認する。別のポートで起動した場合は、新しく出たQRコードを読む |

### 学校のWi-Fiなどで接続できないときの別の方法

サーバーを `Ctrl+C` で終了し、次で起動します。

```powershell
npx.cmd expo start --go --tunnel
```

追加ツールのインストールを求められたら内容を確認して進めます。ngrokが見つからない場合は、Expo公式手順にある次のインストールを行い、上の起動コマンドを再実行します。

```powershell
npm.cmd install --global @expo/ngrok
```

この方法はインターネットを経由するため、通常の接続より遅くなることがあります。PCとiPhoneの両方にインターネット接続が必要です。起動後に出る新しいQRコードを読み取ってください。

### 相談するときに共有するもの

- iPhoneに出たエラー画面
- PCのターミナルに出たエラー
- 実行したコマンド
- PCとiPhoneが同じWi-Fiか

## 11．チームで使うときの注意

- 全員が同じソース一式と `package-lock.json` を使います。
- 共有ZIPには必要なソースと手順書を入れています。`node_modules`、`.expo`、個人のログイン情報は入れていません。
- GitHubの共有先は https://github.com/tama-git/koko-no-koe です。GitHubから取得した場合も、各自のPCで必要な部品を入れます。
- 各自のPCでサーバーを動かす場合、その人のPCとiPhoneのExpoアカウントを合わせます。
- Expo上の組織やプロジェクトのメンバー設定、GitHubへの招待などは、チーム共有を設定する段階で別途行います。

## 参考にした公式資料

- [Expo：開発環境とプロジェクト作成](https://docs.expo.dev/get-started/create-a-project/)
- [Expo：起動・iPhoneでのログイン・QRコード接続](https://docs.expo.dev/get-started/start-developing/)
- [Expo：iPhone実機ではPCとExpo Goのアカウント一致が必要](https://docs.expo.dev/troubleshooting/expo-go-sign-in-required/)
- [Expo：EAS Updateで配信されたプロジェクトへの組織メンバーのアクセス](https://expo.dev/changelog/expo-go-loading-changes-may-2026)
- [Expo CLI：起動オプション・トンネル接続](https://docs.expo.dev/more/expo-cli/)

公式資料のテンプレート例やExpo Goの対応バージョンは、更新により変わる場合があります。この資料では今回用意したSDK 58のプロジェクトに合わせて記載しています。
