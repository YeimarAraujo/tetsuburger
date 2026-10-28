import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/public/header";
import { SiteFooter } from "@/components/public/site-footer";
import { ResumenContent } from "@/components/public/resumen-content";

export const metadata: Metadata = {
  title: "Resumen del pedido",
  robots: { index: false, follow: false },
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
  const deliveryFeeAconvenir = settings.delivery_fee_a_convenir === true;

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <Header />
      <div className="flex-1">
        <ResumenContent deliveryFee={deliveryFee} deliveryFeeAconvenir={deliveryFeeAconvenir} />
      </div>
      <SiteFooter />
    </div>
  );
}
