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
- 最新値、取得件数、最新日付をサマリー表示する。

## HealthPlanet データ取得

- HealthPlanet Innerscan API から体重・体脂肪率データを取得する。
- 体重データのタグとして `6021` を指定する。
- 体脂肪率データのタグとして `6022` を指定する。
- 画面ロード時に両データを一括取得する。
- GitHub Pages 公開後も、画面ロード時に `corsproxy.io` 経由で最新データを取得する。
- localhost では実行時点の現在日時から 45 日前から現在日時までのデータを取得する。
- GitHub Pages では 2024 年 3 月 27 日 00:00:00 から現在日時までのデータを取得する。
- API 仕様上の制約に合わせ、80 日ごとにリクエストを分割する。
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

## 開発用コマンド

- `npm run dev` で Vite の開発サーバーを起動する。
- `npm run build` で TypeScript チェックと Vite build を実行する。
- `npm run export` で GitHub Pages 用の production build を実行する。
- `npm run lint` で ESLint を実行する。
- `npm run preview` で build 結果をプレビューする。
- `npm run preview:pages` で build 結果を GitHub Pages と同じ `/myweight/` 配下として localhost で配信する。

## 未実装・現時点で存在しない機能

- アクセストークンの入力 UI はない。
- 体重データの手動登録・編集・削除機能はない。
- 期間指定 UI はない。
- HealthPlanet 認可フローは実装されていない。
- バックエンド API はない。
- 永続化用の独自データベースはない。
- 自動テストは現時点で用意されていない。
