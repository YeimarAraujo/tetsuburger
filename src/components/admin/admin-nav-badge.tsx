import { cn } from "@/lib/utils";

export function AdminNavBadge({
  count,
  active = false,
}: {
  count: number;
  active?: boolean;
}) {
  if (count <= 0) return null;

  return (
    <span
      className={cn(
        "ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
        active
          ? "bg-primary-foreground/20 text-primary-foreground"
          : "bg-primary/15 text-primary"
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
