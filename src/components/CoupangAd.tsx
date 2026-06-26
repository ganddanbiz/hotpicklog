"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PartnersCoupang: any;
  }
}

export default function CoupangAd() {
  const ref = useRef<HTMLDivElement>(null);
  const done = useRef(false);

  useEffect(() => {
    if (done.current || !ref.current) return;
    done.current = true;

    const initAd = () => {
      if (!ref.current) return;
      const s = document.createElement("script");
      s.text = `
        try {
          new PartnersCoupang.G({
            id: 970543,
            template: "carousel",
            trackingCode: "AF9787280",
            subId: null,
            width: "100%",
            height: "140"
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
  }, []);

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
      <div ref={ref} style={{ width: "100%", overflowX: "hidden", minHeight: "100px" }} />
    </div>
  );
}
