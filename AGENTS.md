# AGENTS.md

このファイルは、このレポジトリで作業するエージェント向けの入口である。詳細な仕様やルールは `docs/` 配下を参照する。

## Project

`myweight` は HealthPlanet の体重・体脂肪率データを取得し、React + Recharts で推移を表示する Vite アプリケーションである。

詳細な現行仕様は [docs/spec.md](docs/spec.md) を参照する。

## Current Features

現時点の実装済み機能、未実装機能、開発用コマンドは [docs/feature.md](docs/feature.md) を参照する。

## Coding Rules

実装時は [docs/rule.md](docs/rule.md) の Coding Rule に従う。

特に以下を守る。

- 作業開始時は `AGENTS.md` を必ず読み、必要に応じて `docs/` 以下のドキュメントを参照する。
- 既存の Vite + React + TypeScript 構成に合わせる。
- 測定データ取得とチャート表示の責務分離を維持する。
- `npm run export`、`npm run build`、`npm run lint` の意味を変える場合は、関連ドキュメントも更新する。
- 単体テストを通してから完了の報告をする。
- 作業依頼されたときは PR を作成し、CI が通るまで確認してから完了の報告をする。
- 新規の秘密情報をコードへ直接追加しない。

## Repository Structure

現時点のレポジトリ構成は [docs/repo.md](docs/repo.md) を参照する。

## Documentation Policy

仕様、機能、ルール、構成を変更した場合は、実装と同じ変更単位で `docs/` の該当ファイルを更新する。

- 仕様変更: [docs/spec.md](docs/spec.md)
- Coding Rule 変更: [docs/rule.md](docs/rule.md)
- 機能変更: [docs/feature.md](docs/feature.md)
- 構成変更: [docs/repo.md](docs/repo.md)

`AGENTS.md` には詳細を重複して書かず、原則として `docs/` の該当ファイルを参照する。

## Known Notes

- 現時点では `src/components/WeightData.tsx` と `scripts/export-healthplanet-data.mjs` にアクセストークンがハードコードされている。変更時は [docs/rule.md](docs/rule.md) のセキュリティ方針を確認する。
- GitHub Pages 向けには `npm run export` で production build する。公開後のデータ取得はブラウザから `corsproxy.io` 経由で行う。
- localhost で GitHub Pages 相当の確認をする場合は [README.md](README.md) と [docs/rule.md](docs/rule.md) の Local Verification を参照する。
