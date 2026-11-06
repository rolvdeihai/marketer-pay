-- supabase/schema.sql
-- Run once in the Supabase SQL editor.

create extension if not exists vector;   -- pgvector, for AI embeddings

-- ---------- Enums ----------
create type bonus_type as enum ('PER_SALE', 'PER_X_SALES');

-- ---------- Businesses & pay rules ----------
create table businesses (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  slug        text not null unique,
  created_at  timestamptz not null default now()
);

-- One rule per business (1:1). Money is stored in whole rupiah as BIGINT.
create table pay_rules (
  business_id              uuid primary key references businesses(id) on delete cascade,
  base_salary              bigint not null default 0 check (base_salary >= 0),
  bonus_type               bonus_type not null default 'PER_SALE',
  sales_per_bonus          int    not null default 1 check (sales_per_bonus >= 1),
  bonus_amount             bigint not null default 0 check (bonus_amount >= 0),
  bonus_pct_target_met     int    not null default 100 check (bonus_pct_target_met between 0 and 1000),
  bonus_pct_target_missed  int    not null default 100 check (bonus_pct_target_missed between 0 and 1000),
  updated_at               timestamptz not null default now()
);

-- ---------- Marketers ----------
create table marketers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Many-to-many: a marketer can sell for several businesses.
create table marketer_businesses (
  marketer_id  uuid not null references marketers(id) on delete cascade,
  business_id  uuid not null references businesses(id) on delete cascade,
  primary key (marketer_id, business_id)
);

-- ---------- Products ----------
create table products (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references businesses(id) on delete cascade,
  name         text not null,
  price        bigint not null default 0 check (price >= 0),
  created_at   timestamptz not null default now(),
  unique (business_id, name)
);

-- ---------- Transactions (sales) ----------
create table transactions (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references businesses(id) on delete restrict,
  marketer_id  uuid not null references marketers(id)  on delete restrict,
  product_id   uuid not null references products(id)   on delete restrict,
  amount       bigint not null check (amount >= 0),
  sold_at      timestamptz not null default now(),
  note         text,
  created_at   timestamptz not null default now(),
  embedded_at  timestamptz            -- set by the AI indexer once embedded
);
create index transactions_business_sold_idx on transactions (business_id, sold_at);
create index transactions_marketer_sold_idx on transactions (marketer_id, sold_at);
create index transactions_not_embedded_idx on transactions (sold_at) where embedded_at is null;

-- ---------- Payouts (paid history) ----------
create table payouts (
  id               uuid primary key default gen_random_uuid(),
  marketer_id      uuid not null references marketers(id)  on delete restrict,
  business_id      uuid not null references businesses(id) on delete restrict,
  period           text not null check (period ~ '^\d{4}-\d{2}$'),  -- e.g. 2026-11
  sales_count      int    not null,
  target_achieved  boolean not null,
  base_salary      bigint not null,
  bonus_raw        bigint not null,   -- bonus before the % is applied
  bonus_pct        int    not null,
  bonus_final      bigint not null,
  total            bigint not null,
  rule_snapshot    jsonb  not null,   -- the rule as it was at payment time
  paid_by          text,
  paid_at          timestamptz not null default now(),
  embedded_at      timestamptz,
  unique (marketer_id, business_id, period)   -- can't pay twice for the same month
);

-- ---------- AI documents (RAG) ----------
create table ai_documents (
  id           bigserial primary key,
  source_type  text not null,          -- 'transaction' | 'payout'
  source_id    uuid not null,
  business_id  uuid references businesses(id) on delete cascade,
  content      text not null,
  embedding    vector(768) not null,
  created_at   timestamptz not null default now(),
  unique (source_type, source_id)
);
create index ai_documents_embedding_idx on ai_documents using hnsw (embedding vector_cosine_ops);

-- Vector search used by the AI "search_records" tool.
create or replace function match_ai_documents(
  query_embedding vector(768),
  match_count int default 8,
  filter_business uuid default null
)
returns table (id bigint, source_type text, content text, similarity float)
language sql stable
as $$
  select d.id, d.source_type, d.content, 1 - (d.embedding <=> query_embedding) as similarity
  from ai_documents d
  where filter_business is null or d.business_id = filter_business
  order by d.embedding <=> query_embedding
  limit match_count;
$$;

-- Aggregated monthly sales used by the AI "get_sales_by_month" tool.
create or replace function ai_sales_by_month(filter_business uuid default null, months int default 6)
returns table (month text, business text, marketer text, sales bigint, revenue bigint)
language sql stable
as $$
  select to_char(date_trunc('month', t.sold_at at time zone 'Asia/Jakarta'), 'YYYY-MM') as month,
         b.name, m.name, count(*)::bigint, coalesce(sum(t.amount), 0)::bigint
  from transactions t
  join businesses b on b.id = t.business_id
  join marketers  m on m.id = t.marketer_id
  where (filter_business is null or t.business_id = filter_business)
    and t.sold_at >= (date_trunc('month', now() at time zone 'Asia/Jakarta')
                      - make_interval(months => greatest(months, 1) - 1)) at time zone 'Asia/Jakarta'
  group by 1, 2, 3
  order by 1, 2, 4 desc;
$$;

-- ---------- Security ----------
-- Supabase exposes the public schema through its auto-generated REST API.
-- We don't use that API from the app, so lock every table down:
-- RLS on + no policies = the anon/authenticated roles can read nothing.
-- Our Go backend connects as the table owner and the AI service uses the
-- secret key; both bypass RLS.
alter table businesses          enable row level security;
alter table pay_rules           enable row level security;
alter table marketers           enable row level security;
alter table marketer_businesses enable row level security;
alter table products            enable row level security;
alter table transactions        enable row level security;
alter table payouts             enable row level security;
alter table ai_documents        enable row level security;

revoke execute on function match_ai_documents(vector, int, uuid) from public, anon, authenticated;
revoke execute on function ai_sales_by_month(uuid, int)          from public, anon, authenticated;
grant  execute on function match_ai_documents(vector, int, uuid) to service_role;
grant  execute on function ai_sales_by_month(uuid, int)          to service_role;