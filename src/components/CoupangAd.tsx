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

const G_SRC = "https://ads-partners.coupang.com/g.js";

export default function CoupangAd({ variant = "banner" }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (variant === "leaderboard") return;
    const el = ref.current;
    if (!el) return;

    const id = variant === "square" ? 970543 : 970645;
    const width = variant === "square" ? "300" : "680";
    const height = variant === "square" ? "300" : "140";

    let cancelled = false;

    const initAd = () => {
      // 언마운트 후 늦게 도착한 onload가 죽은 노드에 그리는 것을 막는다.
      if (cancelled || !el.isConnected || el.childElementCount > 0) return;
      if (!window.PartnersCoupang) return;
      try {
        new window.PartnersCoupang.G({
          id,
          template: "carousel",
          trackingCode: "AF9787280",
          width,
          height,
          tsource: "",
          // ⚠️ container를 넘기지 않으면 g.js가 "문서의 마지막 <script> 옆"이라는
          //    폴백 경로로 광고를 꽂는다. Next.js는 그 자리가 body 끝(푸터 뒤)이라
          //    광고가 푸터 아래에 붙고, 폭 제약도 안 먹고, 페이지 이동마다 쌓인다.
          container: el,
        });
      } catch {
        // 광고 실패가 본문 렌더링을 막지 않게 한다.
      }
    };

    if (window.PartnersCoupang) {
      initAd();
      return () => {
        cancelled = true;
        el.innerHTML = "";
      };
    }

    // g.js는 문서당 한 번만 — 마운트마다 <head>에 새로 붙이지 않는다.
    let s = document.querySelector<HTMLScriptElement>(`script[src="${G_SRC}"]`);
    if (!s) {
      s = document.createElement("script");
      s.src = G_SRC;
      s.async = true;
      document.head.appendChild(s);
    }
    s.addEventListener("load", initAd);
    const script = s;

    return () => {
      cancelled = true;
      script.removeEventListener("load", initAd);
      el.innerHTML = "";
    };
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
