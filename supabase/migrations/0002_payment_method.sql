-- TETSUBURGER · Medio de pago en órdenes
create type public.payment_method as enum ('EFECTIVO', 'TRANSFERENCIA');

alter table public.orders
  add column payment_method public.payment_method not null default 'EFECTIVO';
