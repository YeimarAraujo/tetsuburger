import Image from "next/image";
import { cn } from "@/lib/utils";

export function Logo2({ className }: { className?: string }) {
    return (
        <Image
            src="/images/logoWhite.webp"
            alt="TETSU BURGER"
            width={483}
            height={180}
            className={cn("h-12 w-auto object-contain", className)}
            priority
        />
    );
}