import { Suspense } from "react";
import pool from "@/lib/db";
import PostList from "@/components/PostList";
import PostCard from "@/components/PostCard";
import ViewToggle from "@/components/ViewToggle";
import Pagination from "@/components/Pagination";

const LIMIT = 10;

const categories: { key: string | null; label: string }[] = [
  { key: null,         label: "전체" },
  { key: "식품",       label: "🍱 식품" },
  { key: "가전",       label: "📱 가전·디지털" },
  { key: "생활",       label: "🏠 생활·주방" },
  { key: "패션",       label: "👗 패션·의류" },
  { key: "뷰티",       label: "💄 뷰티·건강" },
  { key: "스포츠",     label: "⚽ 스포츠·레저" },
  { key: "육아",       label: "🍼 육아·완구" },
  { key: "반려동물",   label: "🐾 반려동물" },
  { key: "상품리뷰",   label: "🛒 상품리뷰" },
];

type SearchParams = Promise<{
  view?: string;
  page?: string;
  category?: string;
}>;

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const { view = "card", page = "1", category } = await searchParams;

  const currentView = view === "card" ? "card" : "list";
  const currentPage = Math.max(1, Number(page) || 1);
  const offset = (currentPage - 1) * LIMIT;

  const countResult = category
    ? await pool.query("SELECT COUNT(*) as total FROM posts WHERE status = 'published' AND category = $1", [category])
    : await pool.query("SELECT COUNT(*) as total FROM posts WHERE status = 'published'");
  const total = Number(countResult.rows[0].total);

  const postsResult = category
    ? await pool.query(
        `SELECT id, title, slug, category, thumbnail_url, meta_description, content, published_at, view_count
         FROM posts WHERE status = 'published' AND category = $1
         ORDER BY published_at DESC LIMIT $2 OFFSET $3`,
        [category, LIMIT, offset]
      )
    : await pool.query(
        `SELECT id, title, slug, category, thumbnail_url, meta_description, content, published_at, view_count
         FROM posts WHERE status = 'published'
         ORDER BY published_at DESC LIMIT $1 OFFSET $2`,
        [LIMIT, offset]
      );
  const posts = postsResult.rows;

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>

      {/* ── 헤더 ──────────────────────────────────── */}
      <header style={{
        background: "var(--header-bg)",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* 배경 그라디언트 효과 */}
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse 80% 100% at 10% 50%, rgba(255,65,108,0.18) 0%, transparent 60%), radial-gradient(ellipse 60% 80% at 90% 20%, rgba(50,173,230,0.12) 0%, transparent 55%)",
          pointerEvents: "none",
        }} />
        <div className="main-px" style={{ maxWidth: "56rem", margin: "0 auto", paddingTop: "1.5rem", paddingBottom: "1.5rem", position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
            <div>
              {/* 상단 라벨 */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <span style={{
                  display: "inline-block",
                  padding: "0.2em 0.75em",
                  background: "var(--accent-grad)",
                  borderRadius: "999px",
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  color: "#fff",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}>
                  PICK
                </span>
                <span style={{ fontSize: "0.6875rem", color: "var(--header-muted)", fontWeight: 500 }}>
                  매일 업데이트되는 핫템 리뷰
                </span>
              </div>
              {/* 사이트 이름 */}
              <h1 style={{
                fontSize: "clamp(2rem, 5vw, 3rem)",
                fontWeight: 900,
                color: "#ffffff",
                lineHeight: 1.1,
                letterSpacing: "-0.03em",
              }}>
                {process.env.NEXT_PUBLIC_SITE_NAME || "득템로그"}
              </h1>
              <p style={{
                fontSize: "0.8125rem",
                color: "var(--header-muted)",
                marginTop: "0.6rem",
                letterSpacing: "0.01em",
              }}>
                진짜 써본 사람만 아는 솔직 리뷰 🔥
              </p>
            </div>
            {/* 우측 뱃지 */}
            <div style={{
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.3rem",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "14px",
              padding: "0.875rem 1.125rem",
            }}>
              <span style={{ fontSize: "1.75rem", lineHeight: 1 }}>🛒</span>
              <span style={{ fontSize: "0.625rem", fontWeight: 700, color: "rgba(255,255,255,0.7)", letterSpacing: "0.05em", textTransform: "uppercase" }}>득템</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── 카테고리 탭 ───────────────────────────── */}
      <div style={{
        background: "var(--bg-card)",
        borderBottom: "1px solid var(--border)",
        position: "sticky",
        top: 0,
        zIndex: 40,
        boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
      }}>
        <div className="main-px" style={{ maxWidth: "56rem", margin: "0 auto" }}>
          <div
            className="scrollbar-hide"
            style={{ display: "flex", overflowX: "auto" }}
          >
            {categories.map(({ key, label }) => {
              const isActive = (!key && !category) || key === category;
              const href = key
                ? `/?view=${currentView}&category=${key}`
                : `/?view=${currentView}`;
              return (
                <a
                  key={key ?? "all"}
                  href={href}
                  className={`cat-tab${isActive ? " active" : ""}`}
                >
                  {label}
                </a>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── 메인 콘텐츠 ───────────────────────────── */}
      <main className="main-px" style={{ maxWidth: "56rem", margin: "0 auto" }}>

        {/* 뷰 토글 + 글 수 */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1.25rem 0",
        }}>
          <span style={{ fontSize: "0.8125rem", color: "var(--ink-muted)" }}>
            총{" "}
            <strong style={{ color: "var(--ink)", fontWeight: 700 }}>{total}</strong>
            개의 글
          </span>
          <Suspense>
            <ViewToggle currentView={currentView} />
          </Suspense>
        </div>

        {/* 글 목록 */}
        <div style={{
          background: "var(--bg-card)",
          borderRadius: "12px",
          border: "1px solid var(--border)",
          overflow: "hidden",
          marginBottom: "1.5rem",
          boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        }}>
          {currentView === "card" ? (
            <div style={{ padding: "1.25rem" }}>
              <PostCard posts={posts as unknown as Partial<import("@/types").Post>[]} />
            </div>
          ) : (
            <PostList posts={posts as unknown as Partial<import("@/types").Post>[]} />
          )}
        </div>

        {/* 페이지네이션 */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          view={currentView}
          category={category}
        />
        <div style={{ height: "3rem" }} />
      </main>
    </div>
  );
}
