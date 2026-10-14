"use client";

interface Props {
  variant?: "banner" | "square" | "leaderboard";
}

// 쿠팡 위젯 주소(widgets.html)를 iframe으로 직접 넣는다. 스크립트(g.js)를 동적으로 끼우면
// document.currentScript를 못 찾아 광고가 푸터 아래 왼쪽에 붙는다 (2026-10-15 득템로그·KoreaSpots도 이 방식으로 통일).
export default function CoupangAd({ variant = "banner" }: Props) {
  const notice = (
    <p style={{
      fontSize: "0.6875rem",
      color: "var(--ink-faint)",
      textAlign: "right",
      marginBottom: "4px",
      lineHeight: 1.4,
    }}>
      이 포스팅은 쿠팡 파트너스 활동의 일환으로 수수료를 제공받습니다.
    </p>
  );

  if (variant === "leaderboard") {
    return (
      <div style={{ margin: "1.75rem 0", overflow: "hidden" }}>
        {notice}
        <a
          href="https://link.coupang.com/a/eVzgl7H5pY"
          target="_blank"
          rel="noopener noreferrer"
          referrerPolicy="unsafe-url"
          style={{ display: "block", maxWidth: "728px", margin: "0 auto" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://ads-partners.coupang.com/banners/1000915?trackingCode=AF9787280&subId=&traceId=V0-301-969b06e95b87326d-I1000915&w=728&h=90"
            alt=""
            style={{ display: "block", width: "100%", maxWidth: "728px", height: "auto" }}
          />
        </a>
      </div>
    );
  }

  if (variant === "square") {
    return (
      <div style={{ margin: "1.75rem 0", overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center" }}>
        {notice}
        <iframe
          src="https://ads-partners.coupang.com/widgets.html?id=970543&template=carousel&trackingCode=AF9787280&subId=&width=300&height=300"
          width="300"
          height="300"
          frameBorder="0"
          scrolling="no"
          referrerPolicy="unsafe-url"
          style={{ display: "block", maxWidth: "100%" }}
        />
      </div>
    );
  }

  // banner (default)
  return (
    <div style={{ margin: "1.75rem 0", overflow: "hidden" }}>
      {notice}
      <iframe
        src="https://ads-partners.coupang.com/widgets.html?id=970645&template=carousel&trackingCode=AF9787280&subId=&width=680&height=140"
        width="680"
        height="140"
        frameBorder="0"
        scrolling="no"
        referrerPolicy="unsafe-url"
        style={{ display: "block", width: "100%", maxWidth: "680px", height: "140px", margin: "0 auto" }}
      />
    </div>
  );
}
