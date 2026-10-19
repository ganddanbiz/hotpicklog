import { Suspense } from "react";
import type { Metadata } from "next";
import pool from "@/lib/db";
import { Post } from "@/types";
import SiteHeader from "@/components/SiteHeader";
import PostList from "@/components/PostList";
import ViewToggle from "@/components/ViewToggle";
import Pagination from "@/components/Pagination";
import AdBanner from "@/components/AdBanner";
import {
  FeaturedCard, EditorialCard, BuyingGuideCard, RankList, SectionHead,
} from "@/components/MagazineCards";
import { CATEGORIES, categoryLabel, GUIDE_SLUG_SQL, seasonCuration } from "@/lib/catalog";

const LIMIT = 12;
const CARD_COLS = "id, title, slug, category, thumbnail_url, meta_description, published_at, view_count";

type SearchParams = Promise<{ view?: string; page?: string; category?: string }>;

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const { category, page } = await searchParams;
  if (category) {
    const label = categoryLabel(category);
    return {
      title: `${label} 득템 모아보기`,
      description: `득템로그 ${label} 카테고리 — 상품 소개와 구매 가이드를 한곳에 모았어요.`,
      alternates: { canonical: `/?view=card&category=${encodeURIComponent(category)}` },
    };
  }
  return page ? { title: "전체 글", alternates: { canonical: "/" } } : { alternates: { canonical: "/" } };
}

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const { view, page, category } = await searchParams;
  if (category || page) {
    return <Listing view={view} page={page} category={category} />;
  }
  return <MagazineHome />;
}

/* ── 매거진 홈 ─────────────────────────────────────── */
async function MagazineHome() {
  const season = seasonCuration();
  const [allRes, guideRes] = await Promise.all([
    pool.query(`SELECT ${CARD_COLS} FROM posts WHERE status = 'published' ORDER BY published_at DESC LIMIT 400`),
    pool.query(
      `SELECT ${CARD_COLS}, content FROM posts WHERE status = 'published' AND ${GUIDE_SLUG_SQL}
       ORDER BY published_at DESC LIMIT 3`
    ),
  ]);
  const all = allRes.rows as Partial<Post>[];
  const guides = guideRes.rows as Partial<Post>[];
  if (all.length === 0) {
    return (
      <>
        <SiteHeader />
        <main className="dt-wrap dt-empty">아직 게시된 글이 없습니다.</main>
      </>
    );
  }

  const featured = all[0];
  const popular = [...all.slice(1)].sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0)).slice(0, 5);

  const seasonal = all
    .filter((p) => p.id !== featured.id && season.keywords.some((k) => p.title?.includes(k)))
    .slice(0, 4);

  const used = new Set<number | undefined>([featured.id, ...seasonal.map((p) => p.id), ...guides.map((p) => p.id)]);
  const latest = all.filter((p) => !used.has(p.id)).slice(0, 6);
  latest.forEach((p) => used.add(p.id));

  // 글이 3편 이상인 카테고리만, 많은 순으로 3개
  const counts = new Map<string, number>();
  all.forEach((p) => p.category && counts.set(p.category, (counts.get(p.category) ?? 0) + 1));
  const magazineCats = CATEGORIES.filter((c) => (counts.get(c.key) ?? 0) >= 3)
    .sort((a, b) => (counts.get(b.key) ?? 0) - (counts.get(a.key) ?? 0))
    .slice(0, 3)
    .map((c) => {
      const inCat = all.filter((p) => p.category === c.key);
      const fresh = inCat.filter((p) => !used.has(p.id));
      const pick = (fresh.length >= 3 ? fresh : inCat).slice(0, 3);
      return { ...c, total: counts.get(c.key) ?? 0, posts: pick };
    });

  const adSlot = process.env.NEXT_PUBLIC_ADSENSE_SLOT_LIST || "";

  return (
    <>
      <SiteHeader />
      <main className="dt-home">
        <section className="dt-wrap dt-intro">
          <h1 className="dt-intro__title">잘 고르고, 기분 좋게 <em>득템</em>하다</h1>
          <p className="dt-intro__lead">사기 전에 알아두면 좋은 기준과 요즘 눈에 띄는 물건을 차근차근 정리합니다.</p>
        </section>

        {/* 1. Editor's Pick + 많이 읽은 글 */}
        <section className="dt-wrap dt-lead" aria-label="에디터 추천">
          <FeaturedCard post={featured} />
          <aside className="dt-lead__side">
            <h2 className="dt-side__title">많이 읽은 글</h2>
            <p className="dt-side__note">조회수 기준</p>
            <RankList posts={popular} />
          </aside>
        </section>

        {/* 2. 시즌 큐레이션 */}
        {seasonal.length >= 2 && (
          <section className="dt-band dt-band--cream">
            <div className="dt-wrap">
              <SectionHead title={season.title} lead={season.lead} />
              <div className="dt-grid dt-grid--4">
                {seasonal.map((p) => <EditorialCard key={p.id} post={p} compact />)}
              </div>
            </div>
          </section>
        )}

        {/* 3. 구매 전 비교 가이드 */}
        {guides.length > 0 && (
          <section className="dt-band dt-band--mist">
            <div className="dt-wrap">
              <SectionHead
                title="사기 전에 먼저 읽는 구매 가이드"
                lead="무엇을 기준으로 골라야 하는지, 어디서 손해 보기 쉬운지 정리했어요."
              />
              <div className="dt-grid dt-grid--3">
                {guides.map((p) => <BuyingGuideCard key={p.id} post={p} />)}
              </div>
            </div>
          </section>
        )}

        {adSlot && (
          <div className="dt-wrap dt-ad">
            <AdBanner slot={adSlot} format="horizontal" />
          </div>
        )}

        {/* 4. 카테고리별 매거진 */}
        {magazineCats.map((c) => (
          <section key={c.key} className="dt-wrap dt-section">
            <SectionHead
              title={c.label}
              href={`/?view=card&category=${encodeURIComponent(c.key)}`}
              more={`${c.total}편 모두 보기`}
            />
            <div className="dt-grid dt-grid--3">
              {c.posts.map((p) => <EditorialCard key={p.id} post={p} />)}
            </div>
          </section>
        ))}

        {/* 5. 새로 올라온 글 */}
        {latest.length > 0 && (
          <section className="dt-wrap dt-section">
            <SectionHead title="새로 올라온 글" href="/?view=card&page=1" more="전체 글 보기" />
            <div className="dt-grid dt-grid--3">
              {latest.map((p) => <EditorialCard key={p.id} post={p} />)}
            </div>
          </section>
        )}
      </main>
    </>
  );
}

/* ── 카테고리·전체 목록 (기존 ?category= / ?page= / ?view= 주소 유지) ── */
async function Listing({ view, page, category }: { view?: string; page?: string; category?: string }) {
  const currentView = view === "list" ? "list" : "card";
  const currentPage = Math.max(1, Number(page) || 1);
  const offset = (currentPage - 1) * LIMIT;
  const cols = currentView === "list" ? `${CARD_COLS}, content` : CARD_COLS;

  const where = category ? "status = 'published' AND category = $1" : "status = 'published'";
  const args = category ? [category] : [];
  const [countRes, postsRes] = await Promise.all([
    pool.query(`SELECT COUNT(*) AS total FROM posts WHERE ${where}`, args),
    pool.query(
      `SELECT ${cols} FROM posts WHERE ${where} ORDER BY published_at DESC
       LIMIT $${args.length + 1} OFFSET $${args.length + 2}`,
      [...args, LIMIT, offset]
    ),
  ]);
  const total = Number(countRes.rows[0].total);
  const posts = postsRes.rows as Partial<Post>[];
  const totalPages = Math.ceil(total / LIMIT);
  const title = category ? categoryLabel(category) : "전체 글";

  return (
    <>
      <SiteHeader active={category ?? null} />
      <main className="dt-wrap dt-listing">
        <div className="dt-listing__head">
          <div>
            <p className="dt-eyebrow"><span>{category ? "카테고리" : "득템로그"}</span></p>
            <h1 className="dt-listing__title">{title}</h1>
            <p className="dt-listing__count">총 <strong>{total}</strong>편</p>
          </div>
          <Suspense>
            <ViewToggle currentView={currentView} />
          </Suspense>
        </div>

        {posts.length === 0 ? (
          <p className="dt-empty">아직 이 카테고리에 올라온 글이 없어요.</p>
        ) : currentView === "card" ? (
          <div className="dt-grid dt-grid--3">
            {posts.map((p) => <EditorialCard key={p.id} post={p} />)}
          </div>
        ) : (
          <div className="dt-listbox">
            <PostList posts={posts} />
          </div>
        )}

        <div className="dt-pager">
          <Pagination currentPage={currentPage} totalPages={totalPages} view={currentView} category={category} />
        </div>
      </main>
    </>
  );
}
