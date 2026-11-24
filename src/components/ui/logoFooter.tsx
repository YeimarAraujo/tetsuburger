"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { useSiteAppearance } from "@/components/site-appearance-provider";

/** Logo para fondos oscuros (footer); la imagen sale de la apariencia. */
export function Logo2({ className }: { className?: string }) {
  const { logoLight } = useSiteAppearance();

  return (
    <Image
      src={logoLight.src}
      alt="TETSU BURGER"
      width={logoLight.width}
      height={logoLight.height}
      className={cn("h-12 w-auto object-contain", className)}
      style={logoLight.scale ? { zoom: logoLight.scale } : undefined}
      priority
    />
  );
}
