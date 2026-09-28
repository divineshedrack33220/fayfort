import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const alt = "Fayfort Sourcing — China sourcing for African businesses";
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
          padding: "56px 64px",
          background:
            "linear-gradient(135deg, #031a45 0%, #06265f 55%, #b40a49 140%)",
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 28, letterSpacing: 4, color: "#f078a8" }}>
            FAYFORT SOURCING
          </div>
          <div
            style={{
              fontSize: 58,
              fontWeight: 700,
              lineHeight: 1.1,
              maxWidth: 820,
            }}
          >
            Know what your China purchase will really cost.
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: "#f71968",
              }}
            />
            <div style={{ fontSize: 26, color: "#d8e4fb" }}>
              Estimate · Request · Quote · Track
            </div>
          </div>
          <div
            style={{
              fontSize: 22,
              color: "#9fb3d9",
              letterSpacing: 1,
              padding: "10px 18px",
              border: "1px solid rgba(216,228,251,0.28)",
              borderRadius: 999,
            }}
          >
            fayfort-web.onrender.com
          </div>
        </div>
      </div>
    ),
    size,
  );
}