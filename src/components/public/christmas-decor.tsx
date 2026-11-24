// Decoración navideña del hero: guirnalda de luces arriba y nieve cayendo.
// Solo CSS (sin JS ni estado), decorativa y sin interceptar clics. Con
// prefers-reduced-motion (p. ej. "Mostrar animaciones en Windows" apagado) la
// nieve no cae: se muestran copos quietos (ver globals.css).

const LIGHT_COLORS = ["#ff2d2d", "#ffd23f", "#3ddc84", "#4cc3ff"];

// Posiciones fijas (sin Math.random) para que servidor y cliente coincidan.
const FLAKES = Array.from({ length: 22 }, (_, i) => ({
  left: `${(i * 37 + 11) % 100}%`,
  size: 4 + ((i * 5) % 7),
  duration: 9 + ((i * 3) % 8),
  delay: -((i * 7) % 13),
  opacity: 0.45 + ((i * 11) % 5) / 10,
  // Altura fija para quien tiene "reducir movimiento": ven copos quietos.
  restY: `${8 + ((i * 29) % 84)}%`,
}));

export function ChristmasDecor() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      {/* Guirnalda */}
      <div className="absolute inset-x-0 top-0 h-7">
        <svg
          className="size-full"
          viewBox="0 0 600 28"
          preserveAspectRatio="none"
          focusable="false"
        >
          <path
            d="M0 4 Q 37.5 22 75 4 T 150 4 T 225 4 T 300 4 T 375 4 T 450 4 T 525 4 T 600 4"
            fill="none"
            stroke="#1f3d2b"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <div className="absolute inset-x-0 top-0 flex justify-around">
          {Array.from({ length: 16 }, (_, i) => (
            <span
              key={i}
              className="christmas-light mt-2.5 block size-2.5 rounded-full"
              style={{
                backgroundColor: LIGHT_COLORS[i % LIGHT_COLORS.length],
                color: LIGHT_COLORS[i % LIGHT_COLORS.length],
                animationDelay: `${(i % 4) * 0.45}s`,
                marginTop: i % 2 === 0 ? "0.65rem" : "1.1rem",
              }}
            />
          ))}
        </div>
      </div>

      {/* Nieve */}
      {FLAKES.map((f, i) => (
        <span
          key={i}
          className="christmas-flake absolute -top-3 block rounded-full bg-white"
          style={{
            left: f.left,
            width: f.size,
            height: f.size,
            opacity: f.opacity,
            animationDuration: `${f.duration}s`,
            animationDelay: `${f.delay}s`,
            "--flake-y": f.restY,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
