import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "@/components/admin/settings/settings-form";

export const metadata = {
  title: "Configuración · TETSUBURGER Admin",
};

export default async function SettingsPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("settings")
    .select("key, value");

  const values = Object.fromEntries(
    (data ?? []).map((r) => [r.key, r.value])
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">Configuración</h1>
        <p className="text-sm text-muted-foreground">
          Parámetros del negocio — se aplican al instante en el catálogo
        </p>
      </header>

      <SettingsForm initialValues={values} />
    </div>
  );
}
