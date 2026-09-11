-- ============================================================================
-- TETSUBURGER · 0019 — Caja: ventas por transferencia entran al ledger
-- Nueva categoría de movimiento para que los pedidos pagados por transferencia
-- también registren su ingreso en el módulo "Caja y Pagos".
-- Idempotente: seguro de ejecutar varias veces. Ejecutar en Supabase SQL Editor.
-- ============================================================================

alter type public.caja_tipo add value if not exists 'VENTA_TRANSFERENCIA';