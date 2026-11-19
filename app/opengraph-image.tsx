import { ImageResponse } from "next/og";

export const alt = "HyperDrive — Mount all your cloud storage as a local H:\\ drive on Windows";
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
          padding: 80,
          background: "#07090E",
          color: "#EDEDF0",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
            <path d="M16 2.5 27.7 9.25v13.5L16 29.5 4.3 22.75V9.25L16 2.5Z" stroke="#EDEDF0" strokeWidth="2" strokeLinejoin="round" />
            <path d="M11 10.5v11M21 10.5v11" stroke="#EDEDF0" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M11.5 16h1.6M15.2 16h1.6M18.9 16h1.6" stroke="#EDEDF0" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 500 }}>HyperDrive</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", fontSize: 72, fontWeight: 500, lineHeight: 1.08, letterSpacing: -2.5, maxWidth: 960 }}>
            Mount all your cloud storage as a local drive.
          </div>
          <div style={{ display: "flex", fontSize: 28, color: "#969BA6" }}>
            Google Drive, Dropbox, and OneDrive as one H:\ drive on Windows.
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 22, color: "#5F6571" }}>Coming soon · Join the waitlist</div>
      </div>
    ),
    size,
  );
}
