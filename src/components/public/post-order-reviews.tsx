"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StarPicker } from "@/components/ui/star-rating";
import { submitProductReview } from "@/features/reviews/actions";

interface PostOrderReviewsProps {
  token: string;
  customerName: string;
  items: { productId: string; productName: string }[];
}

/**
 * Invitación en /pedido/confirmado: calificar cada producto del pedido.
 * Con el token de la URL la reseña queda como compra verificada.
 */
export function PostOrderReviews({
  token,
  customerName,
  items,
}: PostOrderReviewsProps) {
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [sentIds, setSentIds] = useState<string[]>([]);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [website, setWebsite] = useState("");
  const [accepted, setAccepted] = useState(false);

  async function send(productId: string) {
    const rating = ratings[productId] ?? 0;
    if (rating < 1) {
      toast.error("Elige de 1 a 5 estrellas");
      return;
    }
    if (!accepted) {
      toast.error("Acepta los términos y la política de privacidad");
      return;
    }
    setSendingId(productId);
    try {
      const res = await submitProductReview({
        productId,
        rating,
        comment: comments[productId] ?? "",
        customerName,
        token,
        acceptedTerms: accepted,
        website,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("¡Gracias por tu opinión!");
      setSentIds((prev) => [...prev, productId]);
    } catch (err) {
      console.error("submitProductReview client error", err);
      toast.error("No se pudo enviar la reseña. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setSendingId(null);
    }
  }

  if (items.length === 0) return null;

  return (
    <section className="w-full space-y-4 rounded-2xl border bg-card p-5 text-left">
      <div>
        <h2 className="text-lg font-bold">¿Qué tal estuvo tu pedido?</h2>
        <p className="text-sm text-muted-foreground">
          Tu opinión nos ayuda a mejorar. Las reseñas se publican tras una breve
          revisión.
        </p>
      </div>

      {/* Honeypot anti-spam */}
      <input
        type="text"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      <label className="flex items-start gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-0.5 size-4 shrink-0 rounded border-input"
        />
        <span>
          Acepto los{" "}
          <Link href="/terminos" className="underline underline-offset-2">
            términos
          </Link>{" "}
          y la{" "}
          <Link href="/privacidad" className="underline underline-offset-2">
            política de privacidad
          </Link>
          .
        </span>
      </label>

      <div className="space-y-4">
        {items.map((item) => {
          const sent = sentIds.includes(item.productId);
          const sending = sendingId === item.productId;
          return (
            <div key={item.productId} className="space-y-2 rounded-xl border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{item.productName}</p>
                {sent ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                    <ShieldCheck className="size-3" />
                    Enviada
                  </span>
                ) : null}
              </div>

              {sent ? (
                <p className="text-xs text-muted-foreground">
                  ¡Gracias! Tu reseña está pendiente de aprobación.
                </p>
              ) : (
                <>
                  <StarPicker
                    size="size-6"
                    value={ratings[item.productId] ?? 0}
                    onChange={(v) =>
                      setRatings((prev) => ({ ...prev, [item.productId]: v }))
                    }
                    disabled={sending}
                  />
                  <Textarea
                    placeholder="Comentario (opcional)"
                    rows={2}
                    maxLength={1000}
                    value={comments[item.productId] ?? ""}
                    onChange={(e) =>
                      setComments((prev) => ({
                        ...prev,
                        [item.productId]: e.target.value,
                      }))
                    }
                    disabled={sending}
                  />
                  <Button
                    size="sm"
                    disabled={sending}
                    onClick={() => send(item.productId)}
                  >
                    {sending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                    Enviar
                  </Button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
