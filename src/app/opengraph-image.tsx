import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { site } from "@/lib/site";

export const alt = `${site.name} — ${site.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage() {
  // 로고(화이트 P) 를 co-located 에셋에서 로드해 data URI로 임베드 (빌드 시 정적 생성)
  const logoBuf = await readFile(join(process.cwd(), "src", "app", "og-logo.png"));
  const logoSrc = `data:image/png;base64,${Buffer.from(logoBuf).toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "90px",
          background:
            "linear-gradient(135deg, #0a1830 0%, #0e1e3a 60%, #16305f 140%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        {/* 로고 */}
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} width={80} height={80} alt="풍현 로고" />
          <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.02em" }}>
            {site.shortName}
          </div>
        </div>

        {/* 태그라인 */}
        <div
          style={{
            marginTop: 56,
            fontSize: 76,
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: "-0.03em",
          }}
        >
          정산은 기다리고,
        </div>
        <div
          style={{
            fontSize: 76,
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: "-0.03em",
            color: "#7ea3dc",
          }}
        >
          자금은 지금.
        </div>

        {/* 서브 카피 */}
        <div
          style={{
            marginTop: 40,
            fontSize: 30,
            color: "#adbfd5",
            maxWidth: 900,
          }}
        >
          자산 기반 렌탈·선정산 서비스 · 세일앤렌탈백(SRB)
        </div>
      </div>
    ),
    { ...size },
  );
}
