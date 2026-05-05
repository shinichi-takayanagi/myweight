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
│       └── deploy.yml
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

- `deploy.yml`: push、手動実行、定期実行で `npm run export` を実行し、GitHub Pages にデプロイする。

### `src/`

アプリケーション本体を配置する。

### `src/components/`

画面部品とデータ取得モジュールを配置する。

- `WeightChart.tsx`: 測定項目の選択 UI と推移グラフを表示する。
- `WeightData.tsx`: HealthPlanet API から体重・体脂肪率データを取得し、チャート用に整形する。

### `public/`

Vite の静的アセットを配置する。

- `measurement-data.json`: 過去の補助 export スクリプトで生成される静的データ。現行アプリは HealthPlanet API からライブ取得し、このファイルへフォールバックしない。
- `vite.svg`: Vite テンプレート由来の静的アセット。

### `scripts/`

開発・検証用の補助スクリプトを配置する。

- `export-healthplanet-data.mjs`: HealthPlanet API から測定データを取得し、`public/measurement-data.json` を生成する補助スクリプト。現行の `npm run export` からは呼び出されない。
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
- `export`: production build を実行する。
- `lint`: ESLint を実行する。
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
- `cors`

`brotli-dec-wasm` は、`corsproxy.io` 経由で `Content-Encoding` が欠落した Brotli 圧縮 body が返った場合に、ブラウザ上で HealthPlanet レスポンスを展開するために使用する。

主な dev dependencies:

- `vite`
- `typescript`
- `eslint`
- `@vitejs/plugin-react-swc`
- `@typescript-eslint/*`
- `eslint-plugin-react-hooks`
- `eslint-plugin-react-refresh`
