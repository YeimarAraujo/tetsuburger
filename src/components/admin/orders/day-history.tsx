import { CalendarDays, Search } from "lucide-react";
import {
  OrderDayList,
  OrderDaySummary,
  type DayOrder,
} from "@/components/admin/order-day";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate } from "@/lib/format";

export function DayHistory({
  orders,
  selectedDate,
  today,
}: {
  orders: DayOrder[];
  selectedDate: string;
  today: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="size-4" />
          Historial por día
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form method="get" className="flex flex-wrap items-end gap-2">
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            Fecha
            <input
              type="date"
              name="fecha"
              defaultValue={selectedDate}
              max={today}
              className="block h-9 rounded-md border bg-background px-2 text-sm text-foreground"
            />
          </label>
          <Button type="submit" variant="secondary" size="sm">
            <Search className="size-3.5" />
            Ver historial
          </Button>
          {selectedDate !== today ? (
            <a
              href="/admin/pedidos"
              className="pb-1.5 text-xs font-medium text-primary hover:underline"
            >
              Volver a hoy
            </a>
          ) : null}
        </form>

        <p className="text-sm text-muted-foreground">
          {formatDate(`${selectedDate}T12:00:00Z`)} · todos los estados,
          incluidos entregados y cancelados.
        </p>

        <OrderDaySummary orders={orders} />

        <div className="max-h-[60vh] overflow-y-auto pr-1">
          <OrderDayList orders={orders} />
        </div>
      </CardContent>
    </Card>
  );
}
