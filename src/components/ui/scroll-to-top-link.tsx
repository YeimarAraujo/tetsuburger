"use client";

export function ScrollToTopLink() {
  return (
    <a
      href="#"
      onClick={(e) => {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }}
      className="text-xs text-orange-700/60 transition-colors hover:text-orange-800 underline underline-offset-4"
    >
      Volver arriba
    </a>
  );
}
