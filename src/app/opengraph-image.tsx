import { ImageResponse } from "next/og";
import { site } from "@/lib/site";

export const alt = `${site.name} — ${site.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
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
            "linear-gradient(135deg, #0a1830 0%, #0e1e3a 60%, #0a4432 140%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        {/* 로고 */}
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 18,
              background: "#0a1830",
              border: "2px solid rgba(87,215,163,0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="44" height="44" viewBox="0 0 32 32" fill="none">
              <path
                d="M10 25 C 10.5 19, 12 19, 12 8 H16.5 A4 4 0 0 1 16.5 16 H12"
                fill="none"
                stroke="#57d7a3"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
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
            color: "#57d7a3",
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
