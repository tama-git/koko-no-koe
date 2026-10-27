# 環境構築マニュアル

## koko-no-koe / 旅日記

WindowsのPCと、自分のiPhoneで始める開発・テスト

作成日：2026年10月27日

### このマニュアルのゴール

ソフトが何も入っていないPCに開発環境を用意し、GitHubからチームのプログラムを取得します。最後に、自分のiPhoneへ「旅日記」の仮画面を表示し、ボタンが動くことを確認します。

### 作業の全体像

GitHubの共通ソース → 自分のPCで起動 → 自分のiPhoneでテスト

共有するのはプログラムと変更履歴です。メンバー全員が同じExpoアカウントを使う必要はありません。「自分のPC」と「自分のiPhone」のアカウントを合わせます。

### 読む順番

1. 用意するもの・用語
2. PCへソフトをインストール
3. ターミナルでインストール確認
4. GitHubからプログラムを取得
5. ExpoアカウントとiPhoneの準備
6. PCの開発ツールへログイン
7. iPhoneに仮画面を表示
8. 2回目以降の起動・版の更新
9. 困ったときの確認と公式資料

初回は上から順番に進めます。失敗したコマンドがあれば、その段階で表示を確認してから次へ進んでください。

---

## 1．用意するもの・用語

### 用意するもの

- WindowsのPC
- iPhone
- PCとiPhoneのインターネット接続
- PCとiPhoneを接続できる同じWi-Fi
- 自分のGitHubアカウント
- 自分のExpoアカウント

学校の管理されたPCでインストールできない場合は、学校の担当者に確認します。インストール完了までは、次の取得・起動の作業へ進みません。

### このあと出てくる用語

- Visual Studio Code（VS Code）：プログラムを開いて編集するソフト。
- ターミナル：文字で指示を入力する画面。この資料ではWindows PowerShellを使います。
- Node.js：PCでExpoなどを動かすための実行環境。
- npm：アプリに必要な部品をインストールする道具。
- npx：Expoなどのツールを実行する道具。
- Git：プログラムの変更履歴を記録する道具。
- GitHub：チームのプログラムと履歴を共有するサービス。
- リポジトリ：プログラムと履歴をまとめて管理する場所。
- Expo Go：開発中の画面を確認するためにiPhoneへ入れるアプリ。
- Expo CLI：PCのターミナルからExpoを操作するツール。
- SDK：Expoの機能一式のバージョン。この仮画面はSDK 58です。

### アカウントの使い分け

GitHubはソースの取得・変更の共有に使い、ExpoはPCとiPhoneでの起動確認に使います。

Expoの組織にDeveloperとして招待されても、GitHubで書き込む権限は付きません。GitHubへ変更をアップロードする人は、GitHub側でも共同編集者への招待を受け、承諾してください。

今回の表示確認では、EAS Buildの設定は行いません。

---

## 2．PCへソフトをインストール

### 2-1．Visual Studio Code

1. PCのブラウザで、次の公式ページを開きます。
2. Windows用のインストーラーをダウンロードします。
3. ダウンロードしたファイルを開き、内容を確認してインストールします。
4. 追加タスクに「PATHへの追加」があれば有効にします。
5. インストールが終わったらVS Codeを開きます。

公式ページ：https://code.visualstudio.com/download

### 2-2．Node.js

1. 次の公式ページを開きます。
2. Windows用の「LTS」と書かれた版を選びます。
3. PCのCPUに合うインストーラーを選びます。一般的なIntel・AMDのPCはx64、ARMのPCはARM64です。迷ったらWindowsの「設定」→「システム」→「バージョン情報」でシステムの種類を確認します。
4. インストーラーを開き、npmとPATHへの追加を含む標準の構成でインストールします。

公式ページ：https://nodejs.org/ja/download

Node.jsを入れると、npmとnpxも一緒に入ります。

### 2-3．Git

1. 次の公式ページから、PCに合うGit for Windowsのインストーラーを取得します。
2. インストーラーを開きます。
3. PATHの選択画面では、コマンドラインや他のソフトからGitを使える選択肢を選びます。通常は「Git from the command line and also from 3rd-party software」と表示されます。
4. ほかの選択肢は内容を確認し、特別な指定がなければ標準設定で進めます。

公式ページ：https://git-scm.com/install/windows

### この段階の完了条件

3つのソフトのインストールが終わったら、VS Codeと開いているターミナルをいったん閉じ、VS Codeを開き直してください。

---

## 3．ターミナルでインストール確認

### 3-1．入力する画面を開く

1. VS Codeの上のメニューから「ターミナル」→「新しいターミナル」を選びます。英語表示の場合は「Terminal」→「New Terminal」です。
2. 画面下に、文字を入力できる領域が開きます。
3. このマニュアルのコマンドは、そこへ入力します。プログラムの編集画面やブラウザのアドレス欄には入力しません。

### 3-2．最初の4つのコマンド

次を1行ずつ入力し、そのたびにEnterキーを押します。

```powershell
node --version
npm.cmd --version
npx.cmd --version
git --version
```

### 成功したとき

それぞれにバージョン番号が表示されます。表示例は次のとおりです。数字は例で、完全一致させる必要はありません。Node.jsは対応するLTS版を使います。

```text
v24.x.x
11.x.x
11.x.x
git version 2.x.x.windows.x
```

### 失敗したとき

「認識されていません」「見つかりません」と出たら、該当するソフトのインストールと、VS Codeを開き直したかを確認します。

`npm.ps1` や実行ポリシーのエラーが出たら、この資料のように `npm.cmd`・`npx.cmd` を使ってください。設定を変更せずに進められる場合があります。

### コマンド入力のルール

- コード枠の中だけをコピーします。説明文や、ターミナルに元から出ている `PS C:\...>` などは入力しません。
- コマンドの途中で見た目が折り返されても、1つのコマンドはまとめて入力します。
- 処理中は終わるまで待ち、再び入力できる状態になってから次の行を実行します。

---

## 4．GitHubからプログラムを取得

### 4-1．GitHubの準備

GitHubのアカウントがない人は、https://github.com/signup から作成します。すでにある人は、自分のアカウントでログインしてください。

チームのリポジトリ：https://github.com/tama-git/koko-no-koe

ブラウザでページが開くことを確認します。このリポジトリは公開設定です。変更をアップロードする人は、共同編集者への招待も承諾します。

### 4-2．PCに保存先を作る

VS Codeのターミナルで実行します。

```powershell
New-Item -ItemType Directory -Path "$env:USERPROFILE\Documents\TabinikkiDev" -Force
Set-Location "$env:USERPROFILE\Documents\TabinikkiDev"
```

`$env:USERPROFILE` は、自分のWindowsユーザーのフォルダーを表します。そのまま入力してください。

### 4-3．チームのソースを取得する

```powershell
git clone https://github.com/tama-git/koko-no-koe.git
Set-Location koko-no-koe
code .
```

`clone` は初回の取得です。すでに同名のフォルダーがある場合は、同じ場所で繰り返し実行せず、取得済みのフォルダーを開きます。

`code .` が使えない場合は、VS Codeの「ファイル」→「フォルダーを開く」から `koko-no-koe` を開いてください。

### 4-4．必要な部品を入れる

VS Codeの左側に `App.tsx` と `package.json` があることを確認し、そのフォルダーのターミナルで実行します。

```powershell
npm.cmd ci
```

初回は数分かかる場合があります。`package-lock.json` に記録された組み合わせで、各自のPCへ部品が入ります。処理が終わって、入力できる状態に戻れば次へ進みます。

この方法では、各自が `create-expo-app` で別のアプリを新規作成する必要はありません。

---

## 5．ExpoアカウントとiPhoneの準備

### 5-1．自分のExpoアカウントを用意する

アカウントがない人は、PCの普段使うブラウザで https://expo.dev/signup を開き、作成します。メール認証を求められたら認証します。登録に使った方法を覚えておきます。Appleで作った場合、次回も「Continue with Apple」で進めます。

この表示確認のために有料プランへ申し込む必要はありません。

Expoの組織へ招待されている人は、その招待を承諾します。チームで用意したソースを使うので、メンバー全員が同じクラウドプロジェクトを新しく作る必要はありません。新規登録の初期設定で迷った場合は、その画面を共有して確認します。

### 5-2．Expo Goを入れる

1. iPhoneのApp Storeを開き、「Expo Go」を検索します。
2. Expo Goをインストールして開きます。
3. 最初の学習内容の質問では「Skip」で進められます。
4. 下の家のマーク「Home」を開きます。

App Store：https://apps.apple.com/jp/app/expo-go/id982107779

### 5-3．ローカルネットワークを許可する

Homeに「Local Network Access Needed」が出たらタップし、ローカルネットワークへのアクセスを許可します。

設定画面が開く場合は、Expo Goの「ローカルネットワーク」をオンにして、Expo Goへ戻ります。

### 5-4．自分のアカウントでログインする

Expo Goの右上にある人のマークを押し、自分のExpoアカウントでログインします。

このあとPCの開発ツールでも、同じアカウントを使います。代表者や別のメンバーのパスワードは使いません。

---

## 6．PCの開発ツールへログイン

### 6-1．ログインを開始する

アプリのフォルダーを開いたVS Codeのターミナルで実行します。

```powershell
npx.cmd expo login --browser
```

ブラウザが開いたら、iPhoneと同じExpoアカウントでログインします。すでにログイン済みなら、そのアカウントを確認します。

### 6-2．自分が始めたログインを承認する

「Allow expo-cli to access your Expo account?」という画面が出たら、表示されたアカウントが自分のものかを確認します。今実行したExpo CLIのログインに対する確認画面であることを確認し、「Approve」を押します。

ブラウザに「Authentication successful」、またはターミナルに「Logged in」が出れば、連携が完了しています。

### 6-3．コマンドで確認する

```powershell
npx.cmd expo whoami
```

自分のユーザー名が出ることを確認します。`Not logged in` の場合は、開発ツールへのログインがまだ完了していません。

**ExpoのWebサイトへのログインと、PCの開発ツールとの連携は、両方の確認が必要です。**

### 自動起動するブラウザで失敗した場合

失敗した処理が動いていれば `Ctrl+C` で終了し、次を実行します。

```powershell
$env:BROWSER = 'none'
npx.cmd expo login --browser
```

表示された `https://expo.dev/login?...` のURL全体をコピーし、Expoにログインしているブラウザのアドレス欄へ貼り付けて開きます。ログイン待ちのターミナルは閉じないでください。

「Approve」まで進め、処理が終了したら `npx.cmd expo whoami` で確認します。過去のURLではなく、今回ターミナルへ表示されたURLを使います。

---

## 7．iPhoneに仮画面を表示

### 7-1．接続を確認する

- 自分のPCとiPhoneを同じWi-Fiにつなぎます。
- PCの `expo whoami` と、iPhoneのExpo Goのユーザーが同じであることを確認します。

### 7-2．PCで起動する

VS Codeのアプリのフォルダーのターミナルで実行します。

```powershell
npx.cmd expo start --go --lan
```

ターミナルにQRコードと、`exp://...` から始まる接続先が表示されます。これは自分のPCの開発サーバーへの接続先です。

### 7-3．自分のiPhoneで読み取る

1. iPhoneの標準の「カメラ」を開きます。
2. 自分のPCのターミナルに出たQRコードを読み取ります。
3. 表示された案内をタップしてExpo Goで開きます。
4. 初回の読み込みが終わるまで待ちます。

代表者のPCで出した過去のQRコードは使いません。Expoの組織への招待が済んでいても、PCとiPhoneのアカウントを合わせる条件は変わりません。

### 7-4．成功を確認する

- 「旅日記」と「iPhone 表示テスト」が表示される。
- 「タップして確認」を押すと、「タップできました！ 1回」などと表示される。
- もう一度押すと回数が増える。

ここまで確認できれば、最初の環境構築と実機テストは完了です。現在の仮画面では、位置情報や写真はまだ使いません。

### 終了する

PCの起動中のターミナルで `Ctrl+C` を押します。テスト中は、PCと起動中のターミナルを開いたままにしてください。

---

## 8．2回目以降の起動・版の更新

### 同じ版をもう一度起動するとき

VS Codeで取得済みの `koko-no-koe` フォルダーを開き、次を実行します。

```powershell
npx.cmd expo whoami
npx.cmd expo start --go --lan
```

ログインが切れていたら、第6項のログインを行います。毎回cloneしたり、新しくアプリを作ったりする必要はありません。

### チームが共有した最新版へ更新するとき

まず、自分の作業が残っていないか確認します。

```powershell
git status
```

作業中のファイルがなく、自分の変更も保存・共有できている場合に、次を実行します。

```powershell
git switch main
git pull --ff-only
```

`package.json` や `package-lock.json` が更新されたら、起動前に `npm.cmd ci` を実行します。変更中のファイルがある場合や、更新に失敗した場合は、表示を確認してから進めます。

GitHubへ変更が上がっても、自分のPCやiPhoneが自動でその版になるわけではありません。取得した版を自分のPCから起動して確認します。

### チームで開発するとき

自分の作業用ブランチで編集し、自分のiPhoneでテストします。変更をコミット・プッシュし、プルリクエストで確認してから `main` に取り込む流れをおすすめします。

詳しいコマンドは、リポジトリの「GitHub共有とiPhoneテスト_チーム手順.md」を確認してください。

どの版をテストしたかは、次で確認できます。

```powershell
git branch --show-current
git rev-parse --short HEAD
```

---

## 9．困ったときの確認

### コマンドが認識されない

ソフトのインストールと、VS Codeを開き直したかを確認します。`npm.ps1` のエラーなら、`npm.cmd`・`npx.cmd` を使います。

### package.jsonが見つからない

別のフォルダーで実行している可能性があります。VS Codeで `koko-no-koe` を開き直し、そのフォルダー内に `package.json` があるか確認します。

### 別アカウントだと言われる

PCで `npx.cmd expo whoami` を実行し、iPhoneのExpo Goのユーザーと合わせます。別アカウントへ切り替えた後は、PCのサーバーを `Ctrl+C` で止めて起動し直します。

### 読み込みが終わらない

同じWi-Fiか、PCのサーバーが動いているか、ローカルネットワークを許可したかを確認します。学校のWi-Fiでは、同じネットワークでも端末同士の通信が制限される場合があります。

通常の接続が使えない場合は、サーバーを終了して次を試します。

```powershell
npx.cmd expo start --go --tunnel
```

追加ツールの案内が出たら内容を確認して進めます。ngrokが見つからない場合は、`npm.cmd install --global @expo/ngrok` を実行してから再度起動します。PC・iPhoneの両方にインターネット接続が必要で、通常より遅くなる場合があります。

### SDKのバージョンが対応していない

この共有版はExpo SDK 58です。Expo Go側の対応SDKと合う必要があります。独断でチームの部品を更新せず、エラーの画面を共有して対応版を確認します。

### 相談するときに送るもの

iPhoneの画面、PCのターミナルのエラー、実行したコマンド、同じWi-Fiかどうかを伝えます。パスワードや認証用コードはスクショに含めません。

---

## 公式資料と補足

### 公式資料

- VS CodeのWindows版インストール：https://code.visualstudio.com/docs/setup/windows
- Node.jsのダウンロード：https://nodejs.org/ja/download
- Git for Windows：https://git-scm.com/install/windows
- GitHubのリポジトリ取得：https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository
- Expoの起動と実機接続：https://docs.expo.dev/get-started/start-developing/
- Expo GoとPCのアカウント一致：https://docs.expo.dev/troubleshooting/expo-go-sign-in-required/

### この資料の前提

WindowsのPCとiPhoneを対象にしています。インストール画面の表記やExpo Goの対応バージョンは、ソフトの更新により変わる場合があります。

この資料は、今回用意したExpo SDK 58の仮画面に合わせて作成しました。画面表示・ボタン操作以外の本来の機能は、今後実装してテストします。

作成時にPC上でコードのチェックとiPhone向けデータの生成は確認済みです。各メンバーのPC・iPhoneでの表示とタップ操作は、この手順に沿って別途確認してください。
