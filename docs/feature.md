# Feature

このドキュメントは、現時点で実装されている機能をまとめる。

## 測定データ推移グラフ

- HealthPlanet から取得した体重・体脂肪率データを折れ線グラフで表示する。
- ComboBox で `体重` と `体脂肪率` を選択できる。
- X 軸に日付、Y 軸に選択中の測定値を表示する。
- 体重表示時の Y 軸下限は 70。
- 体脂肪率表示時の Y 軸範囲は自動。
- グラフには凡例を表示する。
- マウス操作時に Tooltip で値を確認できる。
- Brush により、表示範囲を操作できる。
- 服用期間を、グラフ背景の色付き帯とラベルで表示する。期間に複数薬剤がある場合は「薬剤名（用量）」を複数行で表示し、単剤の場合は `リベルサス` / `Xmg` の 2 行で表示する。
- 最新値、取得件数、最新日付をサマリー表示する。

## HealthPlanet データ取得

- HealthPlanet Innerscan API から体重・体脂肪率データを取得する。
- 体重データのタグとして `6021` を指定する。
- 体脂肪率データのタグとして `6022` を指定する。
- 画面ロード時に `public/measurement-data.json` の静的データを先に読み込む。
- repo に保存済みの古い測定データは API を呼ばずに静的データを参照する。
- 静的データの最新日付より後の期間だけ、`corsproxy.io` 経由で HealthPlanet API から最新データを取得する。
- `public/measurement-data.json` の `coverage.to` がある場合は、その日時の 1 秒後から API 取得する。
- 静的データがない場合、localhost では実行時点の現在日時から 45 日前から現在日時までのデータを取得する。
- 静的データがない場合、GitHub Pages では 2024 年 3 月 27 日 00:00:00 から現在日時までのデータを取得する。
- API 仕様上の制約に合わせ、80 日ごとにリクエストを分割する。
- 静的データと API 取得データは日付単位でマージする。
- 各レスポンスの `date` と `keydata` をチャート用データに変換する。
- `corsproxy.io` への request header と `reqHeaders` を明示し、HealthPlanet から JSON を取得する意図を固定する。
- HealthPlanet origin fetch 側の `reqHeaders` でも `content-type:application/x-www-form-urlencoded;charset=UTF-8` を明示し、POST body の解釈を固定する。
- `corsproxy.io` 経由で Brotli 圧縮 body が返った場合は `brotli-dec-wasm` で展開する。

## 日付整形

- API の `YYYYMMDD...` 形式の日付文字列から年月日を取り出す。
- 画面表示用に `YYYY/MM/DD` へ変換する。

## エラー出力

- API 取得エラーを console に出力する。
- API request、response header、raw response preview、decode 試行結果を console に出力する。
- 401 エラーはアクセストークン不正として扱う。
- レスポンスがない axios エラーはネットワークエラーとして扱う。
- 静的データ読み込み後に API 取得へ失敗した場合は、静的データを表示する。

## 開発用コマンド

- `npm run dev` で Vite の開発サーバーを起動する。
- `npm run build` で TypeScript チェックと Vite build を実行する。
- `npm run export:data` で HealthPlanet API から差分データを取得し、`public/measurement-data.json` に追記マージする。
- `npm run export` で GitHub Pages 用の production build を実行する。
- `npm run lint` で ESLint を実行する。
- `npm test` で Vitest による自動テストを実行する。
- `npm run preview` で build 結果をプレビューする。
- `npm run preview:pages` で build 結果を GitHub Pages と同じ `/myweight/` 配下として localhost で配信する。

## 自動テスト

- Vitest で自動テストを実行する。
- `src/lib/measurementData.test.ts`: 測定種別タグ、空データセット、日付整形、HealthPlanet レスポンスレコードのチャート用変換を検証する。
- `src/lib/weightDataUtils.test.ts`: API 日付書式変換、トークンマスク、測定データ正規化・マージ、CORS プロキシ URL 構築、ヘッダー処理、レスポンスプレビュー整形を検証する。
- `src/lib/medicationPeriods.test.ts`: リベルサス服用期間定義と、測定データからの表示対象期間算出を検証する。
- GitHub Actions の CI で pull request と `master` branch への push 時に `npm test`、`npm run lint`、`npm run build` を実行する。

## 週次データ自動更新

- GitHub Actions のスケジュール実行（毎週日曜 11:00 JST = 日曜 02:00 UTC）で HealthPlanet API からデータを取得し、`public/measurement-data.json` を更新する。
- `workflow_dispatch` による手動実行にも対応する。
- 差分がある場合のみ commit して `master` に push する。差分がない場合は空 commit を作らない。
- `master` への push により既存の `deploy.yml` が発火し、GitHub Pages が自動で再デプロイされる。

## 未実装・現時点で存在しない機能
- 古いデータをREPOにためておき、APIを呼ばずにそれを参照する機能はない。
