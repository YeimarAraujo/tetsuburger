import type { ReactNode } from "react";
import { site } from "@/config/site";
import { cn } from "@/lib/utils";

interface Social {
  label: string;
  href: string;
  icon: ReactNode;
}

const candidates: { label: string; href: string | null; icon: ReactNode }[] = [
  {
    label: "Instagram",
    href: site.social.instagram,
    icon: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" />
      </>
    ),
  },
  {
    label: "TikTok",
    href: site.social.tiktok,
    icon: <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />,
  },
];

const socials = candidates.filter(
  (social): social is Social => Boolean(social.href)
);

export function SocialLinks({ className }: { className?: string }) {
  return (

    <div className={cn("flex items-center gap-2", className)}>
      {socials.map((social) => (
        <a
          key={social.label}
          href={social.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${social.label} de TETSU BURGER`}
          className="grid size-11 place-items-center rounded-full border border-white/40 bg-white/10 text-white backdrop-blur-sm transition-all hover:bg-white/20 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="size-5"
          >
            {social.icon}
          </svg>
        </a>
      ))}
    </div>

  );
}
