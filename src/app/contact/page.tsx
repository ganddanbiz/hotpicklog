import type { Metadata } from "next";
import Link from "next/link";
import ContactForm from "./ContactForm";

export const metadata: Metadata = {
  title: "문의하기",
  description: "궁금한 점이나 제안 사항을 남겨주세요.",
};

export default function ContactPage() {
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "내 블로그";

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>

      {/* 헤더 */}
      <header style={{ background: "var(--header-bg)" }}>
        <div style={{ maxWidth: "52rem", margin: "0 auto", padding: "1.5rem 1.5rem" }}>
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              fontSize: "0.875rem",
              color: "var(--header-muted)",
              textDecoration: "none",
            }}
          >
            ← {siteName}
          </Link>
        </div>
      </header>

      {/* 본문 */}
      <main style={{ maxWidth: "40rem", margin: "0 auto", padding: "3rem 1.5rem 5rem" }}>
        <h1 style={{
          fontFamily: "var(--font-serif)",
          fontSize: "clamp(1.5rem, 3vw, 2rem)",
          fontWeight: 800,
          color: "var(--ink)",
          marginBottom: "0.5rem",
          lineHeight: 1.3,
        }}>
          문의하기
        </h1>
        <p style={{
          fontSize: "0.9375rem",
          color: "var(--ink-muted)",
          marginBottom: "2.5rem",
          lineHeight: 1.7,
        }}>
          블로그 관련 질문, 광고·제휴 문의, 콘텐츠 오류 신고 등<br />
          아래 양식을 작성해 주시면 빠르게 확인하겠습니다.
        </p>

        {/* 문의 폼 */}
        <div style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "12px",
          padding: "1.75rem",
          marginBottom: "2rem",
        }}>
          <ContactForm />
        </div>

        <p style={{ fontSize: "0.8125rem", color: "var(--ink-faint)", textAlign: "center", lineHeight: 1.6 }}>
          개인정보처리방침은{" "}
          <Link href="/privacy" style={{ color: "var(--accent)", textDecoration: "underline" }}>
            이 페이지
          </Link>
          에서 확인하실 수 있습니다.
        </p>
      </main>
    </div>
  );
}
