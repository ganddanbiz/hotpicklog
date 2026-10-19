"use client";

const COUPANG_URL = "https://link.coupang.com/a/eJzg1eIyu4";

export default function WingBanner() {
  return (
    <div className="wing-banner">
      <a
        href={COUPANG_URL}
        target="_blank"
        rel="noopener noreferrer sponsored"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "8px",
          padding: "16px 10px",
          background: "var(--navy)",
          borderRadius: "12px",
          textDecoration: "none",
          textAlign: "center",
        }}
      >
        <span style={{ fontSize: "1.75rem" }}>🛒</span>
        <span style={{ color: "#fff", fontWeight: 700, fontSize: "0.78rem", lineHeight: 1.4 }}>
          쿠팡에서<br />쇼핑하기
        </span>
        <span style={{
          display: "block",
          padding: "5px 12px",
          background: "var(--coral)",
          color: "var(--navy)",
          fontSize: "0.72rem",
          fontWeight: 700,
          borderRadius: "6px",
        }}>
          바로가기 →
        </span>
      </a>
      <p style={{
        fontSize: "0.6rem",
        color: "var(--ink-muted)",
        textAlign: "center",
        lineHeight: 1.4,
        margin: 0,
        padding: "4px 2px",
      }}>
        쿠팡 파트너스 수수료 제공
      </p>
    </div>
  );
}
