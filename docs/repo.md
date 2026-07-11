# Repository

このドキュメントは、現時点のレポジトリ構成をまとめる。

## 概要

`myweight` は Vite + React + TypeScript のシングルページアプリケーションである。

## 主要ファイル

```text
.
├── .eslintrc.cjs
├── AGENTS.md
├── README.md
├── .github/
│   └── workflows/
│       ├── ci.yml
│       ├── deploy.yml
│       └── update-data.yml
├── .gitignore
├── docs/
│   ├── feature.md
│   ├── repo.md
│   ├── rule.md
│   └── spec.md
├── index.html
├── package-lock.json
├── package.json
├── public/
│   ├── measurement-data.json
│   └── vite.svg
├── scripts/
│   ├── export-healthplanet-data.mjs
│   └── serve-pages.mjs
├── src/
│   ├── App.css
│   ├── App.tsx
│   ├── assets/
│   ├── components/
│   │   ├── WeightChart.tsx
│   │   └── WeightData.tsx
│   ├── lib/
│   │   ├── measurementData.test.ts
│   │   ├── measurementData.ts
│   │   ├── medicationPeriods.test.ts
│   │   ├── medicationPeriods.ts
│   │   ├── weightDataUtils.test.ts
│   │   └── weightDataUtils.ts
│   ├── index.css
│   ├── main.tsx
│   └── vite-env.d.ts
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

## ディレクトリ

### `docs/`

現時点の仕様、Coding Rule、機能、レポジトリ構成を管理する。

### `.github/workflows/`

GitHub Actions の workflow を配置する。

- `ci.yml`: pull request と `master` branch への push で `npm test`、`npm run lint`、`npm run build` を実行する。
- `deploy.yml`: `master` branch への push、手動実行で `npm run export` を実行し、GitHub Pages にデプロイする。
- `update-data.yml`: 週次スケジュール（毎週日曜 11:00 JST = 日曜 02:00 UTC）と手動実行で `npm run export:data` を実行し、差分がある場合のみ `public/measurement-data.json` を commit して `master` に push する。

### `src/`

アプリケーション本体を配置する。

### `src/components/`

画面部品とデータ取得モジュールを配置する。

- `WeightChart.tsx`: 測定項目の選択 UI と推移グラフを表示する。
- `WeightData.tsx`: 静的測定データと HealthPlanet API の差分データを取得・マージし、チャート用に整形する。

### `src/lib/`

API 通信に依存しない型、定義、純粋なデータ整形処理を配置する。

- `measurementData.ts`: 測定データ型、測定種別定義、HealthPlanet レスポンスレコードのチャート用変換処理を定義する。
- `measurementData.test.ts`: `measurementData.ts` の Vitest テスト。
- `weightDataUtils.ts`: データ正規化、マージ、API 日付書式変換、CORS プロキシ URL 構築、ヘッダー処理など、`WeightData.tsx` から分離した純粋関数群。
- `weightDataUtils.test.ts`: `weightDataUtils.ts` の Vitest テスト。
- `medicationPeriods.ts`: リベルサス服用期間の定義と、測定データに対する表示対象期間の算出処理。
- `medicationPeriods.test.ts`: `medicationPeriods.ts` の Vitest テスト。

### `public/`

Vite の静的アセットを配置する。

- `measurement-data.json`: repo に保持する静的測定データ。画面ロード時に読み込み、保存済みの古いデータは API を呼ばずに参照する。
- `vite.svg`: Vite テンプレート由来の静的アセット。

### `scripts/`

開発・検証用の補助スクリプトを配置する。

- `export-healthplanet-data.mjs`: 既存の `public/measurement-data.json` を読み込み、HealthPlanet API から差分データを取得して日付単位で追記マージする補助スクリプト。
- `serve-pages.mjs`: `dist/` を GitHub Pages と同じ `/myweight/` 配下として localhost で配信する。

### `dist/`

build 出力先。生成物であり、通常は手編集しない。

### `node_modules/`

npm 依存関係のインストール先。手編集しない。

## 設定ファイル

### `package.json`

プロジェクト名、依存関係、npm scripts を定義する。

主な scripts:

- `dev`: Vite 開発サーバーを起動する。
- `build`: `tsc && vite build` を実行する。
- `export:data`: `scripts/export-healthplanet-data.mjs` を実行し、`public/measurement-data.json` を更新する。
- `export`: production build を実行する。
- `lint`: ESLint を実行する。
- `test`: Vitest の自動テストを実行する。
- `preview`: Vite preview を起動する。
- `preview:pages`: `scripts/serve-pages.mjs` で GitHub Pages 相当の localhost 確認サーバーを起動する。

### `vite.config.ts`

Vite 設定を定義する。

- React SWC plugin を使用する。
- `base` は `./`。
- esbuild で top-level await を許可する。

### `tsconfig.json`

`src` 用の TypeScript 設定を定義する。

### `tsconfig.node.json`

`vite.config.ts` 用の TypeScript 設定を定義する。

### `.eslintrc.cjs`

ESLint 設定を定義する。

## エントリポイント

- HTML エントリポイント: `index.html`
- React エントリポイント: `src/main.tsx`
- アプリルート: `src/App.tsx`

## 依存関係

主な runtime dependencies:

- `react`
- `react-dom`
- `axios`
- `brotli-dec-wasm`
- `moment`
- `recharts`

`brotli-dec-wasm` は、`corsproxy.io` 経由で `Content-Encoding` が欠落した Brotli 圧縮 body が返った場合に、ブラウザ上で HealthPlanet レスポンスを展開するために使用する。

主な dev dependencies:

- `vite`
- `typescript`
- `eslint`
- `vitest`
- `@vitejs/plugin-react-swc`
- `@typescript-eslint/*`
- `eslint-plugin-react-hooks`
- `eslint-plugin-react-refresh`
