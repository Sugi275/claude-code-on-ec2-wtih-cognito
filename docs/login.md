# ログイン方法と初期設定

AWS 管理者からお知らせされた URL にブラウザでアクセスし、Claude Code を使い始めるまでの手順です。

---

## 1. 招待メールを確認

AWS 管理者がデプロイを完了すると、登録されたメールアドレスに招待メールが届きます。メールに記載されている **メールアドレス** と **仮パスワード** を確認してください。

![招待メール](assets/login-01-invite-email.png)

## 2. ログイン画面にアクセス

管理者から通知された URL をブラウザで開きます。ログイン画面が表示されます。

- **Email address**: 招待メールに記載されたメールアドレスを入力
- **Password**: 招待メールに記載された仮パスワードを入力

入力したら **Sign in** ボタンをクリックします。

![ログイン画面](assets/login-02-signin.png)

## 3. パスワードを変更

初回ログイン時はパスワードの変更を求められます。

- **New password**: 新しいパスワードを入力
- **Confirm new password**: 同じパスワードをもう一度入力

パスワードは以下の条件を満たす必要があります。
- 8 文字以上
- 数字を含む
- 小文字を含む
- 大文字を含む

入力したら **Change password** ボタンをクリックします。

![パスワード変更](assets/login-03-change-password.png)

## 4. MFA (多要素認証) を設定

セキュリティ強化のため、認証アプリによる MFA の設定が必要です。

### 認証アプリの準備

スマートフォンに以下のいずれかの認証アプリをインストールしてください（まだインストールしていない場合）。

- **Google Authenticator** (iOS / Android)
- **Microsoft Authenticator** (iOS / Android)
- **Authy** (iOS / Android)

### QR コードをスキャン

画面に表示された **QR コード** を認証アプリでスキャンします。QR コードが読み取れない場合は、**Show secret key** をクリックして表示されるキーを認証アプリに手動で入力してください。

### 確認コードを入力

認証アプリに表示される 6 桁のコードを **Enter code** 欄に入力し、**Sign in** ボタンをクリックします。

![MFA 設定](assets/login-04-mfa-setup.png)

## 5. ログイン完了

code-server (ブラウザ版 VS Code) の画面が表示されたらログイン完了です。

![code-server Welcome](assets/login-05-codeserver-welcome.png)

> 2 回目以降のログインでは、メールアドレス・パスワード・認証アプリのコードを入力するだけです。パスワード変更や MFA 設定は不要です。

---

## 6. 作業フォルダを開く

左側のサイドバーにある **エクスプローラーアイコン** (一番上のファイルアイコン) をクリックし、**Open Folder** ボタンをクリックします。

![Open Folder](assets/install-01-open-folder.png)

フォルダ一覧から **claudecode** をクリックします。

![claudecode を選択](assets/install-02-select-claudecode.png)

パスが `/home/ubuntu/claudecode/` になっていることを確認して、**OK** ボタンをクリックします。

![OK をクリック](assets/install-03-ok.png)

「Do you trust the authors of the files in this folder?」というダイアログが表示されます。**Trust the authors of all files in the parent folder 'ubuntu'** にチェックを入れて、**Yes, I trust the authors** ボタンをクリックします。

![Trust](assets/install-04-trust.png)

## 7. ターミナルを開く

画面左上の **ハンバーガーメニュー** (≡) をクリックし、**Terminal** → **New Terminal** を選択します。

![New Terminal](assets/install-05-new-terminal.png)

画面下部にターミナルが表示されます。`ubuntu@ip-xxx:~$` というプロンプトが表示されたら準備完了です。

![ターミナル](assets/install-06-terminal-opened.png)

## 8. Claude Code を起動

ターミナルに以下のコマンドを入力して Enter を押します。

```
claude
```

![claude コマンド](assets/install-07-claude-command.png)

初回起動時にテーマの選択画面が表示されます。お好みのテーマを選んでください。おすすめは **Dark mode** です。↑↓ キーで選択し、Enter で決定します。

![テーマ選択](assets/install-08-theme-select.png)

## 9. Amazon Bedrock に接続

### ログイン方法を選択

「Select login method」が表示されます。↑↓ キーで **3. 3rd-party platform** を選択して Enter を押します。

![3rd-party platform](assets/install-09-3rd-party.png)

### プラットフォームを選択

**1. Amazon Bedrock** を選択して Enter を押します。

![Amazon Bedrock](assets/install-10-bedrock.png)

### 認証方法を選択

「How do you authenticate to AWS?」が表示されます。↑↓ キーで **4. Use credentials already in my environment** を選択して Enter を押します。

![認証方法](assets/install-11-credentials.png)

### リージョンを設定

「AWS region」が表示されます。デフォルトの **us-east-1** のまま Enter を押します。

![リージョン](assets/install-12-region.png)

### 認証を確認

「Verification」画面で認証が成功したことを確認します。**1. Continue** を選択して Enter を押します。

![Continue](assets/install-13-continue.png)

## 10. モデルバージョンを選択

「Pin model versions」画面が表示されます。**3. Choose different models...** を選択して Enter を押します。

![Pin model versions](assets/install-14-pin-versions.png)

### Sonnet モデルを選択

**global.anthropic.claude-sonnet-4-6** を選択して Enter を押します。

![Sonnet 選択](assets/install-15-sonnet.png)

### Opus モデルを選択

**global.anthropic.claude-opus-4-7** を選択して Enter を押します。

![Opus 選択](assets/install-16-opus.png)

### Haiku モデルを選択

**global.anthropic.claude-haiku-4-5-20251001-v1:0** を選択して Enter を押します。

![Haiku 選択](assets/install-17-haiku.png)

### 1M コンテキストで Pin

モデル選択が完了すると、Pin の確認画面が表示されます。**2. Pin the working models with 1M context** を選択して Enter を押します。

![Pin 1M](assets/install-18-pin-1m.png)

## 11. 設定を保存して再起動

設定内容の確認画面が表示されます。**1. Save** を選択して Enter を押します。

![Save](assets/install-19-save.png)

「Press Enter to restart Claude Code.」と表示されたら Enter を押します。

![Restart](assets/install-20-restart.png)

再起動後、「Quick safety check」が表示されます。**1. Yes, I trust this folder** を選択して Enter を押します。

![Trust folder](assets/install-21-trust-folder.png)

## 12. 設定完了！

Claude Code の画面が表示されたら初期設定は完了です。画面下部の入力欄にメッセージを入力して、Claude Code と対話を始めましょう。

![Claude Code 準備完了](assets/install-22-claude-ready.png)

---

## ファイルのアップロード

ローカル PC のファイルを code-server にアップロードするには、左側のサイドバーの **エクスプローラー** パネルに、ファイルを **ドラッグ＆ドロップ** します。

![ドラッグ＆ドロップ](assets/upload-01-drag-drop.png)

- 複数ファイルを同時にドラッグ＆ドロップすることもできます
- フォルダごとアップロードすることも可能です

## ファイルのダウンロード

code-server 上のファイルをローカル PC にダウンロードするには、エクスプローラーでファイルを **右クリック** し、**Download...** を選択します。

![右クリックからダウンロード](assets/download-01-right-click.png)

フォルダをダウンロードしたい場合は、ターミナルで圧縮してからダウンロードしてください。

```bash
tar czf project.tar.gz ./my-project
```
