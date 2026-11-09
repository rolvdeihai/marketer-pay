-- supabase/migrations/20261109_bonus_per_outcome_and_archive.sql
-- Run once in the Supabase SQL editor on an existing database.
-- (schema.sql already contains these changes for fresh installs.)

begin;

-- 1) Separate bonus settings for "target met" and "target missed".
--    The old single bonus becomes the "met" bonus, and is copied to "missed"
--    so every business keeps paying exactly what it paid before.
alter table pay_rules rename column bonus_type      to met_bonus_type;
alter table pay_rules rename column sales_per_bonus to met_sales_per_bonus;
alter table pay_rules rename column bonus_amount    to met_bonus_amount;

alter table pay_rules
  add column missed_bonus_type      bonus_type not null default 'PER_SALE',
  add column missed_sales_per_bonus int    not null default 1 check (missed_sales_per_bonus >= 1),
  add column missed_bonus_amount    bigint not null default 0 check (missed_bonus_amount >= 0);

update pay_rules set
  missed_bonus_type      = met_bonus_type,
  missed_sales_per_bonus = met_sales_per_bonus,
  missed_bonus_amount    = met_bonus_amount;

-- 2) Archiving. Rows that have sales/payouts can't be deleted (history), so
--    they are hidden with active = false instead.
alter table businesses add column active boolean not null default true;
alter table products   add column active boolean not null default true;

-- Names only need to be unique among ACTIVE rows, so an archived
-- "JetNote" doesn't block creating a new "JetNote".
alter table businesses drop constraint businesses_name_key;
alter table businesses drop constraint businesses_slug_key;
create unique index businesses_name_active_key on businesses (name) where active;
create unique index businesses_slug_active_key on businesses (slug) where active;

alter table products drop constraint products_business_id_name_key;
create unique index products_business_name_active_key on products (business_id, name) where active;

commit;
