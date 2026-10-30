import { cn } from "@/lib/utils";


export function BurgerPattern({
  id,
  className,
  opacity = 0.16,
}: {
  id: string;
  className?: string;
  opacity?: number;
}) {
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-b from-white/0 to-black/5"
      />
      <svg
        aria-hidden="true"
        focusable="false"
        className={cn("pointer-events-none absolute inset-0 -z-10 size-full text-white", className)}
      >
        <defs>
          <g
            id={`${id}-burger`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 18C4 6 14 2 24 2s20 4 20 16z" />
            <path d="M18 9h.01M28 7h.01M34 12h.01M12 13h.01" />
            <path d="M4 24q4-4 8 0t8 0t8 0t8 0t8 0" />
            <rect x="3" y="28" width="42" height="5" rx="2.5" />
            <path d="M4 37h40q0 6-8 6H12q-8 0-8-6z" />
          </g>
          <pattern
            id={`${id}-pattern`}
            width="170"
            height="170"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-8)"
          >
            <g opacity={opacity}>
              <use href={`#${id}-burger`} transform="translate(16 18)" />
              <use href={`#${id}-burger`} transform="translate(99 98) rotate(12 24 22)" />
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${id}-pattern)`} />
      </svg>
    </>
  );
}
