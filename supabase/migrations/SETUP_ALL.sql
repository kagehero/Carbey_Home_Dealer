-- =====================================================================
-- カーベイホームディーラー — 新規 Supabase プロジェクト セットアップ SQL
-- =====================================================================
-- 全 migration を実行順に結合したもの。新しい Supabase プロジェクトの
-- SQL Editor に、このファイル全体を貼り付けて 1 回 Run すれば
-- portal スキーマ一式（テーブル・関数・RLS・トリガー・Storageバケット・
-- Realtime設定）が構築される。冪等化済みなので再実行も可能。
--
-- 実行後にダッシュボードで必ず行うこと:
--   1. Settings → API → Exposed schemas に「portal」を追加
--   2. 下記 SQL の最後で NOTIFY 済みだが、反映されない場合は
--      Settings → API → Reload schema cache を押す
--   3. 管理者作成: node --env-file=.env scripts/create-admin.mjs \
--        'admin@example.com' 'password123!' '本部管理者'
--
-- 生成元 migration（実行順）:
--   001_portal_schema → 002_portal_seed_helpers → 003_rename_semi_auto_plan
--   → 003_onboarding → 004_orders → 005_chat → 006_chat_notifications
--   → 007_chat_attachments → 008_chat_enhancements
-- =====================================================================



-- #####################################################################
-- ## 001_portal_schema.sql
-- #####################################################################

-- =====================================================================
-- Carbey Portal — Phase 1: システム基盤構築 (要求事項定義書 v1.2 準拠)
-- =====================================================================
-- 設計方針 (docs/architecture.md 参照):
--   - 既存 Carbey と同じ Supabase プロジェクトに「相乗り」。新システムは専用スキーマ portal。
--   - 認証は auth.users を共有。新システムのユーザー属性は portal.users で管理 (論点Y)。
--   - tenant 分離キーは member_id / user_id。RLS でロール別アクセス制御 (論点A)。
--
-- 要求書 5.1 権限区分: 管理者 / 加盟店 / CRM入力担当 / チャット専用
--   admin     = 管理者(本部) 全権
--   member    = 加盟店
--   crm_staff = CRM入力担当 (内部スタッフ。CRM/会員のみ)
--   chat_only = チャット専用 (内部スタッフ。チャットのみ)
-- 要求書 4 プラン: home_dealer / economy / bronze / platinum / gold
-- 要求書 5.2 契約ステータス: active(有効) / suspended(停止) / cancelled(解約) + pending(申込中)
--
-- 全文を再実行可能。 既存の portal スキーマがあれば drop して作り直す。
-- =====================================================================

drop schema if exists portal cascade;
create schema portal;

grant usage on schema portal to anon, authenticated, service_role;

create or replace function portal.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- plans — プランマスタ (要求書 4 / 5.x プラン管理)
--   表示順: エコノミー → ブロンズ → プラチナ → ゴールド (要求書 4.2)
-- ---------------------------------------------------------------------
create table portal.plans (
  id            uuid primary key default gen_random_uuid(),
  code          text unique not null,                  -- 'home_dealer'|'economy'|'bronze'|'platinum'|'gold'
  name          text not null,
  plan_type     text not null check (plan_type in ('semi_auto', 'full_auto')),
  monthly_fee_yen integer not null default 0,
  joining_fee_yen integer not null default 0,
  display_order int not null default 0,
  description   text,
  features      jsonb not null default '[]'::jsonb,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_portal_plans_order on portal.plans(display_order);

create trigger trg_portal_plans_touch
  before update on portal.plans
  for each row execute function portal.touch_updated_at();

-- 要求書 4.2 準拠: 半自動(ホームディーラー) + 全自動4ランク(エコノミー/ブロンズ/プラチナ/ゴールド)
insert into portal.plans (code, name, plan_type, monthly_fee_yen, joining_fee_yen, display_order, description) values
  ('home_dealer', 'セミオート', 'semi_auto', 10000, 0, 0, '加盟者自身が車両選定・仕入れ判断・販売活動を主体的に行う半自動プラン（セミオート）'),
  ('economy',     'エコノミー', 'full_auto', 10000, 0, 1, 'エントリー最下位モデル。全自動プランの入門ランク'),
  ('bronze',      'ブロンズ',   'full_auto', 20000, 0, 2, '中位プラン。料金設定で優位性ありの最安値帯。自動売買機能に一部制限あり'),
  ('platinum',    'プラチナ',   'full_auto', 30000, 0, 3, '上位プラン。料金設定で優位性あり'),
  ('gold',        'ゴールド',   'full_auto', 50000, 0, 4, '最上位プラン。料金設定で優位性あり');

-- ---------------------------------------------------------------------
-- users — 新システムのユーザー属性 (auth.users と id で 1:1)
--   要求書 5.1: 管理者 / 加盟店 / CRM入力担当 / チャット専用
-- ---------------------------------------------------------------------
create table portal.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text,
  email       text,
  role        text not null check (role in ('admin', 'member', 'crm_staff', 'chat_only')),
  status      text not null default 'active' check (status in ('active', 'suspended')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_portal_users_role on portal.users(role);

create trigger trg_portal_users_touch
  before update on portal.users
  for each row execute function portal.touch_updated_at();

-- ---------------------------------------------------------------------
-- members — 加盟店の業務情報 (要求書 5.2 登録・管理項目)
-- ---------------------------------------------------------------------
create table portal.members (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid unique references auth.users(id) on delete set null,
  -- 基本情報 (要求書 5.2)
  company_name    text,
  member_name     text not null,                         -- 氏名
  phone_mobile    text,                                  -- 連絡先携帯番号
  phone_landline  text,                                  -- 固定電話番号
  email           text,
  address         text,                                  -- 住所
  -- 陸送先 (要求書 5.2)
  delivery_name   text,                                  -- 陸送先名
  delivery_address text,                                 -- 陸送先住所
  delivery_contact text,                                 -- 陸送先連絡先
  -- 契約情報 (要求書 5.2)
  plan_id         uuid references portal.plans(id),
  contract_date   date,                                  -- 契約日
  status          text not null default 'pending'
                    check (status in ('pending', 'active', 'suspended', 'cancelled')),  -- 有効/停止/解約
  -- 財務情報 (要求書 5.2)
  joining_fee_yen integer,                               -- 加盟金
  monthly_fee_yen integer,                               -- 月額費用
  working_capital_yen integer,                           -- 運転資金
  payment_status  text not null default 'unpaid'
                    check (payment_status in ('unpaid', 'paid', 'overdue')),
  -- 利用状況 (要求書 5.2)
  registration_date date not null default current_date,
  last_login_at   timestamptz,                           -- ログイン履歴
  -- オンボーディング進捗 (Phase 2 本体実装。ここでは完了ステップ数のみ)
  onboarding_total int not null default 8,
  onboarding_done  int not null default 0,
  -- 管理者内部メモ
  admin_notes     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_portal_members_status on portal.members(status);
create index idx_portal_members_plan   on portal.members(plan_id);
create index idx_portal_members_user   on portal.members(user_id);

create trigger trg_portal_members_touch
  before update on portal.members
  for each row execute function portal.touch_updated_at();

-- ---------------------------------------------------------------------
-- payments — 入金履歴 (要求書 5.2 財務情報)
-- ---------------------------------------------------------------------
create table portal.payments (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references portal.members(id) on delete cascade,
  amount_yen   integer not null,
  payment_date date not null default current_date,
  kind         text not null default 'monthly' check (kind in ('joining', 'monthly', 'other')),
  status       text not null default 'confirmed' check (status in ('pending', 'confirmed', 'failed')),
  note         text,
  created_at   timestamptz not null default now()
);

create index idx_portal_payments_member on portal.payments(member_id);
create index idx_portal_payments_date   on portal.payments(payment_date);

-- ---------------------------------------------------------------------
-- CRM (要求書 5.12) — 本部側でエンドユーザー(購入者)・商談情報を管理
--   将来の外部CRML連携・加盟店側拡張を見据え franchise(member)_id でモジュール化
-- ---------------------------------------------------------------------
create table portal.crm_customers (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid references portal.members(id) on delete set null,  -- 担当加盟店 (本部直管理は null)
  name         text not null,                           -- エンドユーザー(購入者)氏名
  phone        text,
  email        text,
  address      text,
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_portal_crm_customers_member on portal.crm_customers(member_id);

create trigger trg_portal_crm_customers_touch
  before update on portal.crm_customers
  for each row execute function portal.touch_updated_at();

-- 購入履歴 (要求書 5.12 顧客管理: 基本情報・購入履歴)
create table portal.crm_purchases (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references portal.crm_customers(id) on delete cascade,
  vehicle_name text,                                     -- 購入車両
  price_yen    integer,
  purchased_at date,
  note         text,
  created_at   timestamptz not null default now()
);

create index idx_portal_crm_purchases_customer on portal.crm_purchases(customer_id);

-- 商談管理 (要求書 5.12: 商談ステータス・進捗・対応履歴の記録)
create table portal.crm_deals (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references portal.crm_customers(id) on delete cascade,
  title        text,
  status       text not null default 'lead'
                 check (status in ('lead', 'negotiating', 'quoted', 'won', 'lost')),
  amount_yen   integer,
  assigned_to  uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_portal_crm_deals_customer on portal.crm_deals(customer_id);
create index idx_portal_crm_deals_status   on portal.crm_deals(status);

create trigger trg_portal_crm_deals_touch
  before update on portal.crm_deals
  for each row execute function portal.touch_updated_at();

-- 商談の対応履歴
create table portal.crm_deal_notes (
  id         uuid primary key default gen_random_uuid(),
  deal_id    uuid not null references portal.crm_deals(id) on delete cascade,
  author_id  uuid references auth.users(id) on delete set null,
  body       text not null,
  created_at timestamptz not null default now()
);

create index idx_portal_crm_deal_notes_deal on portal.crm_deal_notes(deal_id);

-- ---------------------------------------------------------------------
-- notifications — 通知 (新規会員登録・入金確認・オーダー・チャット等)
-- ---------------------------------------------------------------------
create table portal.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,  -- 宛先 (null = admin宛て)
  audience    text not null default 'user' check (audience in ('user', 'admin')),
  kind        text not null default 'info',
  title       text not null,
  message     text,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index idx_portal_notifications_user on portal.notifications(user_id, is_read);
create index idx_portal_notifications_audience on portal.notifications(audience, is_read);

-- =====================================================================
-- RLS ヘルパー関数
-- =====================================================================

-- 管理者(本部)か?
create or replace function portal.is_admin(uid uuid)
returns boolean language sql stable security definer set search_path = portal as $$
  select exists (select 1 from portal.users u where u.id = uid and u.role = 'admin');
$$;

-- 本部スタッフ(管理者/CRM入力担当/チャット専用)か? = member 以外
create or replace function portal.is_staff(uid uuid)
returns boolean language sql stable security definer set search_path = portal as $$
  select exists (select 1 from portal.users u where u.id = uid and u.role in ('admin', 'crm_staff', 'chat_only'));
$$;

-- CRM にアクセスできるか? (管理者 or CRM入力担当)
create or replace function portal.can_crm(uid uuid)
returns boolean language sql stable security definer set search_path = portal as $$
  select exists (select 1 from portal.users u where u.id = uid and u.role in ('admin', 'crm_staff'));
$$;

-- uid が紐付く member.id (加盟店本人のみ)
create or replace function portal.current_member_id(uid uuid)
returns uuid language sql stable security definer set search_path = portal as $$
  select m.id from portal.members m where m.user_id = uid;
$$;

-- =====================================================================
-- RLS ポリシー (要求書 5.1 権限に応じた機能制限)
-- =====================================================================
alter table portal.plans          enable row level security;
alter table portal.users          enable row level security;
alter table portal.members        enable row level security;
alter table portal.payments       enable row level security;
alter table portal.crm_customers  enable row level security;
alter table portal.crm_purchases  enable row level security;
alter table portal.crm_deals      enable row level security;
alter table portal.crm_deal_notes enable row level security;
alter table portal.notifications  enable row level security;

-- plans: 認証ユーザー閲覧可 / 書き込みは admin
create policy portal_plans_read on portal.plans
  for select using (auth.uid() is not null);
create policy portal_plans_admin_write on portal.plans
  for all using (portal.is_admin(auth.uid())) with check (portal.is_admin(auth.uid()));

-- users: 本部スタッフは全件 / 本人は自分の行 / 書き込みは admin
create policy portal_users_read on portal.users
  for select using (portal.is_staff(auth.uid()) or id = auth.uid());
create policy portal_users_admin_write on portal.users
  for all using (portal.is_admin(auth.uid())) with check (portal.is_admin(auth.uid()));

-- members: 本部スタッフ全件 / 加盟店本人は自分のみ / 書き込みは admin or crm_staff
create policy portal_members_read on portal.members
  for select using (portal.is_staff(auth.uid()) or user_id = auth.uid());
create policy portal_members_staff_write on portal.members
  for all using (portal.can_crm(auth.uid())) with check (portal.can_crm(auth.uid()));

-- payments: 本部スタッフ全件 / 加盟店は自分の分を閲覧 / 書き込みは admin
create policy portal_payments_read on portal.payments
  for select using (portal.is_staff(auth.uid()) or member_id = portal.current_member_id(auth.uid()));
create policy portal_payments_admin_write on portal.payments
  for all using (portal.is_admin(auth.uid())) with check (portal.is_admin(auth.uid()));

-- CRM: admin or crm_staff のみ (要求書 Feature Matrix: member は CRM 不可)
create policy portal_crm_customers_all on portal.crm_customers
  for all using (portal.can_crm(auth.uid())) with check (portal.can_crm(auth.uid()));
create policy portal_crm_purchases_all on portal.crm_purchases
  for all using (portal.can_crm(auth.uid())) with check (portal.can_crm(auth.uid()));
create policy portal_crm_deals_all on portal.crm_deals
  for all using (portal.can_crm(auth.uid())) with check (portal.can_crm(auth.uid()));
create policy portal_crm_deal_notes_all on portal.crm_deal_notes
  for all using (portal.can_crm(auth.uid())) with check (portal.can_crm(auth.uid()));

-- notifications: 宛先本人 or admin宛てを本部スタッフが読む
create policy portal_notifications_read on portal.notifications
  for select using (
    user_id = auth.uid()
    or (audience = 'admin' and portal.is_staff(auth.uid()))
  );
create policy portal_notifications_update on portal.notifications
  for update using (
    user_id = auth.uid()
    or (audience = 'admin' and portal.is_staff(auth.uid()))
  );
create policy portal_notifications_insert on portal.notifications
  for insert with check (portal.is_staff(auth.uid()));

-- =====================================================================
-- GRANTS
-- =====================================================================
grant select on all tables in schema portal to anon, authenticated;
grant insert, update, delete on all tables in schema portal to authenticated;
grant all on all tables in schema portal to service_role;
grant execute on all functions in schema portal to anon, authenticated, service_role;

alter default privileges in schema portal grant select on tables to anon, authenticated;
alter default privileges in schema portal grant insert, update, delete on tables to authenticated;
alter default privileges in schema portal grant all on tables to service_role;
alter default privileges in schema portal grant execute on functions to anon, authenticated, service_role;


-- #####################################################################
-- ## 002_portal_seed_helpers.sql
-- #####################################################################

-- =====================================================================
-- Carbey Portal — Phase 1: ブートストラップ用ヘルパー (要求書準拠版)
-- =====================================================================
-- auth.users に存在する user_id を portal.users に登録する。
-- public ラッパーも用意し、portal スキーマ未公開でも RPC で呼べるようにする。
-- ロール: admin / member / crm_staff / chat_only
-- =====================================================================

-- 過去バージョンの関数を掃除する (引数シグネチャ違いで複数残っていると
-- "function name is not unique" になるため、考えられる全シグネチャを明示 drop)。
drop function if exists public.portal_bootstrap_admin(uuid, text);
drop function if exists public.portal_bootstrap_admin(uuid, text, text);
drop function if exists public.portal_bootstrap_super_admin(uuid, text);
drop function if exists public.portal_bootstrap_super_admin(uuid, text, text);
drop function if exists portal.bootstrap_admin(uuid, text);
drop function if exists portal.bootstrap_admin(uuid, text, text);
drop function if exists portal.bootstrap_super_admin(uuid, text);
drop function if exists portal.bootstrap_super_admin(uuid, text, text);
drop function if exists portal.attach_user(uuid, text, text);
drop function if exists portal.attach_user(uuid, text, text, text);
drop function if exists portal.attach_franchise_user(uuid, uuid, text, text);

-- 管理者(本部)を登録/昇格
create or replace function portal.bootstrap_admin(p_user_id uuid, p_name text default null, p_email text default null)
returns void language plpgsql security definer set search_path = portal as $$
begin
  insert into portal.users (id, name, email, role)
  values (p_user_id, p_name, p_email, 'admin')
  on conflict (id) do update
    set role = 'admin',
        name = coalesce(excluded.name, portal.users.name),
        email = coalesce(excluded.email, portal.users.email);
end;
$$;

comment on function portal.bootstrap_admin is
  '最初の管理者(本部)を登録/昇格する。auth.users に存在する user_id を渡す。';

-- public ラッパー (PostgREST は public のみ公開のため)
create or replace function public.portal_bootstrap_admin(p_user_id uuid, p_name text default null, p_email text default null)
returns void language sql security definer set search_path = public, portal as $$
  select portal.bootstrap_admin(p_user_id, p_name, p_email);
$$;

comment on function public.portal_bootstrap_admin is
  'portal.bootstrap_admin の public ラッパー。スキーマ未公開でも RPC 呼び出し可能にするため。';

-- 任意ロールのユーザーを登録 (member / crm_staff / chat_only)
create or replace function portal.attach_user(p_user_id uuid, p_role text, p_name text default null, p_email text default null)
returns void language plpgsql security definer set search_path = portal as $$
begin
  if p_role not in ('admin', 'member', 'crm_staff', 'chat_only') then
    raise exception 'invalid role: %', p_role;
  end if;
  insert into portal.users (id, name, email, role)
  values (p_user_id, p_name, p_email, p_role)
  on conflict (id) do update
    set role = excluded.role,
        name = coalesce(excluded.name, portal.users.name),
        email = coalesce(excluded.email, portal.users.email);
end;
$$;

comment on function portal.attach_user is
  '作成済み auth ユーザーを portal.users に登録する (admin/member/crm_staff/chat_only)。';


-- #####################################################################
-- ## 003_rename_semi_auto_plan.sql
-- #####################################################################

-- 003: プラン表示名のリネーム（クライアント命名変更）
--   サービス名を「カーベイホームディーラー」に格上げしたため、半自動プランの表示名を
--   「カーベイホームディーラー (半自動)」→「セミオート」に変更する。
--   内部コード(code='home_dealer')は維持し、既存の加盟店レコードの plan_id 参照に影響を与えない。
--
-- 冪等。何度実行してもよい。

update portal.plans
set
  name = 'セミオート',
  description = '加盟者自身が車両選定・仕入れ判断・販売活動を主体的に行う半自動プラン（セミオート）'
where code = 'home_dealer';


-- #####################################################################
-- ## 003_onboarding.sql
-- #####################################################################

-- =====================================================================
-- Carbey Portal — Phase 2: オンボーディング (スタートアップ進捗)
-- =====================================================================
-- 加盟店ごとのオンボーディングタスクを保持する。
-- ステップ(step_key)でグルーピングし、本部が進捗を管理、加盟店は閲覧する。
-- members.onboarding_total / onboarding_done はトリガで自動同期する
-- （既存ダッシュボードの集計表示をそのまま使い続けるため）。
-- 冪等化のため drop ... if exists を併用。
-- =====================================================================

create table if not exists portal.onboarding_tasks (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references portal.members(id) on delete cascade,
  step_key    text not null,        -- contract | funding | documents | training | launch
  step_label  text not null,        -- ステップ表示名
  title       text not null,        -- タスク名
  status      text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  sort_order  int not null default 0,
  due_date    date,
  completed_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_onboarding_tasks_member on portal.onboarding_tasks(member_id);
create index if not exists idx_onboarding_tasks_order  on portal.onboarding_tasks(member_id, sort_order);

drop trigger if exists trg_onboarding_tasks_touch on portal.onboarding_tasks;
create trigger trg_onboarding_tasks_touch
  before update on portal.onboarding_tasks
  for each row execute function portal.touch_updated_at();

-- ---------------------------------------------------------------------
-- members の集計カラムを onboarding_tasks から同期する
-- ---------------------------------------------------------------------
create or replace function portal.sync_onboarding_progress()
returns trigger language plpgsql security definer set search_path = portal as $$
declare
  v_member uuid := coalesce(new.member_id, old.member_id);
  v_total int;
  v_done  int;
begin
  select count(*), count(*) filter (where status = 'done')
    into v_total, v_done
    from portal.onboarding_tasks where member_id = v_member;

  update portal.members
     set onboarding_total = greatest(v_total, 1),
         onboarding_done  = v_done
   where id = v_member;

  return null;
end;
$$;

drop trigger if exists trg_onboarding_sync on portal.onboarding_tasks;
create trigger trg_onboarding_sync
  after insert or update or delete on portal.onboarding_tasks
  for each row execute function portal.sync_onboarding_progress();

-- ---------------------------------------------------------------------
-- 既定タスクの生成（加盟店ごと。重複生成しない）
-- ---------------------------------------------------------------------
create or replace function portal.seed_onboarding_tasks(p_member_id uuid)
returns void language plpgsql security definer set search_path = portal as $$
begin
  -- 既にタスクがあれば何もしない（冪等）
  if exists (select 1 from portal.onboarding_tasks where member_id = p_member_id) then
    return;
  end if;

  insert into portal.onboarding_tasks (member_id, step_key, step_label, title, sort_order) values
    (p_member_id, 'contract',  '契約・初期設定', '加盟契約の締結',                 10),
    (p_member_id, 'contract',  '契約・初期設定', 'アカウント発行・初回ログイン',   20),
    (p_member_id, 'contract',  '契約・初期設定', 'プロフィール（連絡先・陸送先）の登録', 30),
    (p_member_id, 'funding',   '資金調達',       '資金調達申請',                   40),
    (p_member_id, 'funding',   '資金調達',       '事業計画書の提出',               50),
    (p_member_id, 'funding',   '資金調達',       '銀行口座情報の登録',             60),
    (p_member_id, 'funding',   '資金調達',       '融資審査の完了',                 70),
    (p_member_id, 'documents', '必要書類の提出', '本人確認書類',                   80),
    (p_member_id, 'documents', '必要書類の提出', '古物商許可証',                   90),
    (p_member_id, 'documents', '必要書類の提出', '販売店情報の登録',              100),
    (p_member_id, 'training',  'トレーニング',   '市場の見方を学ぶ',              110),
    (p_member_id, 'training',  'トレーニング',   'AI壁打ちで候補整理を体験',      120),
    (p_member_id, 'training',  'トレーニング',   '出品ルールの確認',              130),
    (p_member_id, 'launch',    '運用開始',       '初回仕入れオーダー',            140),
    (p_member_id, 'launch',    '運用開始',       '初回出品',                      150),
    (p_member_id, 'launch',    '運用開始',       '全機能の解放',                  160);
end;
$$;

-- public ラッパー（スキーマ未公開でも RPC で叩けるように）
create or replace function public.portal_seed_onboarding_tasks(p_member_id uuid)
returns void language sql security definer set search_path = public, portal as $$
  select portal.seed_onboarding_tasks(p_member_id);
$$;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table portal.onboarding_tasks enable row level security;

-- 閲覧: 本部スタッフは全件、加盟店は自分のタスクのみ
drop policy if exists portal_onboarding_read on portal.onboarding_tasks;
create policy portal_onboarding_read on portal.onboarding_tasks
  for select using (
    portal.is_staff(auth.uid())
    or member_id = portal.current_member_id(auth.uid())
  );

-- 編集（タスク完了など）: 本部のみ（オンボーディングは本部主導）
drop policy if exists portal_onboarding_admin_write on portal.onboarding_tasks;
create policy portal_onboarding_admin_write on portal.onboarding_tasks
  for all using (portal.can_crm(auth.uid())) with check (portal.can_crm(auth.uid()));

-- ---------------------------------------------------------------------
-- 既存の全加盟店に既定タスクを生成（初回適用時）
-- ---------------------------------------------------------------------
do $$
declare r record;
begin
  for r in select id from portal.members loop
    perform portal.seed_onboarding_tasks(r.id);
  end loop;
end $$;


-- #####################################################################
-- ## 004_orders.sql
-- #####################################################################

-- =====================================================================
-- Carbey Portal — Phase 2: オーダー (仕入れ依頼)
-- =====================================================================
-- 加盟店が本部に車両の仕入れを依頼する。
-- 加盟店は自分のオーダーを作成・閲覧、本部(can_crm)が全件を処理する。
-- order_number は ORD-YYYYMM-#### 形式で自動採番。
-- 冪等化のため if exists / or replace を併用。
-- =====================================================================

create table if not exists portal.orders (
  id            uuid primary key default gen_random_uuid(),
  order_number  text unique,
  member_id     uuid not null references portal.members(id) on delete cascade,
  -- 依頼内容
  maker         text,                 -- メーカー
  car_model     text not null,        -- 車種
  year          text,                 -- 年式
  budget_yen    integer,              -- 予算
  preferred_color text,               -- 希望色
  mileage_max   integer,              -- 走行距離上限(km)
  notes         text,                 -- 要望・備考
  -- 進行
  status        text not null default 'received'
                  check (status in ('received', 'in_progress', 'completed', 'cancelled')),
  admin_notes   text,                 -- 本部メモ
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_orders_member on portal.orders(member_id);
create index if not exists idx_orders_status on portal.orders(status);
create index if not exists idx_orders_created on portal.orders(created_at desc);

drop trigger if exists trg_orders_touch on portal.orders;
create trigger trg_orders_touch
  before update on portal.orders
  for each row execute function portal.touch_updated_at();

-- ---------------------------------------------------------------------
-- order_number の自動採番 (ORD-YYYYMM-#### ：その月の連番)
-- ---------------------------------------------------------------------
create or replace function portal.set_order_number()
returns trigger language plpgsql security definer set search_path = portal as $$
declare
  v_prefix text := 'ORD-' || to_char(now(), 'YYYYMM') || '-';
  v_seq int;
begin
  if new.order_number is not null then
    return new;
  end if;
  select count(*) + 1 into v_seq
    from portal.orders
   where order_number like v_prefix || '%';
  new.order_number := v_prefix || lpad(v_seq::text, 4, '0');
  return new;
end;
$$;

drop trigger if exists trg_orders_number on portal.orders;
create trigger trg_orders_number
  before insert on portal.orders
  for each row execute function portal.set_order_number();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table portal.orders enable row level security;

-- 閲覧: 本部スタッフは全件、加盟店は自分のオーダーのみ
drop policy if exists portal_orders_read on portal.orders;
create policy portal_orders_read on portal.orders
  for select using (
    portal.is_staff(auth.uid())
    or member_id = portal.current_member_id(auth.uid())
  );

-- 作成: 加盟店は自分の member_id でのみ作成可
drop policy if exists portal_orders_member_insert on portal.orders;
create policy portal_orders_member_insert on portal.orders
  for insert with check (
    member_id = portal.current_member_id(auth.uid())
  );

-- 更新/削除(処理): 本部(can_crm)のみ
drop policy if exists portal_orders_admin_write on portal.orders;
create policy portal_orders_admin_write on portal.orders
  for update using (portal.can_crm(auth.uid())) with check (portal.can_crm(auth.uid()));
drop policy if exists portal_orders_admin_delete on portal.orders;
create policy portal_orders_admin_delete on portal.orders
  for delete using (portal.is_admin(auth.uid()));


-- #####################################################################
-- ## 005_chat.sql
-- #####################################################################

-- =====================================================================
-- Carbey Portal — Phase 2: チャット (本部 ⇄ 加盟店の個別連絡)
-- =====================================================================
-- 会話(conversation)は加盟店ごとに1つ。メッセージ(message)が紐づく。
-- 本部スタッフ(is_staff)は全会話、加盟店は自分の会話のみ。
-- Supabase Realtime で chat_messages の INSERT を配信する。
-- 冪等化のため if exists / or replace を併用。
-- =====================================================================

create table if not exists portal.chat_conversations (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null unique references portal.members(id) on delete cascade,
  last_message_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists idx_chat_conv_member on portal.chat_conversations(member_id);

create table if not exists portal.chat_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references portal.chat_conversations(id) on delete cascade,
  sender_id       uuid references auth.users(id) on delete set null,
  sender_role     text not null check (sender_role in ('admin', 'member', 'crm_staff', 'chat_only')),
  body            text not null,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists idx_chat_msg_conv on portal.chat_messages(conversation_id, created_at);

-- 会話の last_message_at を更新
create or replace function portal.touch_conversation()
returns trigger language plpgsql security definer set search_path = portal as $$
begin
  update portal.chat_conversations
     set last_message_at = new.created_at
   where id = new.conversation_id;
  return null;
end;
$$;

drop trigger if exists trg_chat_touch_conv on portal.chat_messages;
create trigger trg_chat_touch_conv
  after insert on portal.chat_messages
  for each row execute function portal.touch_conversation();

-- 加盟店の会話を取得 or 作成（本部・加盟店どちらからでも）
create or replace function portal.get_or_create_conversation(p_member_id uuid)
returns uuid language plpgsql security definer set search_path = portal as $$
declare v_id uuid;
begin
  select id into v_id from portal.chat_conversations where member_id = p_member_id;
  if v_id is null then
    insert into portal.chat_conversations (member_id) values (p_member_id) returning id into v_id;
  end if;
  return v_id;
end;
$$;

create or replace function public.portal_get_or_create_conversation(p_member_id uuid)
returns uuid language sql security definer set search_path = public, portal as $$
  select portal.get_or_create_conversation(p_member_id);
$$;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table portal.chat_conversations enable row level security;
alter table portal.chat_messages      enable row level security;

-- 会話: 本部は全件、加盟店は自分の会話のみ
drop policy if exists portal_chat_conv_read on portal.chat_conversations;
create policy portal_chat_conv_read on portal.chat_conversations
  for select using (
    portal.is_staff(auth.uid())
    or member_id = portal.current_member_id(auth.uid())
  );
drop policy if exists portal_chat_conv_staff_write on portal.chat_conversations;
create policy portal_chat_conv_staff_write on portal.chat_conversations
  for all using (portal.is_staff(auth.uid())) with check (portal.is_staff(auth.uid()));

-- メッセージ: 自分が参加する会話のメッセージのみ閲覧
drop policy if exists portal_chat_msg_read on portal.chat_messages;
create policy portal_chat_msg_read on portal.chat_messages
  for select using (
    exists (
      select 1 from portal.chat_conversations c
      where c.id = conversation_id
        and (portal.is_staff(auth.uid()) or c.member_id = portal.current_member_id(auth.uid()))
    )
  );

-- メッセージ送信: 本部 or 当該会話の加盟店本人
drop policy if exists portal_chat_msg_insert on portal.chat_messages;
create policy portal_chat_msg_insert on portal.chat_messages
  for insert with check (
    exists (
      select 1 from portal.chat_conversations c
      where c.id = conversation_id
        and (portal.is_staff(auth.uid()) or c.member_id = portal.current_member_id(auth.uid()))
    )
  );

-- 既読更新（read_at）: 会話の参加者
drop policy if exists portal_chat_msg_update on portal.chat_messages;
create policy portal_chat_msg_update on portal.chat_messages
  for update using (
    exists (
      select 1 from portal.chat_conversations c
      where c.id = conversation_id
        and (portal.is_staff(auth.uid()) or c.member_id = portal.current_member_id(auth.uid()))
    )
  );

-- ---------------------------------------------------------------------
-- Realtime: chat_messages の変更を配信対象に追加
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'portal' and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table portal.chat_messages;
  end if;
exception when undefined_object then
  -- supabase_realtime publication が無い環境では何もしない
  null;
end $$;


-- #####################################################################
-- ## 006_chat_notifications.sql
-- #####################################################################

-- =====================================================================
-- Carbey Portal — Phase 2: チャット受信通知
-- =====================================================================
-- chat_messages の INSERT 時に、受信者向けの notification を自動作成する。
--   加盟店 → 本部 : audience='admin' の通知
--   本部   → 加盟店: その加盟店の user_id 宛て通知 (audience='user')
-- 既存の notifications テーブル・通知ベルにそのまま乗せる。
-- notifications を Realtime 配信対象に追加し、ベルの未読数を即時更新できるようにする。
-- 冪等化のため or replace / if exists を併用。
-- =====================================================================

create or replace function portal.notify_on_chat_message()
returns trigger language plpgsql security definer set search_path = portal as $$
declare
  v_member_id   uuid;
  v_member_uid  uuid;
  v_member_name text;
  v_snippet     text;
begin
  -- 会話の加盟店を特定
  select c.member_id, m.user_id, coalesce(m.company_name, m.member_name)
    into v_member_id, v_member_uid, v_member_name
    from portal.chat_conversations c
    join portal.members m on m.id = c.member_id
   where c.id = new.conversation_id;

  -- 本文スニペット (通知一覧用に短く)
  v_snippet := left(new.body, 60);

  if new.sender_role = 'member' then
    -- 加盟店発 → 本部宛て
    insert into portal.notifications (audience, kind, title, message)
    values ('admin', 'chat', v_member_name || ' さんからメッセージ', v_snippet);
  else
    -- 本部発 → 加盟店宛て (user_id があるときのみ)
    if v_member_uid is not null then
      insert into portal.notifications (user_id, audience, kind, title, message)
      values (v_member_uid, 'user', 'chat', '本部からメッセージが届きました', v_snippet);
    end if;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_chat_notify on portal.chat_messages;
create trigger trg_chat_notify
  after insert on portal.chat_messages
  for each row execute function portal.notify_on_chat_message();

-- ---------------------------------------------------------------------
-- notifications を Realtime 配信対象に追加（ベルの即時更新用）
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'portal' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table portal.notifications;
  end if;
exception when undefined_object then
  null;
end $$;


-- #####################################################################
-- ## 007_chat_attachments.sql
-- #####################################################################

-- =====================================================================
-- Carbey Portal — Phase 2: チャット添付ファイル (画像 / PDF / 文書)
-- =====================================================================
-- chat_messages に添付情報を持たせ、body を nullable 化（ファイルのみ送信を許可）。
-- ファイル本体は Supabase Storage の private バケット chat-attachments に保存し、
-- 表示時にサーバーで短期の署名URLを発行する（アプリ側で実装）。
-- 冪等化のため if exists / if not exists を併用。
-- =====================================================================

-- 添付カラム
alter table portal.chat_messages add column if not exists attachment_path text;   -- Storage 内パス
alter table portal.chat_messages add column if not exists attachment_name text;   -- 元ファイル名
alter table portal.chat_messages add column if not exists attachment_type text;   -- MIME
alter table portal.chat_messages add column if not exists attachment_size int;    -- バイト

-- body: ファイルのみ送信を許可するため nullable に。
-- ただし body か attachment のどちらかは必須。
alter table portal.chat_messages alter column body drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chat_messages_body_or_attachment'
  ) then
    alter table portal.chat_messages
      add constraint chat_messages_body_or_attachment
      check (body is not null or attachment_path is not null);
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Storage: private バケット chat-attachments
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', false)
on conflict (id) do nothing;

-- Storage RLS: サーバー(service_role)は RLS をバイパスするため、
-- 保存・署名URL発行はアプリのサーバーアクション経由で行う想定。
-- 直接の匿名アクセスは禁止（public=false のため URL 直叩き不可）。
-- 認証ユーザーが自分の会話の添付を読めるよう、念のため select ポリシーを付ける。
drop policy if exists chat_attachments_read on storage.objects;
create policy chat_attachments_read on storage.objects
  for select using (
    bucket_id = 'chat-attachments'
    and auth.uid() is not null
  );

-- ---------------------------------------------------------------------
-- 通知トリガーを更新：ファイルのみのメッセージでもスニペットが空にならないように
-- ---------------------------------------------------------------------
create or replace function portal.notify_on_chat_message()
returns trigger language plpgsql security definer set search_path = portal as $$
declare
  v_member_uid  uuid;
  v_member_name text;
  v_snippet     text;
begin
  select m.user_id, coalesce(m.company_name, m.member_name)
    into v_member_uid, v_member_name
    from portal.chat_conversations c
    join portal.members m on m.id = c.member_id
   where c.id = new.conversation_id;

  v_snippet := coalesce(left(new.body, 60), '📎 ' || coalesce(new.attachment_name, 'ファイル'));

  if new.sender_role = 'member' then
    insert into portal.notifications (audience, kind, title, message)
    values ('admin', 'chat', v_member_name || ' さんからメッセージ', v_snippet);
  else
    if v_member_uid is not null then
      insert into portal.notifications (user_id, audience, kind, title, message)
      values (v_member_uid, 'user', 'chat', '本部からメッセージが届きました', v_snippet);
    end if;
  end if;

  return null;
end;
$$;


-- #####################################################################
-- ## 008_chat_enhancements.sql
-- #####################################################################

-- =====================================================================
-- Carbey Portal — Phase 2: チャット機能強化
-- =====================================================================
-- 送信者名の表示・メッセージの編集/削除に対応するためのカラムを追加。
--   sender_name : 送信時点の表示名（誰が発言したか。本部の複数スタッフ区別に必須）
--   edited_at   : 編集時刻（null=未編集）
--   deleted_at  : 論理削除時刻（null=有効）
-- sender_name は INSERT トリガーで portal.users / members から自動補完する。
-- 冪等化のため if exists / or replace を併用。
-- =====================================================================

alter table portal.chat_messages add column if not exists sender_name text;
alter table portal.chat_messages add column if not exists edited_at   timestamptz;
alter table portal.chat_messages add column if not exists deleted_at  timestamptz;

-- 送信者名を自動補完する（明示指定が無いとき）
create or replace function portal.fill_chat_sender_name()
returns trigger language plpgsql security definer set search_path = portal as $$
declare v_name text;
begin
  if new.sender_name is not null then
    return new;
  end if;

  if new.sender_role = 'member' then
    -- 加盟店：members の担当者名（会社名を優先表示）
    select coalesce(m.member_name, m.company_name)
      into v_name
      from portal.members m where m.user_id = new.sender_id;
  else
    -- 本部スタッフ：portal.users の名前
    select u.name into v_name from portal.users u where u.id = new.sender_id;
  end if;

  new.sender_name := coalesce(v_name, case
    when new.sender_role = 'member' then '加盟店'
    else '本部'
  end);
  return new;
end;
$$;

drop trigger if exists trg_chat_sender_name on portal.chat_messages;
create trigger trg_chat_sender_name
  before insert on portal.chat_messages
  for each row execute function portal.fill_chat_sender_name();

-- 既存メッセージの sender_name を後埋め（初回適用時）
update portal.chat_messages msg
   set sender_name = coalesce(
     (select u.name from portal.users u where u.id = msg.sender_id),
     (select coalesce(m.member_name, m.company_name) from portal.members m where m.user_id = msg.sender_id),
     case when msg.sender_role = 'member' then '加盟店' else '本部' end
   )
 where sender_name is null;


-- #####################################################################


-- #####################################################################
-- ## 009_announcements.sql
-- #####################################################################

-- =====================================================================
-- Carbey Portal — Phase 2: お知らせ配信（本部 → 全加盟店）
-- =====================================================================
-- 本部が全加盟店向けのお知らせを投稿する。加盟店ダッシュボードに一覧表示。
-- 投稿時に全 active 加盟店の user_id 宛て通知を fan-out し、通知ベルも点く。
-- 冪等化のため if exists / or replace を併用。
-- =====================================================================

create table if not exists portal.announcements (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text not null,
  -- 重要度（important は加盟店側で強調表示）
  level       text not null default 'info' check (level in ('info', 'important')),
  published   boolean not null default true,
  author_id   uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_announcements_created on portal.announcements(created_at desc);

drop trigger if exists trg_announcements_touch on portal.announcements;
create trigger trg_announcements_touch
  before update on portal.announcements
  for each row execute function portal.touch_updated_at();

-- ---------------------------------------------------------------------
-- お知らせ投稿時に、全 active 加盟店へ通知を fan-out する
-- ---------------------------------------------------------------------
create or replace function portal.notify_announcement()
returns trigger language plpgsql security definer set search_path = portal as $$
begin
  if new.published then
    insert into portal.notifications (user_id, audience, kind, title, message)
    select m.user_id, 'user', 'announcement', new.title, left(new.body, 80)
      from portal.members m
     where m.user_id is not null and m.status = 'active';
  end if;
  return null;
end;
$$;

drop trigger if exists trg_announcement_notify on portal.announcements;
create trigger trg_announcement_notify
  after insert on portal.announcements
  for each row execute function portal.notify_announcement();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table portal.announcements enable row level security;

-- 閲覧：ログインユーザー全員（本部・加盟店とも公開分を見る）
drop policy if exists portal_announcements_read on portal.announcements;
create policy portal_announcements_read on portal.announcements
  for select using (auth.uid() is not null);

-- 作成・更新・削除：本部（can_crm 以上）
drop policy if exists portal_announcements_write on portal.announcements;
create policy portal_announcements_write on portal.announcements
  for all using (portal.can_crm(auth.uid())) with check (portal.can_crm(auth.uid()));

-- GRANT（001 と同じ方針。新規テーブルなので明示付与）
grant select on portal.announcements to anon, authenticated;
grant insert, update, delete on portal.announcements to authenticated;
grant all on portal.announcements to service_role;


-- #####################################################################


-- #####################################################################
-- ## 010_onboarding_gating.sql
-- #####################################################################

-- =====================================================================
-- Carbey Portal — Phase 2 改修: フローチャート型・ゲート式オンボーディング
-- =====================================================================
-- クライアント要件:「加盟者が勝手に先行できない・飛ばせない・登録しないと開始できない」
--   - ステップ順厳守（前ステップ完了まで次ステップはロック）
--   - タスクは加盟店のアクションで自動完了（completion_type='auto'）
--   - 一部は本部承認（completion_type='manual'）
-- 冪等化のため if exists / or replace を併用。
-- =====================================================================

-- 完了方法の区分（auto=加盟店の操作で完了 / manual=本部承認で完了）
alter table portal.onboarding_tasks add column if not exists completion_type text not null default 'manual'
  check (completion_type in ('auto', 'manual'));

-- ステップの並び順（同一 step_key の最小 sort_order でステップ順を決める用）
-- 既存の sort_order を流用するため追加カラムは不要。

-- ---------------------------------------------------------------------
-- 既定タスク生成を「ゲート式」の定義に更新（completion_type つき）
-- 物販(eBay等)の具体項目は使わず、中古車FC向けの汎用ステップにする。
-- ---------------------------------------------------------------------
create or replace function portal.seed_onboarding_tasks(p_member_id uuid)
returns void language plpgsql security definer set search_path = portal as $$
begin
  if exists (select 1 from portal.onboarding_tasks where member_id = p_member_id) then
    return;
  end if;

  insert into portal.onboarding_tasks (member_id, step_key, step_label, title, sort_order, completion_type) values
    -- STEP1 契約・初期設定
    (p_member_id, 'contract',  '契約・初期設定', '加盟契約の締結',                     10, 'manual'),
    (p_member_id, 'contract',  '契約・初期設定', 'アカウント発行・初回ログイン',       20, 'auto'),
    (p_member_id, 'contract',  '契約・初期設定', 'プロフィール（連絡先・陸送先）の登録', 30, 'auto'),
    -- STEP2 本人確認・必要書類
    (p_member_id, 'documents', '本人確認・必要書類', '本人確認書類の提出',             40, 'manual'),
    (p_member_id, 'documents', '本人確認・必要書類', '古物商許可証の提出',             50, 'manual'),
    (p_member_id, 'documents', '本人確認・必要書類', '販売店情報の登録',               60, 'auto'),
    -- STEP3 決済・資金
    (p_member_id, 'funding',   '決済・資金設定',   '決済情報（口座/カード）の登録',     70, 'auto'),
    (p_member_id, 'funding',   '決済・資金設定',   '利用規約への同意',                 80, 'auto'),
    -- STEP4 トレーニング（動画→確認）
    (p_member_id, 'training',  'トレーニング',     '市場分析マニュアルの視聴',         90, 'auto'),
    (p_member_id, 'training',  'トレーニング',     '仕入れ判断マニュアルの視聴',       100, 'auto'),
    (p_member_id, 'training',  'トレーニング',     '出品・販売ルールの確認',           110, 'auto'),
    -- STEP5 運用開始準備
    (p_member_id, 'launch',    '運用開始準備',     '初回オーダーの作成',               120, 'auto'),
    (p_member_id, 'launch',    '運用開始準備',     '全項目完了の確認',                 130, 'manual');
end;
$$;

-- ---------------------------------------------------------------------
-- 加盟店による自己完了（ゲート厳守）。
--   - completion_type='auto' のタスクのみ
--   - そのタスクが属するステップが「現在進行中（ロックされていない）」場合のみ
--   - 前ステップが未完了ならエラー（飛ばせない）
-- ---------------------------------------------------------------------
create or replace function portal.complete_own_task(p_user_id uuid, p_task_id uuid)
returns void language plpgsql security definer set search_path = portal as $$
declare
  v_member uuid;
  v_task   record;
  v_prev_incomplete int;
begin
  -- 本人の member を特定
  select id into v_member from portal.members where user_id = p_user_id;
  if v_member is null then raise exception 'member not found'; end if;

  -- タスク取得（本人のものか・auto か）
  select * into v_task from portal.onboarding_tasks
   where id = p_task_id and member_id = v_member;
  if v_task is null then raise exception 'task not found'; end if;
  if v_task.completion_type <> 'auto' then raise exception 'このタスクは本部の確認が必要です'; end if;
  if v_task.status = 'done' then return; end if;

  -- ゲート判定: このタスクより前の sort_order のタスクに未完了があれば拒否（飛ばせない）
  select count(*) into v_prev_incomplete
    from portal.onboarding_tasks
   where member_id = v_member and sort_order < v_task.sort_order and status <> 'done';
  if v_prev_incomplete > 0 then
    raise exception '前のステップが未完了です。順番に進めてください。';
  end if;

  update portal.onboarding_tasks
     set status = 'done', completed_at = now()
   where id = p_task_id;
end;
$$;

create or replace function public.portal_complete_own_task(p_user_id uuid, p_task_id uuid)
returns void language sql security definer set search_path = public, portal as $$
  select portal.complete_own_task(p_user_id, p_task_id);
$$;

-- 既存メンバーのタスクに completion_type を後付け（前バージョンで生成済みのもの）
update portal.onboarding_tasks set completion_type = 'auto'
 where completion_type = 'manual'
   and title in ('アカウント発行・初回ログイン','プロフィール（連絡先・陸送先）の登録','販売店情報の登録',
                 '決済情報（口座/カード）の登録','利用規約への同意','市場の見方を学ぶ','AI壁打ちで候補整理を体験',
                 '出品ルールの確認','初回仕入れオーダー','初回出品');


-- #####################################################################


-- #####################################################################
-- ## 011_evidences.sql
-- #####################################################################

-- =====================================================================
-- Carbey Portal — オンボーディング再設計 フェーズ①: エビデンス管理
-- =====================================================================
-- クライアント要件（レビュー ⑨⑩）:
--   - 本人確認：顔写真付き身分証（免許/マイナンバー/パスポート）を提出・義務化
--   - 古物商許可証：取得猶予6ヶ月以内でデータ格納。未取得でもスタート可
--   - 本部が顧客ごとにエビデンスを管理（承認/却下）
--   - 加盟店はドラッグ&ドロップでアップロード、スマホでもDL可能
--
-- ファイル本体は private バケット member-evidences に保存し、
-- 表示/DLはサーバープロキシ（署名URLを露出しない）で行う。
-- 冪等化のため if exists / on conflict を併用。
-- =====================================================================

create table if not exists portal.evidences (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references portal.members(id) on delete cascade,
  -- 種別
  kind        text not null check (kind in ('identity', 'antique_license', 'other')),
  -- 身分証の種類（本人確認のとき。顔写真付きに限定）
  doc_type    text check (doc_type in ('license', 'mynumber', 'passport', 'antique', 'other')),
  -- ファイル
  storage_path text not null,
  file_name   text not null,
  file_type   text,
  file_size   int,
  -- 審査
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  note        text,          -- 本部メモ・却下理由
  created_at  timestamptz not null default now()
);

create index if not exists idx_evidences_member on portal.evidences(member_id);
create index if not exists idx_evidences_kind   on portal.evidences(member_id, kind);

-- ---------------------------------------------------------------------
-- Storage: private バケット member-evidences
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('member-evidences', 'member-evidences', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table portal.evidences enable row level security;

-- 閲覧: 本部スタッフは全件、加盟店は自分の分のみ
drop policy if exists portal_evidences_read on portal.evidences;
create policy portal_evidences_read on portal.evidences
  for select using (
    portal.is_staff(auth.uid())
    or member_id = portal.current_member_id(auth.uid())
  );

-- 追加（アップロード）: 加盟店は自分の member_id でのみ
drop policy if exists portal_evidences_member_insert on portal.evidences;
create policy portal_evidences_member_insert on portal.evidences
  for insert with check (
    member_id = portal.current_member_id(auth.uid())
  );

-- 削除: 加盟店は自分の pending のみ削除可（再提出のため）／本部は全件
drop policy if exists portal_evidences_delete on portal.evidences;
create policy portal_evidences_delete on portal.evidences
  for delete using (
    portal.is_staff(auth.uid())
    or (member_id = portal.current_member_id(auth.uid()) and status = 'pending')
  );

-- 更新（承認/却下）: 本部のみ
drop policy if exists portal_evidences_admin_update on portal.evidences;
create policy portal_evidences_admin_update on portal.evidences
  for update using (portal.can_crm(auth.uid())) with check (portal.can_crm(auth.uid()));

-- GRANT（新規テーブル）
grant select, insert, delete on portal.evidences to authenticated;
grant update on portal.evidences to authenticated;
grant all on portal.evidences to service_role;

-- Storage の select ポリシー（認証ユーザー・実配信はサーバープロキシ経由）
drop policy if exists member_evidences_read on storage.objects;
create policy member_evidences_read on storage.objects
  for select using (bucket_id = 'member-evidences' and auth.uid() is not null);


-- #####################################################################


-- #####################################################################
-- ## 012_agreements.sql
-- #####################################################################

-- =====================================================================
-- Carbey Portal — オンボーディング再設計 フェーズ②: 利用規約
-- =====================================================================
-- クライアント要件（レビュー ⑫⑬）:
--   - 資金調達の有無に関わらず、利用規約に同意する を押下させて遷移
--   - 加盟店画面：利用規約 確認ページ
--   - 本部画面：利用規約の設定ページ（編集・公開）
--
-- agreements       : 本部が編集・公開する利用規約（バージョン管理）
-- agreement_consents : 加盟店の同意記録
-- 冪等化のため if exists / on conflict を併用。
-- =====================================================================

create table if not exists portal.agreements (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text not null,            -- 規約本文（プレーン/マークダウン）
  version     int not null default 1,
  published   boolean not null default false,
  author_id   uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_agreements_published on portal.agreements(published, created_at desc);

drop trigger if exists trg_agreements_touch on portal.agreements;
create trigger trg_agreements_touch
  before update on portal.agreements
  for each row execute function portal.touch_updated_at();

create table if not exists portal.agreement_consents (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references portal.members(id) on delete cascade,
  agreement_id uuid not null references portal.agreements(id) on delete cascade,
  agreed_at    timestamptz not null default now(),
  unique (member_id, agreement_id)
);

create index if not exists idx_consents_member on portal.agreement_consents(member_id);

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table portal.agreements enable row level security;
alter table portal.agreement_consents enable row level security;

-- 規約: 閲覧はログインユーザー全員（公開分）／編集は本部
drop policy if exists portal_agreements_read on portal.agreements;
create policy portal_agreements_read on portal.agreements
  for select using (auth.uid() is not null);
drop policy if exists portal_agreements_write on portal.agreements;
create policy portal_agreements_write on portal.agreements
  for all using (portal.can_crm(auth.uid())) with check (portal.can_crm(auth.uid()));

-- 同意記録: 本部は全件閲覧／加盟店は自分の分の閲覧・作成
drop policy if exists portal_consents_read on portal.agreement_consents;
create policy portal_consents_read on portal.agreement_consents
  for select using (
    portal.is_staff(auth.uid()) or member_id = portal.current_member_id(auth.uid())
  );
drop policy if exists portal_consents_insert on portal.agreement_consents;
create policy portal_consents_insert on portal.agreement_consents
  for insert with check (member_id = portal.current_member_id(auth.uid()));

-- GRANT
grant select, insert, update, delete on portal.agreements to authenticated;
grant select, insert on portal.agreement_consents to authenticated;
grant all on portal.agreements, portal.agreement_consents to service_role;

-- ---------------------------------------------------------------------
-- 既定の利用規約（初回のみ・空なら投入）
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from portal.agreements) then
    insert into portal.agreements (title, body, version, published) values (
      'カーベイホームディーラー 加盟店利用規約',
      E'第1条（総則）\n本規約は、カーベイホームディーラー加盟店プラットフォーム（以下「本サービス」）の利用条件を定めるものです。\n\n第2条（加盟店の義務）\n加盟店は、本サービスの利用にあたり、法令および本規約を遵守するものとします。\n\n第3条（本人確認・古物商許可）\n加盟店は、本部の求めに応じて本人確認書類を提出し、古物営業に必要な許可を取得するものとします。\n\n第4条（禁止事項）\n加盟店は、本サービスを不正に利用してはなりません。\n\n第5条（免責）\n本部は、本サービスの利用により生じた損害について、法令に定める場合を除き責任を負いません。\n\n（本規約は本部により随時更新されます。最新の内容をご確認ください。）',
      1, true
    );
  end if;
end $$;


-- #####################################################################


-- #####################################################################
-- ## 013_manual.sql
-- #####################################################################

-- =====================================================================
-- Carbey Portal — オンボーディング再設計 フェーズ③: 実践マニュアル（動的）
-- =====================================================================
-- クライアント要件（レビュー ⑭⑮）:
--   - 実践マニュアルはチェックボックス形式。全項目チェックで次へ進める
--   - 項目：中古車市場の基礎/相場の見方/AI壁打ちで候補整理/仕入れ基準/
--           出品ルール/禁止事項・注意事項/理解度チェック/修了
--   - ローンチ前後で本部が内容を埋める。項目はバックエンドで追加でき、
--     コメントや内容も編集できる（動的なマニュアルCMS）
--
-- manual_sections  : 本部が管理する項目（追加/編集/公開/並び替え）
-- manual_progress  : 加盟店のチェック状況
-- 冪等化のため if exists / on conflict を併用。
-- =====================================================================

create table if not exists portal.manual_sections (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,          -- 項目名
  body        text,                    -- 内容（本部がローンチ後に追記）
  note        text,                    -- 本部コメント
  sort_order  int not null default 0,
  published   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_manual_sections_order on portal.manual_sections(sort_order);

drop trigger if exists trg_manual_sections_touch on portal.manual_sections;
create trigger trg_manual_sections_touch
  before update on portal.manual_sections
  for each row execute function portal.touch_updated_at();

create table if not exists portal.manual_progress (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references portal.members(id) on delete cascade,
  section_id  uuid not null references portal.manual_sections(id) on delete cascade,
  checked_at  timestamptz not null default now(),
  unique (member_id, section_id)
);

create index if not exists idx_manual_progress_member on portal.manual_progress(member_id);

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table portal.manual_sections enable row level security;
alter table portal.manual_progress enable row level security;

-- 項目: 閲覧はログインユーザー全員（公開分）／編集は本部
drop policy if exists portal_manual_sections_read on portal.manual_sections;
create policy portal_manual_sections_read on portal.manual_sections
  for select using (auth.uid() is not null);
drop policy if exists portal_manual_sections_write on portal.manual_sections;
create policy portal_manual_sections_write on portal.manual_sections
  for all using (portal.can_crm(auth.uid())) with check (portal.can_crm(auth.uid()));

-- チェック: 本部は全件閲覧／加盟店は自分の分の閲覧・作成・削除（チェック外し）
drop policy if exists portal_manual_progress_read on portal.manual_progress;
create policy portal_manual_progress_read on portal.manual_progress
  for select using (
    portal.is_staff(auth.uid()) or member_id = portal.current_member_id(auth.uid())
  );
drop policy if exists portal_manual_progress_insert on portal.manual_progress;
create policy portal_manual_progress_insert on portal.manual_progress
  for insert with check (member_id = portal.current_member_id(auth.uid()));
drop policy if exists portal_manual_progress_delete on portal.manual_progress;
create policy portal_manual_progress_delete on portal.manual_progress
  for delete using (member_id = portal.current_member_id(auth.uid()));

-- GRANT
grant select, insert, update, delete on portal.manual_sections to authenticated;
grant select, insert, delete on portal.manual_progress to authenticated;
grant all on portal.manual_sections, portal.manual_progress to service_role;

-- ---------------------------------------------------------------------
-- 既定の実践マニュアル項目（初回のみ・空なら投入）
-- 中身（body）は空。ローンチ後に本部が埋める前提。
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from portal.manual_sections) then
    insert into portal.manual_sections (title, sort_order) values
      ('中古車市場の基礎',       10),
      ('相場の見方',             20),
      ('AI壁打ちで候補整理',     30),
      ('仕入れ基準',             40),
      ('出品ルール',             50),
      ('禁止事項・注意事項',     60),
      ('理解度チェック',         70),
      ('修了',                   80);
  end if;
end $$;


-- #####################################################################
-- ## 014_funding.sql
-- #####################################################################
-- Carbey Portal — オンボーディング再設計 フェーズ④: 資金準備（分岐）
-- クライアント要件（レビュー ⑪ / ⑭画像 ②資金準備）:
--   自己資金で始める場合: 自己資金額を登録 → 本部確認 → 完了
--   資金調達を利用する場合:
--     資金調達申請 → ヒアリング → 必要書類提出 → 事業計画書作成 →
--     金融機関へ申請 → 融資審査 → 融資契約 → 着金確認 → 完了
--   自動/手動を分離。手動は最小限。
-- funding_applications: 加盟店ごとに1つ。method で分岐。
--   loan の各ステップは step_status(jsonb) で 'todo'|'done' を保持。

create table if not exists portal.funding_applications (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null unique references portal.members(id) on delete cascade,
  method       text check (method in ('self', 'loan')),   -- 未選択なら null
  self_amount_yen bigint,                                  -- 自己資金の場合
  self_confirmed boolean not null default false,          -- 本部確認（自己資金）
  -- 資金調達（loan）の各ステップ状態。キー=ステップ, 値='todo'|'done'
  step_status  jsonb not null default '{}'::jsonb,
  status       text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_funding_member on portal.funding_applications(member_id);

drop trigger if exists trg_funding_touch on portal.funding_applications;
create trigger trg_funding_touch
  before update on portal.funding_applications
  for each row execute function portal.touch_updated_at();

alter table portal.funding_applications enable row level security;

drop policy if exists portal_funding_read on portal.funding_applications;
create policy portal_funding_read on portal.funding_applications
  for select using (
    portal.is_staff(auth.uid()) or member_id = portal.current_member_id(auth.uid())
  );

-- 加盟店: 自分の分の作成・更新（方法選択・自己資金額・加盟店側ステップ）
drop policy if exists portal_funding_member_insert on portal.funding_applications;
create policy portal_funding_member_insert on portal.funding_applications
  for insert with check (member_id = portal.current_member_id(auth.uid()));
drop policy if exists portal_funding_member_update on portal.funding_applications;
create policy portal_funding_member_update on portal.funding_applications
  for update using (member_id = portal.current_member_id(auth.uid())) with check (member_id = portal.current_member_id(auth.uid()));

-- 本部: 全件更新（承認・本部側ステップ）
drop policy if exists portal_funding_staff_update on portal.funding_applications;
create policy portal_funding_staff_update on portal.funding_applications
  for update using (portal.can_crm(auth.uid())) with check (portal.can_crm(auth.uid()));

grant select, insert, update on portal.funding_applications to authenticated;
grant all on portal.funding_applications to service_role;


-- #####################################################################
-- ## 仕上げ: PostgREST スキーマキャッシュを再読込
-- #####################################################################
notify pgrst, 'reload schema';
