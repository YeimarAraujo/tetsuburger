ALTER TABLE public.production_records
  ADD COLUMN unit_cost  numeric(12,2) not null default 0,
  ADD COLUMN total_cost numeric(12,2) not null default 0;
