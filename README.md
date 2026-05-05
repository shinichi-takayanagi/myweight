# myweight

[![CI](https://github.com/shinichi-takayanagi/myweight/actions/workflows/ci.yml/badge.svg)](https://github.com/shinichi-takayanagi/myweight/actions/workflows/ci.yml)

私の体重の推移

## Dev

### Local GitHub Pages-like Check

GitHub Pages と同じ静的 HTML として確認する場合は、production build を作って `dist/` を `/myweight/` 配下で配信する。

```bash
npm run export
npm run preview:pages
```

ブラウザで以下を開く。

```text
http://localhost:4173/myweight/
```

画面ロード時は `public/measurement-data.json` を先に読み込み、保存済みの古いデータは API を呼ばずに参照する。静的データより後の期間だけ HealthPlanet API から取得する。

静的データがない場合、localhost では HealthPlanet API の取得開始日時を実行時点の現在日時から 45 日前にして、API リクエスト数を抑える。GitHub Pages では `20240327000000` から取得する。

`file://` で `dist/index.html` を直接開く確認は、corsproxy.io Free plan の localhost/github.io 判定と異なるため、GitHub Pages 相当の確認には使わない。

### Export for GitHub Pages
```bash
npm run export
```

`npm run export` runs the Vite production build for GitHub Pages. The deployed app fetches the latest HealthPlanet data in the browser through `corsproxy.io`.

### Update Static Measurement Data
```bash
npm run export:data
```

`npm run export:data` fetches only the missing newer HealthPlanet data and merges it into `public/measurement-data.json`.

GitHub Pages の公開 URL:

```text
https://shinichi-takayanagi.github.io/myweight/
```

### Build Only
```bash
npm run build
```

### Test
```bash
npm test
```

### Local Run
```bash
npm run dev   
```

`npm run dev` は Vite の開発サーバー確認用。GitHub Pages と同じ条件の確認には、上記の Local GitHub Pages-like Check を使う。
