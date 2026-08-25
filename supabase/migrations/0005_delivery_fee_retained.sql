-- Agrega flag para saber si el domicilio es retenido por la empresa
-- Si el domicilio lo cobra un repartidor externo, delivery_fee_retained = false
-- y no se cuenta como ingreso en Finanzas/Reportes
ALTER TABLE orders ADD COLUMN delivery_fee_retained BOOLEAN DEFAULT true;
