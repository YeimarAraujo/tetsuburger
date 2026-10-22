import Image from "next/image";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Image
      src="/images/logo.webp"
      alt="TETSU BURGER"
      width={480}
      height={480}
      className={cn("h-12 w-auto object-contain", className)}
      priority
    />
  );
}