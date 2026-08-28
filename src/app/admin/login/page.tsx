import { LoginForm } from "@/components/admin/login-form";

export const metadata = {
  title: "Iniciar sesión · TETSUBURGER Admin",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm space-y-2">
        <div className="text-center">
          {/* <img
            src="/images/logo.webp"
            alt="Logo"
            className="mx-auto h-auto w-1/2 object-contain"
          /> */}

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
