"use client";

import { useEffect, useRef } from "react";

interface AdBannerProps {
  slot: string;
  format?: "auto" | "horizontal" | "rectangle";
  className?: string;
}

type AdsbyGoogleArray = { push: (obj: object) => void }[] & { push: (obj: object) => void };

declare global {
  interface Window {
    adsbygoogle: AdsbyGoogleArray;
  }
}

export default function AdBanner({ slot, format = "auto", className }: AdBannerProps) {
  const adRef = useRef<HTMLModElement>(null);
  const isDev = process.env.NODE_ENV === "development";
  const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "";

  useEffect(() => {
    if (isDev || !clientId || !slot) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // 광고 초기화 실패 시 무시
    }
  }, [isDev, clientId, slot]);

  // 운영에서 애드센스가 설정되지 않았으면 아무것도 그리지 않는다 (방문자에게 빈 점선 박스가 보이던 문제)
  if (!isDev && (!clientId || !slot)) return null;

  if (isDev || !clientId || !slot) {
    return (
      <div
        className={className}
        style={{
          width: "100%",
          minHeight: "90px",
          background: "var(--border-light)",
          border: "1px dashed var(--border)",
          borderRadius: "6px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--ink-faint)",
          fontSize: "0.75rem",
          fontWeight: 600,
          letterSpacing: "0.05em",
          userSelect: "none",
        }}
      >
        광고 영역 (AdSense)
      </div>
    );
  }

  return (
    <ins
      ref={adRef}
      className={`adsbygoogle${className ? ` ${className}` : ""}`}
      style={{ display: "block", width: "100%" }}
      data-ad-client={clientId}
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive="true"
    />
  );
}
