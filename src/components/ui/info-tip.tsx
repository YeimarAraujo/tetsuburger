"use client";

import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface InfoTipContent {
  title?: string;
  what?: string;
  formula?: string;
  suggestion?: string;
}

export function InfoTip({
  content,
  className,
}: {
  content: InfoTipContent;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Información"
          className={cn(
            "inline-flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:text-primary focus-visible:text-primary focus-visible:outline-none",
            className
          )}
        >
          <HelpCircle className="size-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent
        sideOffset={6}
        className="w-[290px] max-w-[calc(100vw-2rem)] items-start p-3 font-sans"
      >
        <div className="space-y-1.5 leading-relaxed">
          {content.title ? (
            <p className="text-[11px] font-semibold uppercase tracking-wide text-background/70">
              {content.title}
            </p>
          ) : null}
          {content.what ? (
            <p className="text-xs">{content.what}</p>
          ) : null}
          {content.formula ? (
            <p className="text-[11px]">
              <span className="font-medium">Cómo se calcula: </span>
              <code className="rounded bg-background/15 px-1 py-0.5 font-mono text-[10px]">
                {content.formula}
              </code>
            </p>
          ) : null}
          {content.suggestion ? (
            <p className="text-[11px]">
              <span className="font-medium">Sugerencia: </span>
              {content.suggestion}
            </p>
          ) : null}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}