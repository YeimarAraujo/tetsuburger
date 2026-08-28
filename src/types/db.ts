// Tipos alineados con supabase/migrations/0001_initial_schema.sql

export type OrderStatus =
  | "PENDIENTE"
  | "CONFIRMADO"
  | "EN_PREPARACION"
  | "LISTO"
  | "EN_CAMINO"
  | "ENTREGADO"
  | "CANCELADO";

export type OrderOrigin = "WEB" | "MANUAL";
export type DeliveryType = "DOMICILIO" | "RECOGIDA" | "LOCAL";
export type MovementType = "ENTRADA" | "SALIDA" | "AJUSTE" | "PRODUCCION";
export type PaymentMethod = "EFECTIVO" | "TRANSFERENCIA";

export interface Role {
  id: number;
  name: string;
}

export interface Profile {
  id: string;
  role_id: number;
  full_name: string;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  image_url: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  cost: number;
  image_url: string;
  is_active: boolean;
  is_available: boolean;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

export interface Addon {
  id: string;
  name: string;
  price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductAddon {
  product_id: string;
  addon_id: string;
  display_order: number;
}

export interface Order {
  id: string;
  order_number: number;
  origin: OrderOrigin;
  status: OrderStatus;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  delivery_type: DeliveryType;
  payment_method: PaymentMethod;
  delivery_fee: number;
  subtotal: number;
  total: number;
  notes: string;
  created_by: string | null;
  confirmed_at: string | null;
  ready_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  unit_price: number;
  quantity: number;
  notes: string;
  line_total: number;
}

export interface OrderItemAddon {
  id: string;
  order_item_id: string;
  addon_id: string | null;
  addon_name: string;
  addon_price: number;
  quantity: number;
}

export interface OrderStatusHistory {
  id: string;
  order_id: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  changed_by: string | null;
  created_at: string;
}

export interface ExpenseCategory {
  id: number;
  name: string;
  is_active: boolean;
}

export interface Expense {
  id: string;
  expense_date: string;
  expense_category_id: number;
  concept: string;
  amount: number;
  description: string;
  created_by: string | null;
  created_at: string;
}

export interface DailyClosing {
  id: string;
  closing_date: string;
  orders_count: number;
  sales_total: number;
  expenses_total: number;
  estimated_profit: number;
  details: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductConsumption {
  id: string;
  product_id: string;
  inventory_item_id: string;
  quantity: number;
  created_at: string;
}

export interface OrderConsumptionLog {
  id: string;
  order_id: string;
  inventory_item_id: string;
  quantity: number;
  product_reference: string;
  created_by: string | null;
  created_at: string;
}

export interface AddonConsumption {
  id: string;
  addon_id: string;
  inventory_item_id: string;
  quantity: number;
  created_at: string;
}

export interface OrderConsumptionOverride {
  id: string;
  order_id: string;
  inventory_item_id: string;
  quantity: number;
  created_at: string;
}

export interface InventoryMovement {
  id: string;
  inventory_item_id: string;
  movement_type: MovementType;
  quantity: number;
  reference: string;
  created_by: string | null;
  created_at: string;
}

export interface ProductionRecord {
  id: string;
  record_date: string;
  inventory_item_id: string | null;
  description: string;
  quantity: number;
  unit: string;
  notes: string;
  created_by: string | null;
  created_at: string;
}

/** day_of_week: 0 = Domingo … 6 = Sábado */
export interface BusinessHour {
  day_of_week: number;
  opens_at: string;
  closes_at: string;
  is_active: boolean;
}

export interface SpecialClosure {
  id: string;
  date: string;
  reason: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface Setting {
  key: string;
  value: unknown;
  is_public: boolean;
  updated_by: string | null;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  table_name: string;
  record_id: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
}
