import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "@/features/auth/actions";
import { SidebarNav } from "@/components/admin/sidebar-nav";
import { MobileNav } from "@/components/admin/mobile-nav";
import { Button } from "@/components/ui/button";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Defensa en profundidad: el middleware ya protege, esto refuerza.
  if (!user) {
    redirect("/admin/login");
  }

  return (
    <div className="flex min-h-screen bg-muted/40">
      {/* Sidebar escritorio */}
      <aside className="sticky top-0 hidden h-screen w-60 flex-col border-r bg-background md:flex">
        <div className="flex h-16 items-center border-b px-6">
          <img src="/images/logo.webp" alt="Logo" className="w-1/2 h-1/2 object-cover" />
          <span className="ml-2 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
            Admin
          </span>
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <SidebarNav />
        </div>
        <div className="border-t p-3">
          <form action={signOutAction}>
            <Button
              variant="ghost"
              className="w-full justify-start text-muted-foreground"
              type="submit"
            >
              <LogOut className="size-4" />
              Cerrar sesión
            </Button>
          </form>
        </div>
      </aside>

      {/* Barra móvil */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b bg-background px-4 md:hidden">
        <div className="flex items-center gap-2">
          <MobileNav />
          <img src="/images/logo.webp" alt="Logo" className="w-1/2 h-1/2 object-cover" />
        </div>
        <form action={signOutAction}>
          <Button variant="ghost" size="icon" type="submit" aria-label="Cerrar sesión">
            <LogOut className="size-4" />
          </Button>
        </form>
      </div>

      <main className="flex-1 pt-14 md:pt-0">{children}</main>
    </div>
  );
}
