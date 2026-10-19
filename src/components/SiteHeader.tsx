import Link from "next/link";
import { CATEGORIES } from "@/lib/catalog";

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "득템로그";

export default function SiteHeader({ active }: { active?: string | null }) {
  return (
    <header className="dt-header">
      <div className="dt-header__bar">
        <div className="dt-wrap dt-header__inner">
          <Link href="/" className="dt-logo" aria-label={`${SITE_NAME} 홈`}>
            <span className="dt-logo__mark" aria-hidden="true">득</span>
            <span>{SITE_NAME}</span>
          </Link>
          <form action="/search" method="get" className="dt-search" role="search">
            <label htmlFor="dt-search-input" className="sr-only">글 검색</label>
            <input id="dt-search-input" name="q" type="search" placeholder="어떤 물건을 찾으세요?" />
            <button type="submit" aria-label="검색">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
                <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </form>
        </div>
      </div>
      <nav className="dt-chips-bar" aria-label="카테고리">
        <div className="dt-wrap dt-chips scrollbar-hide">
          <Link href="/" className={`dt-chip${!active ? " is-active" : ""}`} aria-current={!active ? "page" : undefined}>
            전체
          </Link>
          {CATEGORIES.map((c) => (
            <Link
              key={c.key}
              href={`/?view=card&category=${encodeURIComponent(c.key)}`}
              className={`dt-chip${active === c.key ? " is-active" : ""}`}
              aria-current={active === c.key ? "page" : undefined}
            >
              {c.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
