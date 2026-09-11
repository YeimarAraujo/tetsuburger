import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "@/components/admin/settings/settings-form";
import { PageHeader } from "@/components/admin/page-header";

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
    <div className="mx-auto max-w-3xl space-y-6 p-4 lg:p-6">
      <PageHeader
        title="Configuración"
        description="Parámetros del negocio · se aplican al instante en el catálogo"
      />

      <SettingsForm initialValues={values} />
    </div>
  );
}
