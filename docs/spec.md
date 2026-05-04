# Specification

このドキュメントは、現時点の実装から読み取れる `myweight` の仕様をまとめる。

## アプリ概要

`myweight` は、HealthPlanet の Innerscan API から体重データを取得し、日付ごとの体重推移を折れ線グラフで表示する React アプリケーションである。

画面タイトルは `おじさんの体重の推移`。

## 実行環境

- フロントエンドは Vite + React + TypeScript で構成する。
- React 18 を使用する。
- グラフ描画には Recharts を使用する。
- HTTP 通信には axios を使用する。
- 日付処理には moment を使用する。
- Vite の `base` は `/myweight/`。
- Vite の esbuild 設定で top-level await を許可している。

## データ取得仕様

- データ取得元は HealthPlanet の Innerscan API。
- 実際のリクエスト先は CORS 回避のため `https://corsproxy.io/?https://www.healthplanet.jp/status/innerscan.json`。
- HTTP メソッドは POST。
- 送信パラメータは以下。
  - `access_token`
  - `date=1`
  - `tag=6021`
  - `from`
  - `to`
- `tag=6021` は体重データを表す。
- API の 1 回あたりの取得期間は最大 80 日として分割する。
- 取得開始日時は `20240327000000`。
- 取得終了日時は実行時点の現在日時。
- 各チャンクは前回の `to` の 1 秒後から次の `from` を開始する。

## データ形式

アプリ内の体重データは以下の形式で扱う。

```ts
type WeightData = {
  date: string;
  weight: number;
};
```

- API レスポンスの `record.date` は `YYYY/MM/DD` 形式に変換する。
- API レスポンスの `record.keydata` は `Number` で数値化して `weight` とする。
- API から返された `data` は `reverse()` してからチャート用配列に詰める。

## 画面仕様

- `App` コンポーネントはアプリ全体のコンテナと見出しを表示する。
- `WeightChart` コンポーネントは体重推移グラフを表示する。
- グラフは `ResponsiveContainer`、`LineChart`、`Line`、`XAxis`、`YAxis`、`Tooltip`、`Legend`、`Brush` を使用する。
- グラフサイズは `ResponsiveContainer width={900} height={500}`。
- X 軸は `date` を使用し、ラベルは -90 度回転する。
- Y 軸は `weight` を使用し、最小値は 70、最大値は自動。
- 折れ線は `type="monotone"`、`stroke="#8884d8"`、`strokeWidth={3}`。
- Brush は `date` をキーにし、`y={400}` に配置する。

## エラー処理

- API 取得に失敗した場合は console にエラーを出力する。
- axios エラーでレスポンスがあり、HTTP ステータスが 401 の場合は `Unauthorized: Invalid access token.` を投げる。
- axios エラーでレスポンスがない場合は `Network Error: Could not connect to the server.` を投げる。
- その他のエラーは再 throw する。

## 現時点の制約と注意点

- アクセストークンは `src/components/WeightData.tsx` にハードコードされている。
- `WeightData.tsx` はモジュール読み込み時に top-level await でデータ取得を開始する。
- データ取得はブラウザから CORS プロキシ経由で行う。
- `src/main.tsx` の先頭に `<script src="http://localhost:8097"></script>` が含まれている。TypeScript/TSX としては通常の import 文ではないため、ビルドや型チェック時の注意点である。
- README の Build 手順は `npm run export` と書かれているが、現時点の `package.json` に `export` スクリプトはない。実装上の build スクリプトは `npm run build`。
