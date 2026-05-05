# Coding Rule

このドキュメントは、現時点の実装・設定から読み取れる Coding Rule をまとめる。

## 基本方針

- 既存の Vite + React + TypeScript 構成に合わせる。
- React コンポーネントは関数コンポーネントで実装する。
- TypeScript の `strict` 設定を前提にする。
- 既存の依存関係で解決できる処理は、まず既存ライブラリを使う。
- 測定データの取得・整形の責務は `WeightData.tsx`、表示の責務は `WeightChart.tsx` を中心に保つ。
- API に依存しない測定データの型・定義・整形処理は `src/lib/measurementData.ts` に分離し、テスト可能な形を保つ。

## TypeScript

- `tsconfig.json` の対象は `src`。
- `target` は `ES2020`。
- `module` は `ESNext`。
- `moduleResolution` は `bundler`。
- `jsx` は `react-jsx`。
- `strict`、`noUnusedLocals`、`noUnusedParameters`、`noFallthroughCasesInSwitch` を有効にしている。
- 不要な変数、引数、到達しない分岐を残さない。

## React

- エントリポイントは `src/main.tsx`。
- ルートコンポーネントは `src/App.tsx`。
- コンポーネントは `src/components/` 配下に配置する。
- React Hooks のルールに従う。
- Fast Refresh 対象のファイルでは、コンポーネント以外の export を増やす場合に ESLint 設定との整合性を確認する。

## Lint

現時点の lint コマンドは以下。

```bash
npm run lint
```

ESLint の主な設定は以下。

- `eslint:recommended`
- `plugin:@typescript-eslint/recommended`
- `plugin:react-hooks/recommended`
- `react-refresh/only-export-components`

`dist` と `.eslintrc.cjs` は lint 対象外。

## Test

現時点の test コマンドは以下。

```bash
npm test
```

- テストランナーは Vitest を使用する。
- 外部 API 通信に依存しない純粋関数を優先してテストする。
- HealthPlanet API レスポンスの整形ロジックは `src/lib/measurementData.ts` に置き、`src/lib/measurementData.test.ts` で検証する。
- GitHub Actions の CI では pull request と `master` branch への push 時に `npm test`、`npm run lint`、`npm run build` を実行する。

## Build

GitHub Pages 向けの export コマンドは以下。

```bash
npm run export
```

内部では `npm run build` を実行する。

通常の build コマンドは以下。

```bash
npm run build
```

内部では `tsc && vite build` を実行する。

## Styling

- グローバル CSS は `src/index.css`。
- アプリ単位の CSS は `src/App.css`。
- 現時点では Vite テンプレート由来のスタイルが多く残っている。

## API とデータ処理

- HealthPlanet API への通信は axios を使う。
- 日付処理は moment を使う。
- 体重タグは `6021`、体脂肪率タグは `6022` を使用する。
- API 取得期間は 80 日以下のチャンクに分割する。
- API の入力日時は `YYYYMMDDHHmmss` 形式で扱う。
- 画面表示用の日付は `YYYY/MM/DD` 形式で扱う。
- `public/measurement-data.json` を先に読み込み、保存済みの古いデータは API 取得対象から外す。
- `public/measurement-data.json` の `coverage.to` がある場合、API 取得開始日時は `coverage.to` の 1 秒後にする。
- 静的データと API 取得データをマージする場合は日付単位で重複排除し、同一日付は新しく取得したデータを優先する。
- 開発時・production build ともに `corsproxy.io` 経由で HealthPlanet API にアクセスする。
- `corsproxy.io` 経由の HealthPlanet API 取得では、ブラウザ request header と `corsproxy.io` の `reqHeaders` を明示する。
- `application/x-www-form-urlencoded;charset=UTF-8` の `Content-Type` は、ブラウザ request header と HealthPlanet origin fetch 側の `reqHeaders` の両方に指定する。
- ブラウザから直接指定できない `Accept-Encoding` は、`corsproxy.io` の `reqHeaders=accept-encoding:identity` で origin fetch 側に指定する。
- `corsproxy.io` 経由のレスポンスは `arraybuffer` として受け取り、JSON parse と必要な展開処理を明示的に行う。
- Brotli 展開の互換性は `brotli-dec-wasm` で担保する。

## Local Verification

- GitHub Pages と同じ条件を確認する場合は、`npm run export` で production build を作成する。
- build 後の `dist/` は `npm run preview:pages` で `/myweight/` 配下として localhost で配信して確認する。
- 確認 URL は `http://localhost:4173/myweight/` のように `localhost` hostname を使う。
- `file://` で `dist/index.html` を直接開く方法は、corsproxy.io Free plan の localhost/github.io 判定と異なるため、正常系確認には使わない。
- 静的データがない場合、localhost の実 API 確認では取得開始日時を実行時点の現在日時から 45 日前とし、リクエスト数を抑える。
- 静的データがない場合、GitHub Pages では取得開始日時を `20240327000000` とする。
- repo に保持する測定データを更新する場合は `npm run export:data` を実行し、`public/measurement-data.json` の差分を確認する。

## セキュリティと設定値

- 新規実装ではアクセストークンなどの秘密情報をコードへ直接追加しない。
- 現時点では `src/components/WeightData.tsx` と `scripts/export-healthplanet-data.mjs` に既存アクセストークンがハードコードされているため、変更時は環境変数やバックエンド経由の取得への移行を検討する。
- CORS プロキシへの依存は外部サービスの可用性に影響されるため、仕様変更時は代替手段を検討する。

## ドキュメント更新

- 仕様が変わった場合は `docs/spec.md` を更新する。
- Coding Rule が変わった場合は `docs/rule.md` を更新する。
- 機能が増減した場合は `docs/feature.md` を更新する。
- 構成が変わった場合は `docs/repo.md` を更新する。
- `AGENTS.md` は詳細を重複させず、該当する docs を参照する。
