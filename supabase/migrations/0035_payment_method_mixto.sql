-- ============================================================================
-- TETSUBURGER · 0035 — Medio de pago MIXTO (parte 1 de 2)
-- Agrega el valor MIXTO al enum payment_method (efectivo + transferencia en un
-- mismo pedido). Va en un archivo aparte porque Postgres no permite USAR un
-- valor de enum en la misma transacción donde se agrega: las columnas, el
-- constraint y las funciones que lo usan están en 0036 (ejecutar DESPUÉS).
-- Idempotente: seguro de ejecutar varias veces. Ejecutar en Supabase SQL Editor.
-- ============================================================================

alter type public.payment_method add value if not exists 'MIXTO';
