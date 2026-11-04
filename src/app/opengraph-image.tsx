import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

export const alt = "TETSU BURGER — Hamburguesas en Valledupar";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const mascot = await readFile(
    path.join(process.cwd(), "public", "images", "og-tetsito.png")
  );
  const mascotSrc = `data:image/png;base64,${mascot.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 40px 0 72px",
          background: "#ff6633",
          color: "#ffffff",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "28px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#1a0f08",
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 999,
                background: "#1a0f08",
              }}
            />
            Valledupar, Cesar
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 124,
              lineHeight: 0.92,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              textTransform: "uppercase",
            }}
          >
            <div>TETSU</div>
            <div>BURGER</div>
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mascotSrc}
          alt=""
          width={574}
          height={560}
          style={{ width: 574, height: 560 }}
        />
      </div>
    ),
    size
  );
}
