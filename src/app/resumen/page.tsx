import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/public/header";
import { ResumenContent } from "@/components/public/resumen-content";

export const metadata: Metadata = {
  title: "Resumen del pedido · TETSUBURGER",
};

export default async function ResumenPage() {
  const supabase = await createClient();
  const { data: settingsRows } = await supabase
    .from("settings")
    .select("key, value")
    .eq("is_public", true);

  const settings = Object.fromEntries(
    (settingsRows ?? []).map((r) => [r.key, r.value])
  ) as Record<string, unknown>;

  const deliveryFee = Number(settings.delivery_fee ?? 0);

  return (
    <div className="min-h-screen bg-muted/40">
      <Header />
      <ResumenContent deliveryFee={deliveryFee} />
    </div>
  );
}
