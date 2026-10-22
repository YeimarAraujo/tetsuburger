"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { site } from "@/config/site";
import { submitPqr } from "@/features/legal/actions";
import { PQR_TYPES } from "@/features/legal/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function PqrForm() {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [type, setType] = useState<string>(PQR_TYPES[0].value);
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending) return;

    const formData = new FormData(e.currentTarget);
    if (String(formData.get("website") ?? "")) return;

    setSending(true);
    try {
      const result = await submitPqr({
        name: String(formData.get("name") ?? ""),
        email: String(formData.get("email") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        type,
        message,
        consent,
        website,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      setSent(true);
    } catch {
      toast.error("No se pudo enviar la solicitud. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-3 rounded-xl border bg-card p-6 text-center">
        <CheckCircle2 className="mx-auto size-10 text-emerald-600" />
        <h2 className="text-lg font-bold">Solicitud enviada</h2>
        <p className="text-sm text-muted-foreground">
          Recibimos tu mensaje. Te responderemos a más tardar en los plazos
          legales (10 días hábiles para consultas y 15 para reclamos).
        </p>
        <Button variant="outline" onClick={() => setSent(false)}>
          Enviar otra solicitud
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border bg-card p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="pqr-name">Nombre *</Label>
          <Input id="pqr-name" name="name" required maxLength={80} autoComplete="name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pqr-email">Correo *</Label>
          <Input
            id="pqr-email"
            name="email"
            type="email"
            required
            maxLength={120}
            autoComplete="email"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="pqr-phone">Teléfono (opcional)</Label>
          <Input
            id="pqr-phone"
            name="phone"
            type="tel"
            maxLength={20}
            autoComplete="tel"
            placeholder="300 000 0000"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pqr-type">Tipo de solicitud *</Label>
          <select
            id="pqr-type"
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {PQR_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <Label htmlFor="pqr-message">Mensaje *</Label>
          <span className="text-xs tabular-nums text-muted-foreground">
            {message.length}/2000
          </span>
        </div>
        <Textarea
          id="pqr-message"
          name="message"
          rows={6}
          required
          maxLength={2000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Cuéntanos qué pasó, con número de pedido si aplica."
        />
      </div>

      <input
        type="text"
        name="website"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          required
          className="mt-0.5 size-4 shrink-0 rounded border-input"
        />
        <span className="text-muted-foreground">
          Autorizo el tratamiento de mis datos para atender esta solicitud, según
          la{" "}
          <Link href="/privacidad" className="font-medium text-foreground underline underline-offset-2">
            política de tratamiento de datos
          </Link>
          .
        </span>
      </label>

      <Button type="submit" size="lg" className="w-full" disabled={sending || !consent}>
        {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        {sending ? "Enviando…" : "Enviar solicitud"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        También puedes escribir a{" "}
        <a href={`mailto:${site.pqrEmail}`} className="underline underline-offset-2">
          {site.pqrEmail}
        </a>{" "}
        o por WhatsApp al {site.phone}.
      </p>
    </form>
  );
}
