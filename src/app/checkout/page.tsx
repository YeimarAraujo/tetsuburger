import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/public/header";
import { SiteFooter } from "@/components/public/site-footer";
import { CheckoutForm } from "@/components/public/checkout-form";

export const metadata: Metadata = {
  title: "Finalizar pedido",
  description: "Confirma tus datos de entrega y el medio de pago.",
  robots: { index: false, follow: false },
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
  const deliveryFeeAconvenir = settings.delivery_fee_a_convenir === true;

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <Header />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">

        <CheckoutForm deliveryFee={deliveryFee} deliveryFeeAconvenir={deliveryFeeAconvenir} />
      </main>
      <SiteFooter />
    </div>
  );
}
