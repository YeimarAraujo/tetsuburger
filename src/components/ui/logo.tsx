import Image from "next/image";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Image
      src="/images/logo.webp"
      alt="TETSU BURGER"
      width={483}
      height={180}
      className={cn("h-12 w-auto object-contain", className)}
      priority
    />
  );
}