import { LoginForm } from "@/components/admin/login-form";

export const metadata = {
  title: "Iniciar sesión · TETSUBURGER Admin",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <img src="/images/logo.webp" alt="" className="w-1/2 h-1/2 object-cover" />
          <p className="mt-1 text-sm text-muted-foreground">
            Panel administrativo
          </p>
        </div>

        <div className="rounded-xl border bg-background p-6 shadow-sm">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
