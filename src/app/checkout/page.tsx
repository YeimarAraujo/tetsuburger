import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/public/header";
import { CheckoutForm } from "@/components/public/checkout-form";

export const metadata: Metadata = {
  title: "Finalizar pedido · TETSUBURGER",
};

export default async function CheckoutPage() {
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
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="mb-1 text-2xl font-bold">Finalizar pedido</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Solo necesitamos tus datos de entrega
        </p>
        <CheckoutForm deliveryFee={deliveryFee} />
      </main>
    </div>
  );
}
