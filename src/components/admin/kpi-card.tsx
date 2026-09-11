import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { InfoTip, type InfoTipContent } from "@/components/ui/info-tip";
import { cn } from "@/lib/utils";

export function KpiCard({
  icon: Icon,
  tileClassName,
  iconClassName,
  label,
  value,
  valueClassName,
  caption,
  help,
}: {
  icon: LucideIcon;
  tileClassName?: string;
  iconClassName?: string;
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
  caption?: React.ReactNode;
  help?: InfoTipContent;
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10",
              tileClassName
            )}
          >
            <Icon className={cn("size-5 text-primary", iconClassName)} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-xs text-muted-foreground">{label}</p>
              {help ? <InfoTip content={help} /> : null}
            </div>
            <p className={cn("text-xl font-bold leading-tight", valueClassName)}>
              {value}
            </p>
            {caption ? (
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                {caption}
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}