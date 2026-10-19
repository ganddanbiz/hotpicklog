import type { Metadata } from "next";
import pool from "@/lib/db";
import { Post } from "@/types";
import SiteHeader from "@/components/SiteHeader";
import { EditorialCard } from "@/components/MagazineCards";

export const metadata: Metadata = {
  title: "검색",
  robots: { index: false, follow: true },
};

type SearchParams = Promise<{ q?: string }>;

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const { q = "" } = await searchParams;
  const query = q.trim().slice(0, 50);
  let posts: Partial<Post>[] = [];
  if (query) {
    const like = `%${query.replace(/[%_\\]/g, "\\$&")}%`;
    const { rows } = await pool.query(
      `SELECT id, title, slug, category, thumbnail_url, meta_description, published_at, view_count
       FROM posts WHERE status = 'published'
         AND (title ILIKE $1 OR meta_description ILIKE $1 OR keywords ILIKE $1)
       ORDER BY published_at DESC LIMIT 30`,
      [like]
    );
    posts = rows;
  }

  return (
    <>
      <SiteHeader />
      <main className="dt-wrap dt-listing">
        <div className="dt-listing__head">
          <div>
            <p className="dt-eyebrow"><span>검색</span></p>
            <h1 className="dt-listing__title">{query ? `“${query}” 검색 결과` : "무엇을 찾으세요?"}</h1>
            {query && <p className="dt-listing__count">총 <strong>{posts.length}</strong>편</p>}
          </div>
        </div>
        <form action="/search" method="get" className="dt-search dt-search--page" role="search">
          <label htmlFor="dt-search-page" className="sr-only">글 검색</label>
          <input id="dt-search-page" name="q" type="search" defaultValue={query} placeholder="예: 이불, 가습기, 수납" />
          <button type="submit">검색</button>
        </form>
        {query && posts.length === 0 && (
          <p className="dt-empty">찾는 글이 아직 없어요. 다른 단어로 검색해 보세요.</p>
        )}
        <div className="dt-grid dt-grid--3">
          {posts.map((p) => <EditorialCard key={p.id} post={p} />)}
        </div>
      </main>
    </>
  );
}
