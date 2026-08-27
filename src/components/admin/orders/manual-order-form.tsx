"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Banknote, Landmark, Loader2, Plus, Search, Truck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { CartAddon } from "@/store/cart";
import { createManualOrder } from "@/features/orders/manual-actions";
import { formatCOP } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

export interface ManualProduct {
  id: string;
  name: string;
  price: number;
  image_url: string;
  is_available: boolean;
  addons: CartAddon[];
}

interface LineItem {
  key: string;
  product: ManualProduct;
  quantity: number;
  addons: CartAddon[];
}

function lineKey(productId: string, addonIds: string[]) {
  return `${productId}__${[...addonIds].sort().join(",")}`;
}

function lineTotal(line: LineItem): number {
  return (
    (line.product.price + line.addons.reduce((s, a) => s + a.price, 0)) *
    line.quantity
  );
}

export function ManualOrderForm({
  products,
  defaultDeliveryFee,
}: {
  products: ManualProduct[];
  defaultDeliveryFee: number;
}) {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<LineItem[]>([]);

  // Diálogo de item
  const [pickerProduct, setPickerProduct] = useState<ManualProduct | null>(null);
  const [pickerQty, setPickerQty] = useState(1);
  const [pickerAddons, setPickerAddons] = useState<string[]>([]);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryType, setDeliveryType] = useState<"DOMICILIO" | "RECOGIDA" | "LOCAL">("DOMICILIO");
  const [address, setAddress] = useState("");
  const [deliveryFee, setDeliveryFee] = useState(String(defaultDeliveryFee));
  const [chargeDeliveryFee, setChargeDeliveryFee] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<"EFECTIVO" | "TRANSFERENCIA">("EFECTIVO");
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, search]);

  const subtotal = useMemo(
    () => lines.reduce((sum, l) => sum + lineTotal(l), 0),
    [lines]
  );
  const fee = deliveryType === "DOMICILIO" && chargeDeliveryFee ? Number(deliveryFee || 0) : 0;
  const total = subtotal + fee;

  function openPicker(product: ManualProduct) {
    setPickerProduct(product);
    setPickerQty(1);
    setPickerAddons([]);
  }

  function confirmPicker() {
    if (!pickerProduct) return;
    const addons = pickerProduct.addons.filter((a) => pickerAddons.includes(a.id));
    const key = lineKey(pickerProduct.id, pickerAddons);

    setLines((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) {
        return prev.map((l) =>
          l.key === key ? { ...l, quantity: l.quantity + pickerQty } : l
        );
      }
      return [
        ...prev,
        { key, product: pickerProduct, quantity: pickerQty, addons },
      ];
    });

    setPickerProduct(null);
  }

  async function handleSubmit() {
    if (lines.length === 0) {
      toast.error("Agrega al menos un producto");
      return;
    }

    setSaving(true);

    const result = await createManualOrder(
      {
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_address: address,
        delivery_type: deliveryType,
        delivery_fee: fee,
        delivery_fee_retained: chargeDeliveryFee,
        payment_method: paymentMethod,
        notes,
      },
      lines.map((l) => ({
        product_id: l.product.id,
        quantity: l.quantity,
        addon_ids: l.addons.map((a) => a.id),
      }))
    );

    setSaving(false);

    if (result.error || !result.orderNumber) {
      toast.error(result.error ?? "No se pudo registrar el pedido");
      return;
    }

    toast.success(`Pedido manual #${String(result.orderNumber).padStart(5, "0")} registrado`);
    router.push("/admin/pedidos");
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
      {/* Selector de productos */}
      <Card className="order-2 lg:order-1">
        <CardHeader>
          <CardTitle>1 · Productos</CardTitle>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Buscar producto…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardHeader>
        <CardContent className="grid max-h-[560px] gap-2 overflow-y-auto sm:grid-cols-2">
          {filtered.length === 0 ? (
            <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
              Sin resultados.
            </p>
          ) : (
            filtered.map((product) => (
              <button
                key={product.id}
                type="button"
                disabled={!product.is_available}
                onClick={() => openPicker(product)}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-2 text-left transition-colors",
                  product.is_available
                    ? "hover:border-primary hover:bg-muted/50"
                    : "cursor-not-allowed opacity-50"
                )}
              >
                {product.image_url ? (
                  <div className="relative size-10 shrink-0 overflow-hidden rounded-md border">
                    <Image
                      src={product.image_url}
                      alt={product.name}
                      fill
                      sizes="40px"
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="size-10 rounded-md border bg-muted" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{product.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {product.is_available ? formatCOP(product.price) : "Agotado"}
                  </span>
                </span>
                {product.is_available ? <Plus className="size-4 shrink-0 text-primary" /> : null}
              </button>
            ))
          )}
        </CardContent>
      </Card>

      {/* Resumen y datos */}
      <div className="order-1 space-y-4 lg:order-2 lg:sticky lg:top-20 lg:self-start">
        <Card>
          <CardHeader>
            <CardTitle>2 · Pedido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {lines.length === 0 ? (
              <p className="py-6 text-center text-muted-foreground">
                Toca un producto para agregarlo
              </p>
            ) : (
              lines.map((line) => (
                <div key={line.key} className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-semibold">{line.quantity}×</span> {line.product.name}
                    {line.addons.length > 0 ? (
                      <span className="block text-xs text-muted-foreground">
                        + {line.addons.map((a) => a.name).join(", ")}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span>{formatCOP(lineTotal(line))}</span>
                    <button
                      type="button"
                      onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                      className="text-destructive hover:opacity-70"
                      aria-label="Quitar"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}

            <Separator />

            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatCOP(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between gap-2 text-muted-foreground">
              <span>Domicilio</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setChargeDeliveryFee((v) => !v)}
                  className={cn(
                    "flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors",
                    chargeDeliveryFee
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  <Truck className="size-3" />
                  {chargeDeliveryFee ? "Sí cobra" : "No cobra"}
                </button>
                <Input
                  type="number"
                  min={0}
                  step={100}
                  value={deliveryType === "DOMICILIO" && chargeDeliveryFee ? deliveryFee : 0}
                  disabled={deliveryType !== "DOMICILIO" || !chargeDeliveryFee}
                  onChange={(e) => setDeliveryFee(e.target.value)}
                  className="h-7 w-24 text-right"
                />
              </div>
            </div>
            <div className="flex justify-between text-base font-bold">
              <span>Total</span>
              <span className="text-primary">{formatCOP(total)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>3 · Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nombre del cliente" maxLength={80} />
            </div>
            <div className="space-y-1.5">
              <Label>Teléfono</Label>
              <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Opcional" maxLength={30} />
            </div>

            <div className="space-y-1.5">
              <Label>Modalidad</Label>
              <Select value={deliveryType} onValueChange={(v) => setDeliveryType(v as typeof deliveryType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DOMICILIO">Domicilio</SelectItem>
                  <SelectItem value="RECOGIDA">Recoge en local</SelectItem>
                  <SelectItem value="LOCAL">Consumo en local</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {deliveryType === "DOMICILIO" ? (
              <div className="space-y-1.5">
                <Label>Dirección *</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Calle 00 #00-00" maxLength={200} />
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label>Medio de pago *</Label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { value: "EFECTIVO", label: "Efectivo", Icon: Banknote },
                  { value: "TRANSFERENCIA", label: "Transferencia", Icon: Landmark },
                ] as const).map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPaymentMethod(value)}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                      paymentMethod === value
                        ? "border-primary bg-primary/10 text-primary"
                        : "text-muted-foreground hover:border-foreground/30"
                    )}
                  >
                    <Icon className="size-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Nota</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={300} placeholder="Sin cebolla, referencias…" />
            </div>

            <Button size="lg" className="w-full" disabled={saving || lines.length === 0} onClick={handleSubmit}>
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Registrando…
                </>
              ) : (
                `Registrar pedido · ${formatCOP(total)}`
              )}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Aparecerá en Pedidos en vivo como MANUAL (Confirmado)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Diálogo cantidad + adicionales */}
      <Dialog open={Boolean(pickerProduct)} onOpenChange={(o) => !o && setPickerProduct(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{pickerProduct?.name}</DialogTitle>
          </DialogHeader>

          <div className="flex items-center justify-between">
            <span className="font-bold">{formatCOP(pickerProduct?.price ?? 0)}</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="size-8" onClick={() => setPickerQty((q) => Math.max(1, q - 1))}>−</Button>
              <span className="w-8 text-center font-medium">{pickerQty}</span>
              <Button variant="outline" size="icon" className="size-8" onClick={() => setPickerQty((q) => Math.min(50, q + 1))}>+</Button>
            </div>
          </div>

          {pickerProduct && pickerProduct.addons.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Adicionales</p>
              {pickerProduct.addons.map((addon) => {
                const checked = pickerAddons.includes(addon.id);
                return (
                  <label key={addon.id} className="flex cursor-pointer items-center justify-between rounded-lg border p-2.5 text-sm hover:bg-muted/50">
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setPickerAddons((prev) =>
                            checked ? prev.filter((id) => id !== addon.id) : [...prev, addon.id]
                          )
                        }
                        className="size-4 accent-[var(--primary)]"
                      />
                      {addon.name}
                    </span>
                    <span className="text-muted-foreground">+{formatCOP(addon.price)}</span>
                  </label>
                );
              })}
            </div>
          ) : null}

          <Button size="lg" onClick={confirmPicker}>
            Agregar{" "}
            {pickerProduct
              ? `· ${formatCOP(
                  (pickerProduct.price +
                    pickerProduct.addons.filter((a) => pickerAddons.includes(a.id)).reduce((s, a) => s + a.price, 0)) * pickerQty
                )}`
              : ""}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
