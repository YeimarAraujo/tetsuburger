"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { useSiteAppearance } from "@/components/site-appearance-provider";

/** Logo para fondos claros; la imagen sale de la apariencia (panel admin). */
export function Logo({ className }: { className?: string }) {
  const { logo } = useSiteAppearance();

  return (
    <Image
      src={logo.src}
      alt="TETSU BURGER"
      width={logo.width}
      height={logo.height}
      className={cn("h-12 w-auto object-contain", className)}
      style={logo.scale ? { zoom: logo.scale } : undefined}
      priority
    />
  );
}
