import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Footer from "@/components/Footer";

const notoSansKR = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-sans-kr",
});

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "내 블로그";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

const googleVerification = process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION;
const naverVerification = process.env.NEXT_PUBLIC_NAVER_VERIFICATION;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  alternates: { types: { "application/rss+xml": "/rss.xml" } },
  title: {
    template: `%s | ${siteName}`,
    default: siteName,
  },
  description: "잘 고르고, 기분 좋게 득템하다 — 사기 전에 알아두면 좋은 구매 기준과 요즘 눈에 띄는 생활 물건을 정리하는 쇼핑 매거진",
  openGraph: {
    type: "website",
    siteName,
    locale: "ko_KR",
  },
  twitter: {
    card: "summary_large_image",
  },
  ...(googleVerification || naverVerification
    ? {
        verification: {
          ...(googleVerification ? { google: googleVerification } : {}),
          ...(naverVerification
            ? { other: { "naver-site-verification": naverVerification } }
            : {}),
        },
      }
    : {}),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const adsenseClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  const gaId = process.env.NEXT_PUBLIC_GA_ID;

  return (
    <html lang="ko" className={`${notoSansKR.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased">
        {children}
        <Footer />
        {adsenseClient && (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        )}
        {gaId && (
          <>
            <Script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
            />
            <Script id="ga-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${gaId}');
              `}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
