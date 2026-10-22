import { ImageResponse } from "next/og";

export const alt =
  "TETSU BURGER — Hamburguesas a domicilio en Valledupar";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background: "#ff6633",
          color: "#1a0f08",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "18px",
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 999,
              background: "#1a0f08",
            }}
          />
          Valledupar, Cesar
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 132,
              lineHeight: 0.92,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              textTransform: "uppercase",
            }}
          >
            <div>TETSU</div>
            <div>BURGER</div>
          </div>
          <div style={{ fontSize: 38, fontWeight: 600, opacity: 0.85 }}>
            Sazón sobre la plancha · Domicilios
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 30, fontWeight: 600 }}>
          Pide por WhatsApp · Efectivo o transferencia
        </div>
      </div>
    ),
    size
  );
}
