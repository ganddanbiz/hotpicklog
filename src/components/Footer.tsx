import Link from "next/link";
import { CATEGORIES } from "@/lib/catalog";

export default function Footer() {
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "득템로그";
  const year = new Date().getFullYear();

  return (
    <footer className="dt-footer">
      <div className="dt-wrap dt-footer__inner">
        <div className="dt-footer__brand">
          <p className="dt-footer__name">{siteName}</p>
          <p className="dt-footer__promise">잘 고르고, 기분 좋게 득템하다.</p>
          <p className="dt-footer__notice">
            득템로그는 쿠팡 파트너스 활동의 일환으로, 글 속 링크를 통한 구매에 대해 일정액의 수수료를 제공받습니다.
            가격·재고는 판매처에서 수시로 바뀌므로 구매 전 판매 페이지에서 확인해 주세요.
          </p>
        </div>

        <nav className="dt-footer__col" aria-label="카테고리">
          <p className="dt-footer__head">카테고리</p>
          <ul>
            {CATEGORIES.slice(0, 6).map((c) => (
              <li key={c.key}>
                <Link href={`/?view=card&category=${encodeURIComponent(c.key)}`}>{c.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav className="dt-footer__col" aria-label="안내">
          <p className="dt-footer__head">안내</p>
          <ul>
            <li><Link href="/about">득템로그 소개</Link></li>
            <li><Link href="/about#affiliate">제휴 안내</Link></li>
            <li><Link href="/privacy">개인정보처리방침</Link></li>
            <li><Link href="/contact">문의하기</Link></li>
            <li><a href="/rss.xml">RSS</a></li>
          </ul>
        </nav>
      </div>
      <div className="dt-wrap">
        <p className="dt-footer__copy">© {year} {siteName}. All rights reserved.</p>
      </div>
    </footer>
  );
}
