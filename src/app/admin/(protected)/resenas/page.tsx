import { createClient } from "@/lib/supabase/server";
import { ReviewsManager, type AdminReview } from "@/components/admin/reviews-manager";
import { PageHeader } from "@/components/admin/page-header";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Reseñas · TETSU BURGER Admin",
};

export default async function ReviewsPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("product_reviews")
    .select(
      "id, product_id, rating, comment, customer_name, order_id, status, created_at, product:products(name)"
    )
    .order("created_at", { ascending: false })
    .limit(500);

  const reviews: AdminReview[] = ((data ?? []) as unknown as {
    id: string;
    product_id: string;
    rating: number | string;
    comment: string | null;
    customer_name: string;
    order_id: string | null;
    status: AdminReview["status"];
    created_at: string;
    product?: { name: string } | null;
  }[]).map((r) => ({
    id: r.id,
    productId: r.product_id,
    productName: r.product?.name ?? "(producto eliminado)",
    rating: Number(r.rating),
    comment: r.comment,
    customerName: r.customer_name,
    orderId: r.order_id,
    status: r.status,
    createdAt: r.created_at,
  }));

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 lg:p-6">
      <PageHeader
        title="Reseñas"
        description="Estrellas y comentarios de los productos · moderación previa"
      />
      <ReviewsManager reviews={reviews} />
    </div>
  );
}
