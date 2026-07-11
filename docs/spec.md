# Specification

このドキュメントは、現時点の実装から読み取れる `myweight` の仕様をまとめる。

## アプリ概要

`myweight` は、HealthPlanet の Innerscan API から体重・体脂肪率データを取得し、日付ごとの推移を折れ線グラフで表示する React アプリケーションである。

画面タイトルは `おじさんのからだログ`。

## 実行環境

- フロントエンドは Vite + React + TypeScript で構成する。
- React 18 を使用する。
- グラフ描画には Recharts を使用する。
- HTTP 通信には axios を使用する。
- 日付処理には moment を使用する。
- Vite の `base` は `./`。GitHub Pages の `/myweight/` 配下でも、HTML から相対パスで JS/CSS を読み込む。
- Vite の esbuild 設定で top-level await を許可している。

## データ取得仕様

- データ取得元は HealthPlanet の Innerscan API。
- 開発時・production build ともに、CORS 回避のため `corsproxy.io` 経由で HealthPlanet にリクエストする。
- リクエスト先は `https://corsproxy.io/?url=...` を基本とし、`reqHeaders` で HealthPlanet origin fetch 側の request header を明示する。
- `corsproxy.io` を使うことで、GitHub Pages 公開後も画面ロード時に最新データを取得する。
- `corsproxy.io` の設定で GitHub Pages の公開ドメインを Allowed Domains に登録する必要がある。
- 画面ロード時に `public/measurement-data.json` を静的な測定データとして読み込み、repo に保存済みの古いデータは API 取得対象から外す。
- 静的データの最新日付より後の期間だけ HealthPlanet API からライブ取得する。
- 静的データに `coverage.to` がある場合は、その日時の 1 秒後から HealthPlanet API で差分取得する。
- 静的データが存在しない、または有効な測定データがない場合は、実行環境ごとの既定開始日時から HealthPlanet API で取得する。
- 静的データと API 取得データは日付単位でマージし、同一日付は API 取得データで上書きする。
- HTTP メソッドは POST。
- production build でも HealthPlanet 向けパラメータは URL query ではなく `application/x-www-form-urlencoded` の POST body で送信する。
- ブラウザから `corsproxy.io` へ送る request header は以下。
  - `Accept: application/json`
  - `Content-Type: application/x-www-form-urlencoded;charset=UTF-8`
- `corsproxy.io` から HealthPlanet へ送る request header は `reqHeaders` query parameter で以下を指定する。
  - `accept:application/json`
  - `content-type:application/x-www-form-urlencoded;charset=UTF-8`
  - `accept-encoding:identity`
- ブラウザ JavaScript から `Accept-Encoding` header は直接指定できないため、origin fetch 側の圧縮制御は `corsproxy.io` の `reqHeaders` で指定する。
- HealthPlanet origin fetch 側でも POST body を form-urlencoded として扱わせるため、`Content-Type` はブラウザ request header と `reqHeaders` の両方で明示する。
- 送信パラメータは以下。
  - `access_token`
  - `date=1`
  - `tag`
  - `from`
  - `to`
- `tag=6021` は体重データを表す。
- `tag=6022` は体脂肪率データを表す。
- 画面ロード時に体重と体脂肪率を一括取得する。
- 開発時のみ、`?fixture=success` を付けると正常系表示確認用の fixture データを使用する。
- API の 1 回あたりの取得期間は最大 80 日として分割する。
- 静的データがない場合の取得開始日時は実行環境により切り替える。
  - `localhost`、`127.0.0.1`、`::1`: 実行時点の現在日時から 45 日前
  - GitHub Pages など localhost 以外: `20240327000000`
- 静的データがあり `coverage.to` がない場合は、体重・体脂肪率それぞれの最新日付のうち古い方の翌日 00:00:00 から取得する。
- 静的データが実行時点の現在日付まで揃っている場合は、HealthPlanet API を呼ばずに静的データだけを表示する。
- 取得終了日時は実行時点の現在日時。
- 各チャンクは前回の `to` の 1 秒後から次の `from` を開始する。

## レスポンスデコード仕様

- HealthPlanet のレスポンス本文は JSON として扱う。
- `corsproxy.io` 経由では `Content-Encoding` が欠落した Brotli 圧縮済み body が返ることがある。
- axios は `responseType: 'arraybuffer'` で受け取り、以下の順に JSON parse を試みる。
  - identity
  - gzip
  - deflate
  - deflate-raw
  - Brotli via `brotli-dec-wasm`
- Brotli 展開に成功した場合、ログ上の `decodedFormat` は `br-wasm` となる。
- Brotli decoder は `corsproxy.io` 側の header 挙動が変動した場合の保険として維持する。

## データ形式

アプリ内の測定データは以下の形式で扱う。

```ts
type MeasurementData = {
  date: string;
  value: number;
};
```

- API レスポンスの `record.date` は `YYYY/MM/DD` 形式に変換する。
- API レスポンスの `record.keydata` は `Number` で数値化して `value` とする。
- API から返された `data` は `reverse()` してからチャート用配列に詰める。
- 測定データは `weight` と `bodyFat` のキーで保持する。
- API に依存しない測定データの型、測定種別定義、レスポンスレコード変換処理は `src/lib/measurementData.ts` に置く。
- `public/measurement-data.json` は以下の形式で保持する。

```json
{
  "generatedAt": "2026-05-04T14:22:20.235Z",
  "coverage": {
    "from": "20240327000000",
    "to": "20260506063000"
  },
  "data": {
    "weight": [{ "date": "2026/04/02", "value": 81.6 }],
    "bodyFat": [{ "date": "2026/04/02", "value": 24.3 }]
  }
}
```

## 自動テスト仕様

- 自動テストは Vitest で実行する。
- `npm test` は `vitest run` を実行する。
- テストは外部 API 通信に依存しない純粋関数を対象にする。
- 現時点では `src/lib/measurementData.test.ts` で測定種別定義、空データセット作成、日付整形、HealthPlanet レスポンスレコードのチャート用変換を検証する。
- GitHub Actions の CI は pull request と `master` branch への push で `npm test`、`npm run lint`、`npm run build` を実行する。

## データ自動更新仕様

- GitHub Actions の `update-data.yml` で `public/measurement-data.json` を週次で自動更新する。
- トリガーは `schedule`（cron `0 2 * * 0`、毎週日曜 11:00 JST = 日曜 02:00 UTC）と `workflow_dispatch`（手動実行）の両方。
- ワークフローには `contents: write` 権限を付与し、commit/push を許可する。
- ジョブは `actions/checkout@v4`、`actions/setup-node@v4`（node-version 20、`cache: 'npm'`）、`npm ci`、`npm run export:data` の順で実行する。
- `npm run export:data` には環境変数 `HEALTHPLANET_ACCESS_TOKEN`（既存 secret を参照）を渡す。ローカル・CI ともに同スクリプトは HealthPlanet Innerscan API へ直接 POST する。
- `git diff --quiet public/measurement-data.json` で差分を判定し、差分がない場合は commit をスキップして空 commit を防ぐ。
- 差分がある場合のみ `github-actions[bot]` として commit し、`master` に push する。
- `master` への push により既存の `deploy.yml` が発火し、GitHub Pages が自動で再デプロイされる。

## 画面仕様

- `App` コンポーネントはアプリ全体のコンテナと見出しを表示する。
- `WeightChart` コンポーネントは測定項目の選択 UI と推移グラフを表示する。
- ComboBox で `体重` と `体脂肪率` を選択できる。
- 選択された項目に応じて、グラフのデータ、凡例、単位、線色、Y 軸設定を切り替える。
- 最新値、取得件数、最新日付をサマリー表示する。
- 縦軸レンジ（最小値・最大値）を数値入力で指定できる。空欄はデフォルト（体重は下限 70、他は auto）にフォールバックし、最小値 >= 最大値の場合もデフォルトに戻す。表示データ切り替え時は入力をリセットする。
- グラフは `ResponsiveContainer`、`LineChart`、`Line`、`ReferenceArea`、`XAxis`、`YAxis`、`Tooltip`、`Legend`、`Brush` を使用する。
- グラフサイズは親要素に追従する。
- グラフ背景には、服用期間を色付きの背景帯とラベルで表示する。期間に `medications` がある場合は複数行（「薬剤名（用量）」×N）で表示し、ない場合は `リベルサス` / `Xmg` の 2 行で表示する。
- 服用期間は以下を表示対象にする。
  - 2024/03/24 から 2024/04/15: `リベルサス` / `3mg`
  - 2024/04/16 から 2024/09/19: `リベルサス` / `7mg`
  - 2024/09/20 から 2025/05/10: `リベルサス` / `14mg`
  - 2026/05/16 以降: `リベルサス（14mg）` / `ダパグリフロジン（5mg）`
- リベルサス服用期間の背景帯は、選択中の測定データに含まれる日付範囲に合わせて描画する。
- X 軸は `date` を使用し、ラベルは -90 度回転する。
- Y 軸は `value` を使用する。
- 体重の Y 軸最小値は 70、最大値は自動。
- 体脂肪率の Y 軸は最小値・最大値とも自動。
- 折れ線は `type="monotone"`、`strokeWidth={3}`、点は通常非表示。
- Brush は `date` をキーにする。

## エラー処理

- API 取得に失敗した場合は console にエラーを出力する。
- request URL、request header、corsproxy.io の `reqHeaders`、response header、decode 試行結果を console に出力する。
- axios エラーでレスポンスがあり、HTTP ステータスが 401 または本文に `Error 401` が含まれる場合は HealthPlanet 認証エラーとして扱う。
- axios エラーでレスポンスがない場合は `Network Error: Could not connect to the server.` を投げる。
- 取得に失敗した測定項目は空データとして扱い、画面には空状態を表示する。
- 静的データの読み込みに失敗した場合は warning を出力し、実行環境ごとの既定開始日時から API 取得を試みる。
- 静的データ読み込み後に API 取得へ失敗した場合は、取得済みの静的データを表示し、console にエラーを出力する。

## 現時点の制約と注意点

- アクセストークンは `src/components/WeightData.tsx` と補助スクリプト `scripts/export-healthplanet-data.mjs` にハードコードされている。
- `WeightData.tsx` はモジュール読み込み時に top-level await でデータ取得を開始する。
- `WeightData.tsx` の import は HealthPlanet API 取得を起動するため、テストでは API 通信に依存しない `src/lib/measurementData.ts` を直接対象にする。
- 実 API 取得は開発時・production build ともに `corsproxy.io` 経由で行う。
- `scripts/export-healthplanet-data.mjs` は既存の `public/measurement-data.json` を読み込み、新規取得分を日付単位でマージして保存する。
- GitHub Pages と同じ静的 HTML 条件を localhost で確認する場合は、`npm run export` 後に `npm run preview:pages` で `dist/` を `/myweight/` 配下として配信し、`http://localhost:4173/myweight/` のような URL で開く。
- `file://` で `dist/index.html` を直接開く方法は、corsproxy.io の localhost/github.io 判定と異なるため、GitHub Pages 相当の正常系確認には使わない。
- `src/main.tsx` の先頭に `<script src="http://localhost:8097"></script>` が含まれている。TypeScript/TSX としては通常の import 文ではないため、ビルドや型チェック時の注意点である。
