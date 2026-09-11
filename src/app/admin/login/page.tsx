import { Logo } from "@/components/ui/logo";
import { LoginForm } from "@/components/admin/login-form";

export const metadata = {
  title: "Iniciar sesión · TETSUBURGER Admin",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <Logo className="mx-auto h-14 w-auto" />
          <h1 className="mt-3 font-display text-2xl tracking-wide uppercase">
            Panel administrativo
          </h1>
        </div>

        <div className="rounded-xl border bg-background p-6 shadow-sm">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}