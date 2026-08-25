"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { saveSettings } from "@/features/settings/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

interface TextDef {
  key: string;
  label: string;
  placeholder?: string;
  hint?: string;
}

const TEXT_FIELDS: TextDef[] = [
  {
    key: "whatsapp_number",
    label: "Número de WhatsApp",
    placeholder: "573044243650",
    hint: "Con indicativo de país, solo números. Aquí llegan los pedidos.",
  },
  { key: "banner_text", label: "Frase del banner principal", placeholder: "Hamburguesas artesanales a la parrilla" },
  { key: "hero_image", label: "Imagen del banner (URL)", placeholder: "https://…" },
  { key: "closed_message", label: "Mensaje cuando el negocio está cerrado temporalmente" },
  { key: "address", label: "Dirección del local" },
  { key: "instagram_url", label: "Instagram (URL)" },
  { key: "facebook_url", label: "Facebook (URL)" },
];

const NUMBER_FIELDS: TextDef[] = [
  { key: "delivery_fee", label: "Costo de domicilio (COP)" },
  { key: "min_order_total", label: "Pedido mínimo (COP)", hint: "0 = sin mínimo" },
];

export function SettingsForm({
  initialValues,
}: {
  initialValues: Record<string, unknown>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);

  const str = (key: string) =>
    typeof initialValues[key] === "string" ? (initialValues[key] as string) : "";
  const num = (key: string) => String(initialValues[key] ?? 0);
  const bool = (key: string) => initialValues[key] === true;

  const [texts, setTexts] = useState<Record<string, string>>(() =>
    Object.fromEntries([...TEXT_FIELDS, ...NUMBER_FIELDS].map((f) => [f.key, f.key.includes("fee") || f.key.includes("total") ? num(f.key) : str(f.key)]))
  );
  const [flags, setFlags] = useState({
    store_temporarily_closed: bool("store_temporarily_closed"),
    allow_orders_outside_hours: bool("allow_orders_outside_hours"),
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const result = await saveSettings({ texts, flags });

    setSaving(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Configuración guardada");
    startTransition(() => router.refresh());
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Cierre temporal — prioridad visual */}
      <Card className={flags.store_temporarily_closed ? "border-red-300 bg-red-50/50" : ""}>
        <CardContent className="flex items-center justify-between gap-4 py-4">
          <div className="flex items-start gap-3">
            <TriangleAlert
              className={`mt-0.5 size-5 ${flags.store_temporarily_closed ? "text-red-500" : "text-muted-foreground"}`}
            />
            <div>
              <p className="font-semibold">Cerrar negocio temporalmente</p>
              <p className="text-sm text-muted-foreground">
                El catálogo mostrará CERRADO y no se podrá pedir hasta que lo
                reactives. Ideal para emergencias o vacaciones.
              </p>
            </div>
          </div>
          <Switch
            checked={flags.store_temporarily_closed}
            onCheckedChange={(checked) =>
              setFlags({ ...flags, store_temporarily_closed: checked })
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pedidos y WhatsApp</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {NUMBER_FIELDS.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={field.key}>{field.label}</Label>
                <Input
                  id={field.key}
                  type="number"
                  min={0}
                  step={100}
                  value={texts[field.key] ?? ""}
                  onChange={(e) => setTexts({ ...texts, [field.key]: e.target.value })}
                />
                {field.hint ? (
                  <p className="text-xs text-muted-foreground">{field.hint}</p>
                ) : null}
              </div>
            ))}
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div>
              <Label htmlFor="allow_out">Permitir pedidos fuera del horario</Label>
              <p className="text-sm text-muted-foreground">
                Útil si quieres recibir pedidos anticipados incluso cerrado.
              </p>
            </div>
            <Switch
              id="allow_out"
              checked={flags.allow_orders_outside_hours}
              onCheckedChange={(checked) =>
                setFlags({ ...flags, allow_orders_outside_hours: checked })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="whatsapp_number">Número de WhatsApp *</Label>
            <Input
              id="whatsapp_number"
              value={texts.whatsapp_number ?? ""}
              onChange={(e) => setTexts({ ...texts, whatsapp_number: e.target.value })}
              placeholder="573044243650"
            />
            <p className="text-xs text-muted-foreground">
              Con indicativo de país, solo números.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Apariencia e información</CardTitle>
          <CardDescription>Lo que ve el cliente en el catálogo</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {TEXT_FIELDS.filter((f) => f.key !== "whatsapp_number").map((field) => (
            <div key={field.key} className="space-y-2">
              <Label htmlFor={field.key}>{field.label}</Label>
              <Input
                id={field.key}
                value={texts[field.key] ?? ""}
                onChange={(e) => setTexts({ ...texts, [field.key]: e.target.value })}
                placeholder={field.placeholder}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving || isPending}>
          {saving || isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Guardando…
            </>
          ) : (
            <>
              <Save className="size-4" />
              Guardar configuración
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
