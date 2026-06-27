"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PartnersCoupang: any;
  }
}

interface Props {
  variant?: "banner" | "square" | "leaderboard";
}

export default function CoupangAd({ variant = "banner" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const done = useRef(false);

  useEffect(() => {
    if (variant === "leaderboard" || done.current || !ref.current) return;
    done.current = true;

    const id = variant === "square" ? 970543 : 970645;
    const width = variant === "square" ? "300" : "680";
    const height = variant === "square" ? "300" : "140";

    const initAd = () => {
      if (!ref.current) return;
      const s = document.createElement("script");
      s.text = `
        try {
          new PartnersCoupang.G({
            id: ${id},
            template: "carousel",
            trackingCode: "AF9787280",
            width: "${width}",
            height: "${height}",
            tsource: ""
          });
        } catch(e) {}
      `;
      ref.current.appendChild(s);
    };

    if (window.PartnersCoupang) {
      initAd();
    } else {
      const gScript = document.createElement("script");
      gScript.src = "https://ads-partners.coupang.com/g.js";
      gScript.async = true;
      gScript.onload = initAd;
      document.head.appendChild(gScript);
    }
  }, [variant]);

  if (variant === "leaderboard") {
    return (
      <div style={{ margin: "1.75rem 0", overflow: "hidden" }}>
        <p style={{
          fontSize: "0.6875rem",
          color: "var(--ink-faint)",
          textAlign: "right",
          marginBottom: "4px",
          lineHeight: 1.4,
        }}>
          이 포스팅은 쿠팡 파트너스 활동의 일환으로 수수료를 제공받습니다.
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <a
          href="https://link.coupang.com/a/eVzgl7H5pY"
          target="_blank"
          rel="noopener noreferrer"
          referrerPolicy="unsafe-url"
          style={{ display: "block" }}
        >
          <img
            src="https://ads-partners.coupang.com/banners/1000915?trackingCode=AF9787280&subId=&traceId=V0-301-969b06e95b87326d-I1000915&w=728&h=90"
            alt=""
            style={{ display: "block", width: "100%", maxWidth: "728px", height: "auto" }}
          />
        </a>
      </div>
    );
  }

  const isSquare = variant === "square";

  return (
    <div style={{ margin: "1.75rem 0", overflow: "hidden", display: "flex", flexDirection: "column", alignItems: isSquare ? "center" : "stretch" }}>
      <p style={{
        fontSize: "0.6875rem",
        color: "var(--ink-faint)",
        textAlign: "right",
        marginBottom: "4px",
        lineHeight: 1.4,
        width: isSquare ? "300px" : "100%",
        maxWidth: "100%",
      }}>
        이 포스팅은 쿠팡 파트너스 활동의 일환으로 수수료를 제공받습니다.
      </p>
      <div ref={ref} style={{ width: isSquare ? "300px" : "100%", maxWidth: "100%", overflowX: "hidden", minHeight: isSquare ? "300px" : "100px" }} />
    </div>
  );
}
