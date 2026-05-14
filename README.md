# Shift Share

店長に提出する前に、メンバー同士で1週間分のシフト希望を確認するためのWebアプリです。

## 使い方

1. 最初に自分の名前を選びます。
2. 名前がない場合は追加します。追加した名前は自動で選択されます。
3. 日付（曜日）と開始・終了時刻を入力して、カレンダーに追加します。
4. 同じURLをメンバーに送ると、同じ共有ルームを開けます。

カレンダーには `18:00-22:00 佐藤` のように表示されます。

## ローカルで確認する

Firebase SDKをブラウザモジュールとして読み込むため、ローカルでは簡単なサーバー経由で開きます。

```powershell
python -m http.server 8000
```

その後、ブラウザで開きます。

```text
http://localhost:8000/?room=test
```

Firebase設定が空のままでも動きますが、その場合は自分のブラウザ内だけに保存されます。

## Firebaseで共有する

1. [Firebase Console](https://console.firebase.google.com/) でプロジェクトを作成します。
2. Webアプリを追加します。
3. 表示された `firebaseConfig` の値を `firebase-config.js` に貼り付けます。
4. Firestore Databaseを作成します。
5. テスト用に `firestore.rules` の内容をFirestore Rulesへ反映します。

注意: 現在の `firestore.rules` は「URLを知っている人が読み書きできる」テスト用設定です。ログインや厳密な権限制御を入れるまでは、公開範囲に注意してください。

## GitHub Pagesで公開する

1. GitHubで新しいリポジトリを作ります。
2. このフォルダをpushします。
3. GitHubのリポジトリ画面で `Settings` -> `Pages` を開きます。
4. `Build and deployment` のSourceを `Deploy from a branch` にします。
5. Branchを `main`、フォルダを `/root` にして保存します。

公開後のURL例:

```text
https://ユーザー名.github.io/shift_share/?room=sample
```

`room` の値が同じURLを開いた人同士で、同じシフト希望を共有します。

## できること

- 月曜日始まりの1週間表示
- 週の前後移動
- 自分の名前の選択
- メンバー追加
- 日付（曜日）と時間帯の登録
- 自分のシフトだけ削除
- 共有URLのコピー
- 共有用まとめテキストのコピー
- Firebase未設定時のローカル保存
