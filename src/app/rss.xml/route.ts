import pool from "@/lib/db";

// RSS 피드 (/rss.xml) — 네이버 서치어드바이저·피드 리더 제출용. sitemap처럼 1시간마다 다시 만든다 (2026-10-15 컨트롤타워)
export const revalidate = 3600;

type Row = { slug: string; title: string; category: string | null; meta_description: string | null; published_at: string; updated_at: string };

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "득템로그";
  const { rows } = await pool.query<Row>(
    "SELECT slug, title, category, meta_description, published_at, updated_at FROM posts WHERE status = 'published' ORDER BY published_at DESC LIMIT 30"
  );

  const items = rows
    .map((p) => {
      const link = `${siteUrl}/posts/${p.slug}`;
      return `    <item>
      <title>${esc(p.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${new Date(p.published_at).toUTCString()}</pubDate>${p.category ? `\n      <category>${esc(p.category)}</category>` : ""}
      <description>${esc(p.meta_description || "")}</description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(siteName)}</title>
    <link>${siteUrl}</link>
    <description>${esc("직접 써보고 고른 생활 속 득템 상품 이야기")}</description>
    <language>ko</language>
    <lastBuildDate>${new Date(rows[0]?.published_at || Date.now()).toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
