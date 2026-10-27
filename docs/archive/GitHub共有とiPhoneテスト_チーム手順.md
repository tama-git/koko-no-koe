# GitHubで共有し、各自のiPhoneでテストする手順

作成日：2026年10月27日

## 1．チームでの使い方

GitHubでプログラムと変更履歴を共有し、各自のPCでアプリを起動して、自分のiPhoneでテストします。

共有リポジトリ：**https://github.com/tama-git/koko-no-koe**

| 人 | PC側のExpoログイン | iPhoneのExpo Go | 読み取るQRコード |
| --- | --- | --- | --- |
| Aさん | Aさんのアカウント | Aさんのアカウント | AさんのPCに出たQR |
| Bさん | Bさんのアカウント | Bさんのアカウント | BさんのPCに出たQR |

共有するのはソースコードです。代表者のPCのQRコードを全員で使う手順ではありません。Expoの組織へDeveloperとして招待されていても、iPhone実機で開発サーバーを開くときは、そのPCとiPhoneのアカウントを合わせます。

この方法では、テスト中に各自のPCを起動しておきます。今回のExpo Goでの確認に、EAS Buildの設定は使いません。Expo Goが対応していない機能を追加した段階では、テスト方法を改めて検討します。

## 2．各メンバーが最初に用意するもの

- WindowsのPCとiPhone
- Visual Studio Code、Node.jsのLTS版、Git
- 自分のGitHubアカウントとExpoアカウント
- iPhoneのExpo Go
- 自分のPCとiPhoneをつなぐ同じWi-Fi

インストールやExpo Goの初期画面は、[初めての準備手順](iPhone表示テスト_初めての準備手順.md)の第1〜3項、第5〜6項を確認してください。

GitHubのログインとExpoのログインは、それぞれのサービスで行います。Expoの組織への招待だけでは、GitHubで変更をアップロードする権限は付きません。編集して共有する人は、GitHubのリポジトリにも共同編集者として招待を受けて承諾します。招待はリポジトリの所有者が行います。

このリポジトリは公開設定です。ソースを見る・取得することと、変更をアップロードすることでは必要な権限が異なります。

## 3．初回：GitHubからアプリを取得する

### 3-1．保存先を作る

Visual Studio Codeの「ターミナル」→「新しいターミナル」で、次を1行ずつ実行します。

```powershell
New-Item -ItemType Directory -Path "$env:USERPROFILE\Documents\TabinikkiDev" -Force
Set-Location "$env:USERPROFILE\Documents\TabinikkiDev"
```

### 3-2．GitHubから取得する

```powershell
git clone https://github.com/tama-git/koko-no-koe.git
Set-Location koko-no-koe
code .
```

`clone` は、GitHubのリポジトリを履歴ごと自分のPCへ取得する操作です。

すでに同じ名前のフォルダーがある場合は、同じ場所でcloneを繰り返さず、そのフォルダーを開きます。以前ZIPで展開しただけのフォルダーと混ざらない場所へ取得してください。

`code .` が使えない場合は、Visual Studio Codeの「ファイル」→「フォルダーを開く」から、取得した `koko-no-koe` を開きます。

### 3-3．必要な部品を入れる

Visual Studio Codeで `package.json` と `App.tsx` が見えることを確認し、アプリのフォルダーのターミナルで実行します。

```powershell
npm.cmd ci
```

初回は数分かかる場合があります。`package-lock.json` に記録された組み合わせで部品を入れるため、各自が独自のバージョンへ更新しません。

### 3-4．自分のExpoアカウントでログインする

```powershell
npx.cmd expo login --browser
```

ブラウザで自分のアカウントにログインし、自分が今始めたExpo CLIのログイン画面であることを確認して「Approve」を押します。

```powershell
npx.cmd expo whoami
```

自分のユーザー名が出れば完了です。iPhoneのExpo Goにも、そのアカウントでログインします。ブラウザの自動起動で失敗する場合は、初めての準備手順の第6項を確認してください。

### 3-5．起動してiPhoneで開く

PCとiPhoneを同じWi-Fiにつなぎ、次を実行します。

```powershell
npx.cmd expo start --go --lan
```

1. 自分のPCに表示されたQRコードを、iPhoneの標準カメラで読み取ります。
2. 表示された案内をタップしてExpo Goで開きます。
3. 「旅日記」が表示されることを確認します。
4. 「タップして確認」を押して、回数が増えることを確認します。

## 4．GitHubで管理する基本ルール

- `main`：チームで共有する基準の版
- 作業用ブランチ：担当する変更を進めるための、自分の作業場所
- コミット：変更内容を履歴に記録する操作
- プッシュ：自分の履歴をGitHubへアップロードする操作
- プルリクエスト：作業内容を確認してもらい、共有する版へ取り込むための依頼

チームでは、**作業用ブランチで変更 → 自分のiPhoneで確認 → GitHubへプッシュ → プルリクエストで確認 → mainへ取り込み**、という進め方をおすすめします。

GitHubへアップロードしただけでは、ほかの人のPCのファイルは自動では変わりません。各自が取得・更新して、その版を起動します。

## 5．作業を始めるとき

まず、前回の変更が残っていないか確認します。

```powershell
git status
```

`nothing to commit, working tree clean` と表示され、前回の作業も保存・共有できている場合は、次で共有版を更新します。

```powershell
git switch main
git pull --ff-only
```

変更中のファイルがある、またはまだ共有していないコミットがある場合は、作業内容を確認・保存してから切り替えます。エラーが出たときは、強制上書きや削除で進めず、その表示を共有してください。

`package.json` や `package-lock.json` が更新されていたら、起動前に次を実行します。

```powershell
npm.cmd ci
```

新しい担当作業では、作業用ブランチを作ります。次は名前の例なので、担当者と作業内容に合わせて変えてください。

```powershell
git switch -c feature/your-name-screen
```

前回作ったブランチで続ける場合は、新しく作成せず、既存のブランチへ `git switch ブランチ名` で移動します。

次で起動し、編集しながら自分のiPhoneで確認します。

```powershell
npx.cmd expo start --go --lan
```

## 6．変更を保存して、GitHubで共有する

起動中のターミナルは `Ctrl+C` で終了するか、Git操作用に新しいターミナルを開きます。

### 6-1．コミットする名前を設定する（未設定の人だけ）

このリポジトリ内で次を設定します。引用符の中は、必ず自分の内容に置き換えます。

```powershell
git config user.name "自分のGitHubユーザー名"
git config user.email "自分のGitHubで使うコミット用メールアドレス"
```

コミットには名前とメールアドレスが記録されます。GitHubのメール設定にある自分用のnoreplyアドレスも使えます。

### 6-2．変更を確認する

```powershell
git status
git diff
```

自分のiPhoneで、変更した画面や操作が動くことを確認します。

### 6-3．変更したファイルを保存・アップロードする

次は `App.tsx` を変更した場合の例です。ほかのファイルも変更した場合は、そのファイルも確認して追加します。

```powershell
git add App.tsx
git diff --cached
git commit -m "仮画面の表示を調整"
git push -u origin HEAD
```

GitHubへのログインを求められた場合は、自分のGitHubアカウントで認証します。認証が通っても書き込み権限がない場合は、所有者にGitHubの共同編集者への招待を確認してもらいます。

`package.json` を変更して部品を追加したときは、`package-lock.json` の変更も一緒に共有します。個人の認証情報や秘密の設定値は追加しません。

### 6-4．プルリクエストを作る

GitHubでリポジトリを開き、プッシュしたブランチから `main` へのプルリクエストを作ります。「何を変えたか」「iPhoneで何を確認したか」を記載し、チームで確認して取り込みます。

## 7．ほかの人の作業途中の版をテストする場合

自分の変更が保存できていることを `git status` で確認してから、リモートの情報を取得します。

```powershell
git fetch origin
git branch -r
```

テストしたいブランチ名を確認します。次は例なので、表示された実際の名前へ置き換えます。

```powershell
git switch --track origin/feature/member-screen
```

そのブランチが自分のPCにすでにある場合は、`git switch feature/member-screen` を使います。必要に応じて `git pull --ff-only` で更新します。

部品の一覧が変わっていれば `npm.cmd ci` を実行し、いつもと同じ `npx.cmd expo start --go --lan` で起動します。iPhoneで使うExpoアカウントは自分のもののままで構いません。

どの版でテストしたかを共有するときは、次で出たブランチ名と短いコミット番号を添えます。

```powershell
git branch --show-current
git rev-parse --short HEAD
```

## 8．よくある疑問

**代表者のExpoアカウントへログインする必要はある？**

各自のPCで起動する方式なら、自分のPCと自分のiPhoneで同じExpoアカウントを使います。代表者のパスワードを共有する必要はありません。

**Expoの組織への招待は何に使う？**

Expo上のプロジェクトや、今後利用するビルド・更新配信などをチームで管理するために使います。GitHubへの共同編集者の招待とは別です。

**GitHubへ上げれば、iPhoneのアプリは勝手に最新版になる？**

この開発方法では、各自がPCへ更新を取得し、そのPCから起動した版をiPhoneで確認します。PCなしで配信版を見る仕組みは、別途設定します。

**何も表示されない・接続できない場合は？**

PCとiPhoneのExpoアカウント、同じWi-Fi、ローカルネットワークの許可、Expo GoとSDKの互換性を確認します。詳しくは初めての準備手順の第10項を見てください。

## 公式資料

- [GitHub：リポジトリをPCへ取得する](https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository)
- [GitHub：Gitとチーム開発の基本](https://docs.github.com/en/get-started/using-git/about-git)
- [Expo：iPhone実機で必要なアカウントの一致](https://docs.expo.dev/troubleshooting/expo-go-sign-in-required/)
