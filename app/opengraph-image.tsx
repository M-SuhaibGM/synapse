import { ImageResponse } from "next/og";

// Share card shown when the site is linked (Open Graph / Twitter). Generated at build
// time. To use a real screenshot instead, delete this file and add
// app/opengraph-image.png (1200×630).
export const alt = "Synapse — Ideas into intelligence. Independent AI studio.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          color: "#f4f4f7",
          background:
            "radial-gradient(circle at 78% 46%, rgba(123, 47, 247, 0.45) 0%, rgba(76, 201, 240, 0.18) 22%, rgba(5, 6, 10, 0) 48%), #05060a",
        }}
      >
        {/* Wordmark */}
        <div style={{ display: "flex", alignItems: "flex-start", fontSize: 34, letterSpacing: -2 }}>
          synapse
          <span style={{ fontSize: 14, color: "#4cc9f0", marginLeft: 3 }}>®</span>
        </div>

        {/* Glowing orb, echoing the particle sphere in the Hero */}
        <div
          style={{
            position: "absolute",
            top: 150,
            right: 150,
            width: 320,
            height: 320,
            display: "flex",
            borderRadius: 9999,
            border: "1px solid rgba(255, 255, 255, 0.22)",
            background:
              "radial-gradient(circle at 37% 30%, #a2edff 0%, #4cc9f0 8%, #7642d6 35%, #150c32 72%)",
            boxShadow: "0 0 120px rgba(123, 47, 247, 0.55)",
          }}
        />

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 112, lineHeight: 0.95, letterSpacing: -8 }}>Ideas into</div>
          <div
            style={{
              fontSize: 112,
              lineHeight: 1.05,
              letterSpacing: -8,
              backgroundImage: "linear-gradient(100deg, #f8f8fb 6%, #4cc9f0 49%, #a374ff 93%)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            intelligence.
          </div>
        </div>

        {/* Footer line */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 22,
            color: "#a4a6b2",
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 9999,
              background: "#4cc9f0",
              boxShadow: "0 0 14px rgba(76, 201, 240, 0.8)",
            }}
          />
          Independent AI studio
        </div>
      </div>
    ),
    size,
  );
}
