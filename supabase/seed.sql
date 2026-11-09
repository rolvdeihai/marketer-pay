-- supabase/seed.sql
insert into businesses (name, slug) values
  ('InstructJet', 'instructjet'),
  ('OneClick Smart Resume', 'oneclick-smart-resume'),
  ('JetNote', 'jetnote');

-- OneClick: Rp100.000 for every 5 sales, 100% bonus whether target met or not
insert into pay_rules (business_id, base_salary, met_bonus_type, met_sales_per_bonus, met_bonus_amount, bonus_pct_target_met, missed_bonus_type, missed_sales_per_bonus, missed_bonus_amount, bonus_pct_target_missed)
select id, 1500000, 'PER_X_SALES', 5, 100000, 100, 'PER_X_SALES', 5, 100000, 100 from businesses where slug = 'oneclick-smart-resume';

-- JetNote: Rp50.000 per sale, 100% bonus whether target met or not
insert into pay_rules (business_id, base_salary, met_bonus_type, met_sales_per_bonus, met_bonus_amount, bonus_pct_target_met, missed_bonus_type, missed_sales_per_bonus, missed_bonus_amount, bonus_pct_target_missed)
select id, 1000000, 'PER_SALE', 1, 50000, 100, 'PER_SALE', 1, 50000, 100 from businesses where slug = 'jetnote';

-- InstructJet: example of a stricter rule — only 50% of the bonus if the target is missed
insert into pay_rules (business_id, base_salary, met_bonus_type, met_sales_per_bonus, met_bonus_amount, bonus_pct_target_met, missed_bonus_type, missed_sales_per_bonus, missed_bonus_amount, bonus_pct_target_missed)
select id, 2000000, 'PER_SALE', 1, 75000, 100, 'PER_SALE', 1, 75000, 50 from businesses where slug = 'instructjet';

-- Products
insert into products (business_id, name, price)
select b.id, p.name, p.price
from businesses b
join (values
  ('instructjet', 'Starter plan', 299000),
  ('instructjet', 'Team plan', 990000),
  ('oneclick-smart-resume', 'Resume Pro', 149000),
  ('oneclick-smart-resume', 'Resume + Cover Letter', 249000),
  ('jetnote', 'JetNote Monthly', 59000),
  ('jetnote', 'JetNote Yearly', 499000)
) as p(slug, name, price) on p.slug = b.slug;

-- Marketers
insert into marketers (name, phone) values
  ('Andi', '0812-0000-0001'), ('Budi', '0812-0000-0002'),
  ('Citra', '0812-0000-0003'), ('Dewi', '0812-0000-0004');

insert into marketer_businesses (marketer_id, business_id)
select m.id, b.id from marketers m, businesses b
where (m.name = 'Andi'  and b.slug in ('oneclick-smart-resume', 'jetnote'))
   or (m.name = 'Budi'  and b.slug = 'oneclick-smart-resume')
   or (m.name = 'Citra' and b.slug in ('instructjet', 'jetnote'))
   or (m.name = 'Dewi'  and b.slug = 'instructjet');

-- Demo sales spread over the last ~90 days (delete these later if you want a clean start)
insert into transactions (business_id, marketer_id, product_id, amount, sold_at)
select p.business_id, mb.marketer_id, p.id, p.price, now() - (random() * interval '90 days')
from products p
join marketer_businesses mb on mb.business_id = p.business_id
cross join generate_series(1, 1 + (random() * 6)::int);