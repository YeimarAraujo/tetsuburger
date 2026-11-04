import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

export const alt = "TETSU BURGER — Hamburguesas en Valledupar";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function toDataUri(file: string) {
  const buffer = await readFile(
    path.join(process.cwd(), "public", "images", file)
  );
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

export default async function OpengraphImage() {
  const logoSrc = await toDataUri("og-logo.png");
  const mascotSrc = await toDataUri("og-tetsito.png");

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
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoSrc}
          alt="TETSU BURGER"
          width={520}
          height={194}
          style={{ width: 520, height: 194 }}
        />
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
