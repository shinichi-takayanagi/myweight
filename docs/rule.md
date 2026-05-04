# Coding Rule

このドキュメントは、現時点の実装・設定から読み取れる Coding Rule をまとめる。

## 基本方針

- 既存の Vite + React + TypeScript 構成に合わせる。
- React コンポーネントは関数コンポーネントで実装する。
- TypeScript の `strict` 設定を前提にする。
- 既存の依存関係で解決できる処理は、まず既存ライブラリを使う。
- 体重データの取得・整形の責務は `WeightData.tsx`、表示の責務は `WeightChart.tsx` を中心に保つ。

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

## Build

現時点の build コマンドは以下。

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
- 体重タグは `6021` を使用する。
- API 取得期間は 80 日以下のチャンクに分割する。
- API の入力日時は `YYYYMMDDHHmmss` 形式で扱う。
- 画面表示用の日付は `YYYY/MM/DD` 形式で扱う。

## セキュリティと設定値

- 新規実装ではアクセストークンなどの秘密情報をコードへ直接追加しない。
- 現時点では既存実装にアクセストークンがハードコードされているため、変更時は環境変数やバックエンド経由の取得への移行を検討する。
- CORS プロキシへの依存は外部サービスの可用性に影響されるため、仕様変更時は代替手段を検討する。

## ドキュメント更新

- 仕様が変わった場合は `docs/spec.md` を更新する。
- Coding Rule が変わった場合は `docs/rule.md` を更新する。
- 機能が増減した場合は `docs/feature.md` を更新する。
- 構成が変わった場合は `docs/repo.md` を更新する。
- `AGENTS.md` は詳細を重複させず、該当する docs を参照する。
