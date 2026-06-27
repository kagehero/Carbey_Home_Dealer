# カーベイホームディーラー（CARBAY Home Dealer）

**カーベイホームディーラー 加盟店プラットフォーム** — 本部と加盟店をつなぐ運用基盤。
加盟店管理・CRM・権限管理・ダッシュボードを備え、将来的に AI 市場分析／AI 壁打ちを統合する。

既存 [Carbey](../Carbey)（中古車市場分析ツール）と同じ Supabase プロジェクトに相乗りし、
専用スキーマ `portal` でデータを分離する独立アプリケーション。

> 設計判断・フェーズ構成・AI 移植マップは [docs/architecture.md](docs/architecture.md) を参照（要求事項定義書 v1.2 準拠）。

## 技術スタック

| 領域 | 採用技術 |
| --- | --- |
| フレームワーク | Next.js 15（App Router）/ React 19 / TypeScript |
| スタイリング | Tailwind CSS |
| 認証・DB | Supabase（Auth + PostgreSQL、`@supabase/ssr`） |
| メール送信 | nodemailer（自前 SMTP・招待／パスワードリセット） |

## セットアップ

```bash
npm install
cp .env.example .env.local   # 値を埋める（下表参照）
npm run dev                  # http://localhost:3000
```

DB の初期化（マイグレーション適用・管理者登録・スキーマ公開）は
[supabase/migrations/README.md](supabase/migrations/README.md) を参照。

### 環境変数

| 変数 | 用途 | 必須 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクト URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 公開（anon）キー | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | サーバー専用キー（RLS をバイパス） | ✅ |
| `NEXT_PUBLIC_SITE_URL` | メールリンクの遷移先 | ✅ |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` / `SMTP_SECURE` | 招待・パスワードリセットメール | 任意（未設定時はメール送信を無効化） |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GOOGLE_GENAI_API_KEY` | AI 機能（将来フェーズ） | 任意 |

## 主な機能

### 認証・権限

- メール＋パスワードによるログイン、パスワードリセット（自前 SMTP）
- 4 ロールによるアクセス制御（権限マトリクスは `lib/auth/permissions.ts` に集約）

| ロール | 概要 |
| --- | --- |
| `admin` | 管理者（本部）— 全機能 |
| `crm_staff` | CRM 入力担当 |
| `chat_only` | チャット専用 |
| `member` | 加盟店 — 自分のデータのみ |

### 本部（`/admin`）

- **ダッシュボード** — 加盟店・契約・売上・粗利益などの集計
- **加盟店管理** — 一覧／登録／詳細編集（基本情報・陸送先・契約・財務・入金履歴・内部メモ）、招待メール送信
- **CRM** — 購入者顧客の管理（顧客・購入履歴・商談・対応履歴）
- **プラン管理** — プラン（`home_dealer` / `economy` / `bronze` / `platinum` / `gold`）の編集
- **権限管理** — 本部スタッフのロール割り当て・招待・利用状態の切り替え
- **通知** — 本部向けお知らせ一覧（既読管理）

### 加盟店（`/portal`）

- **ダッシュボード** — 契約状況・進捗・利益サマリ
- **プロフィール** — 連絡先・陸送先は本人が編集可能（契約・料金項目は本部管理）

## ディレクトリ構成

```
app/
  admin/          本部向け画面（ダッシュボード・会員・CRM・プラン・権限・通知）
  portal/         加盟店向け画面（ダッシュボード・プロフィール）
  api/            API ルート（登録・認証）
  login/ register/ forgot-password/ set-password/   認証フロー
components/       UI コンポーネント（ui/・shell/・charts/・auth/）
lib/
  auth/           セッション・権限マトリクス
  portal/         業務ロジック（members・staff・plans・crm・invite ほか）
  supabase/       Supabase クライアント（ブラウザ／サーバー／サービスロール）
  email/          SMTP 送信・メールテンプレート
  ai/             AI 機能（将来フェーズで統合）
supabase/migrations/   DB スキーマ（portal）
docs/architecture.md   設計指針・フェーズ構成
```

## スクリプト

```bash
npm run dev     # 開発サーバー
npm run build   # 本番ビルド
npm run start   # 本番起動
npm run lint    # ESLint
npm run test    # Vitest

# 本部管理者を作成（DB 初期化時。詳細は migrations/README.md）
node --env-file=.env scripts/create-admin.mjs '<email>' '<password>' '<氏名>'
```

## フェーズ構成

| フェーズ | 内容 | 状態 |
| --- | --- | --- |
| Phase 1 | 認証・権限管理・加盟店管理・CRM 基本・DB 設計 | 実装済み |
| Phase 2 | ダッシュボード拡充・オンボーディング・オーダー・チャット | 予定 |
| Phase 3 | 車両進捗・販売実績・月次レポート | 予定 |
| Phase 4 | AI 市場分析・AI 壁打ち（意思決定支援） | 予定 |

AI 機能（Phase 4）は `lib/ai/` に集約する。既存 Carbey の実装（クライアント／プロバイダ／ツール／会話履歴）を、
依存する Supabase クライアント・関連 API ルートとセットで移植する。詳細は [docs/architecture.md](docs/architecture.md)。
