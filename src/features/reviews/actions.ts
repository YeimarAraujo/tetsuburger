"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { site } from "@/config/site";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkStaff } from "@/features/auth/guard";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export interface PublicReview {
  id: string;
  rating: number;
  comment: string | null;
  customer_name: string;
  verified: boolean;
  created_at: string;
}

export interface ProductReviewsResult {
  reviews: PublicReview[];
  avg: number;
  count: number;
  /** Conteo de reseñas por estrellas (1 a 5). */
  distribution: Record<number, number>;
  /** Quedan más reseñas por cargar en la siguiente página. */
  hasMore: boolean;
  error?: string;
}

/** Orden disponible para el listado de reseñas. */
export type ReviewSort = "recent" | "oldest" | "high" | "low";

const DEFAULT_REVIEW_PAGE_SIZE = 20;

/** Máximo de filas usadas para calcular promedio y distribución. */
const MAX_SUMMARY_ROWS = 1000;

const REVIEW_SORTS: Record<
  ReviewSort,
  { column: "created_at" | "rating"; ascending: boolean }[]
> = {
  recent: [{ column: "created_at", ascending: false }],
  oldest: [{ column: "created_at", ascending: true }],
  high: [
    { column: "rating", ascending: false },
    { column: "created_at", ascending: false },
  ],
  low: [
    { column: "rating", ascending: true },
    { column: "created_at", ascending: false },
  ],
};

function emptyReviewsResult(): ProductReviewsResult {
  return {
    reviews: [],
    avg: 0,
    count: 0,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    hasMore: false,
  };
}

export interface SubmitReviewResult {
  error?: string;
  pending?: boolean;
}

export interface ReviewActionResult {
  error?: string;
}

const submitSchema = z.object({
  productId: z.string().uuid("Producto no válido"),
  rating: z.number().int().min(1, "Elige de 1 a 5 estrellas").max(5),
  comment: z.string().trim().max(1000, "El comentario es muy largo").default(""),
  customerName: z.string().trim().min(2, "Ingresa tu nombre").max(80),
  token: z.string().trim().default(""),
  acceptedTerms: z.boolean().refine((value) => value === true, {
    message: "Debes aceptar los términos y la política de privacidad",
  }),
  /** Honeypot: si un bot lo llena, se descarta sin insertar nada. */
  website: z.string().max(500).default(""),
});

/**
 * Envía una reseña pública. Nace PENDIENTE (moderación previa del staff).
 * Con token de pedido válido se marca como compra verificada (order_id).
 */
export async function submitProductReview(raw: unknown): Promise<SubmitReviewResult> {
  const parsed = submitSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const input = parsed.data;

  if (input.website) return { pending: true };

  // Rate limit: 15 reseñas / 10 min por IP.
  const hdrs = await headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    hdrs.get("x-real-ip") ??
    "anonymous";
  const { allowed } = await rateLimit(`review:${ip}`, RATE_LIMITS.review);
  if (!allowed) {
    return { error: "Has enviado muchas reseñas recientemente. Intenta en unos minutos." };
  }

  // Pedido verificado (opcional): el token acredita la compra.
  let orderId: string | null = null;
  if (input.token) {
    if (!z.string().uuid().safeParse(input.token).success) {
      return { error: "El enlace del pedido no es válido." };
    }
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_order_confirmation", {
      p_token: input.token,
    });
    if (error || !data || typeof data !== "object" || !(data as Record<string, unknown>).id) {
      return { error: "El enlace del pedido no es válido." };
    }
    orderId = String((data as Record<string, unknown>).id);
  }

  if (orderId) {
    const anon = await createClient();
    const { data: existing } = await anon
      .from("product_reviews")
      .select("id")
      .eq("order_id", orderId)
      .eq("product_id", input.productId)
      .maybeSingle();
    if (existing) {
      return { error: "Ya calificaste este producto de este pedido." };
    }
  }

  const admin = createAdminClient();
  const { error } = await admin.from("product_reviews").insert({
    product_id: input.productId,
    rating: input.rating,
    comment: input.comment,
    customer_name: input.customerName,
    order_id: orderId,
    status: "PENDIENTE",
    accepted_terms_at: new Date().toISOString(),
    policy_version: site.legal.policyVersion,
  });

  if (error) {
    console.error("submitProductReview insert error", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    if (error.code === "23505") {
      return { error: "Ya calificaste este producto de este pedido." };
    }
    if (error.code === "23503") {
      return { error: "Producto no válido." };
    }
    return { error: "No se pudo enviar la reseña. Intenta de nuevo." };
  }

  return { pending: true };
}

/**
 * Reseñas aprobadas de un producto (público).
 * Soporta filtro por estrellas, orden y paginación para productos con
 * muchas reseñas. El resumen (promedio, total y distribución) siempre se
 * calcula sobre todas las reseñas aprobadas del producto, no sobre el
 * subconjunto filtrado.
 */
export async function getProductReviews(
  productId: string,
  opts: {
    rating?: number | null;
    sort?: ReviewSort;
    limit?: number;
    offset?: number;
  } = {}
): Promise<ProductReviewsResult> {
  const empty = emptyReviewsResult();
  if (!z.string().uuid().safeParse(productId).success) {
    return { ...empty, error: "Producto no válido" };
  }

  const {
    rating = null,
    sort = "recent",
    limit = DEFAULT_REVIEW_PAGE_SIZE,
    offset = 0,
  } = opts;

  const supabase = await createClient();

  // Resumen global (promedio, total exacto y distribución por estrellas).
  const summaryQuery = supabase
    .from("product_reviews")
    .select("rating", { count: "exact" })
    .eq("product_id", productId)
    .eq("status", "APROBADO")
    .limit(MAX_SUMMARY_ROWS);

  // Listado filtrado y ordenado (paginado).
  let listQuery = supabase
    .from("product_reviews")
    .select("id, rating, comment, customer_name, order_id, created_at", {
      count: "exact",
    })
    .eq("product_id", productId)
    .eq("status", "APROBADO");

  if (rating !== null && rating >= 1 && rating <= 5) {
    listQuery = listQuery.eq("rating", rating);
  }
  for (const order of REVIEW_SORTS[sort] ?? REVIEW_SORTS.recent) {
    listQuery = listQuery.order(order.column, { ascending: order.ascending });
  }
  listQuery = listQuery.range(offset, offset + limit - 1);

  const [summary, list] = await Promise.all([summaryQuery, listQuery]);

  if (summary.error || list.error) {
    return { ...empty, error: "No se pudieron cargar las reseñas" };
  }

  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  for (const row of summary.data ?? []) {
    const value = Number(row.rating) || 0;
    if (value < 1 || value > 5) continue;
    distribution[value] += 1;
    sum += value;
  }
  const sampled = Object.values(distribution).reduce((s, n) => s + n, 0);
  const count = summary.count ?? sampled;
  const avg = sampled > 0 ? sum / sampled : 0;

  const reviews: PublicReview[] = (list.data ?? []).map((r) => ({
    id: r.id,
    rating: Number(r.rating),
    comment: r.comment ?? null,
    customer_name: r.customer_name,
    verified: Boolean(r.order_id),
    created_at: r.created_at,
  }));

  const total = list.count ?? reviews.length;
  return {
    reviews,
    avg,
    count,
    distribution,
    hasMore: offset + reviews.length < total,
  };
}

async function assertStaff(): Promise<ReviewActionResult | null> {
  const check = await checkStaff();
  if (!check.ok) return { error: check.error };
  return null;
}

const statusSchema = z.enum(["PENDIENTE", "APROBADO", "RECHAZADO"]);
const idSchema = z.string().uuid();

/** Aprueba, rechaza o devuelve una reseña a revisión (staff). */
export async function setReviewStatus(
  reviewId: string,
  status: "PENDIENTE" | "APROBADO" | "RECHAZADO"
): Promise<ReviewActionResult> {
  const authError = await assertStaff();
  if (authError) return authError;

  const parsedId = idSchema.safeParse(reviewId);
  const parsedStatus = statusSchema.safeParse(status);
  if (!parsedId.success || !parsedStatus.success) {
    return { error: "Datos no válidos" };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("product_reviews")
    .update({ status: parsedStatus.data })
    .eq("id", parsedId.data);

  if (error) return { error: "No se pudo actualizar la reseña" };

  revalidatePath("/admin/resenas");
  revalidatePath("/");
  return {};
}

/** Elimina una reseña (staff). */
export async function deleteReview(reviewId: string): Promise<ReviewActionResult> {
  const authError = await assertStaff();
  if (authError) return authError;

  const parsedId = idSchema.safeParse(reviewId);
  if (!parsedId.success) return { error: "Datos no válidos" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("product_reviews")
    .delete()
    .eq("id", parsedId.data);

  if (error) return { error: "No se pudo eliminar la reseña" };

  revalidatePath("/admin/resenas");
  revalidatePath("/");
  return {};
}
