"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setPqrStatus } from "@/features/legal/actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export interface PqrRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  type: string;
  message: string;
  status: "NUEVO" | "EN_PROCESO" | "CERRADO";
  policy_version: string | null;
  created_at: string;
}

const TYPE_LABEL: Record<string, string> = {
  PEDIDO: "Pedido o entrega",
  PRODUCTO: "Producto o calidad",
  PRIVACIDAD: "Datos personales",
  OTRO: "Otro",
};

const STATUS_LABEL: Record<PqrRow["status"], string> = {
  NUEVO: "Nuevo",
  EN_PROCESO: "En proceso",
  CERRADO: "Cerrado",
};

export function PqrManager({ requests }: { requests: PqrRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function update(id: string, status: PqrRow["status"]) {
    startTransition(async () => {
      const result = await setPqrStatus(id, status);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Estado actualizado");
      router.refresh();
    });
  }

  if (requests.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
        No hay solicitudes PQR registradas.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((item) => (
        <Card key={item.id}>
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
            <div className="min-w-0 space-y-1">
              <p className="font-semibold">
                {item.name}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  · {TYPE_LABEL[item.type] ?? item.type}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(item.created_at).toLocaleString("es-CO", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            </div>
            <Badge variant={item.status === "CERRADO" ? "secondary" : "outline"}>
              {STATUS_LABEL[item.status]}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="whitespace-pre-wrap text-sm">{item.message}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <a href={`mailto:${item.email}`} className="underline underline-offset-2">
                {item.email}
              </a>
              {item.phone ? <span>{item.phone}</span> : null}
              {item.policy_version ? <span>Política {item.policy_version}</span> : null}
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor={`pqr-status-${item.id}`} className="text-xs font-medium">
                Estado
              </label>
              <select
                id={`pqr-status-${item.id}`}
                value={item.status}
                disabled={isPending}
                onChange={(e) => update(item.id, e.target.value as PqrRow["status"])}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="NUEVO">Nuevo</option>
                <option value="EN_PROCESO">En proceso</option>
                <option value="CERRADO">Cerrado</option>
              </select>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
