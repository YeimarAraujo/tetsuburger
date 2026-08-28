-- 0010: Limpieza de pedidos de prueba (YEIMAR ARAUJO, order_number 1001-1006).
-- Los hijos de orders borran en cascada, asi que un solo DELETE alcanza.

delete from public.orders
where order_number in (1001, 1002, 1003, 1004, 1005, 1006)
  and customer_name ilike '%YEIMAR ARAUJO%';
