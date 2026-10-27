import { notFound } from "next/navigation";
import type { Metadata } from "next";
import pool from "@/lib/db";
import { Post } from "@/types";
import JsonLd from "@/components/JsonLd";
import CommentSection from "@/components/CommentSection";
import LikeButton from "@/components/LikeButton";
import ShareButton from "@/components/ShareButton";
import Link from "next/link";
import { proxyUrl, proxyImagesInHtml } from "@/lib/imageProxy";
import CoupangAd from "@/components/CoupangAd";
import SiteHeader from "@/components/SiteHeader";
import WingBanner from "@/components/WingBanner";
import { EditorialCard } from "@/components/MagazineCards";
import { categoryLabel, contentType, CONTENT_TYPE_LABEL, formatDate, isoDate } from "@/lib/catalog";

export const revalidate = 3600;

type Props = { params: Promise<{ slug: string }> };

const CARD_COLS = "id, title, slug, category, thumbnail_url, meta_description, published_at, view_count";

async function getPost(slug: string): Promise<Post | null> {
  const { rows } = await pool.query(
    "SELECT * FROM posts WHERE slug = $1 AND status = 'published'",
    [slug]
  );
  return (rows[0] as Post) || null;
}

async function getLikeCount(postId: number): Promise<number> {
  const { rows } = await pool.query(
    "SELECT COUNT(*) as count FROM likes WHERE post_id = $1",
    [postId]
  );
  return Number(rows[0]?.count) || 0;
}

async function getNeighbors(post: Post) {
  const [related, prev, next] = await Promise.all([
    pool.query(
      `SELECT ${CARD_COLS} FROM posts WHERE status = 'published' AND category = $1 AND id <> $2
       ORDER BY published_at DESC LIMIT 4`,
      [post.category, post.id]
    ),
    pool.query(
      `SELECT slug, title FROM posts WHERE status = 'published' AND published_at < $1
       ORDER BY published_at DESC LIMIT 1`,
      [post.published_at]
    ),
    pool.query(
      `SELECT slug, title FROM posts WHERE status = 'published' AND published_at > $1
       ORDER BY published_at ASC LIMIT 1`,
      [post.published_at]
    ),
  ]);
  let rel = related.rows as Partial<Post>[];
  if (rel.length < 4) {
    const extra = await pool.query(
      `SELECT ${CARD_COLS} FROM posts WHERE status = 'published' AND category <> $1 AND id <> $2
       ORDER BY published_at DESC LIMIT $3`,
      [post.category, post.id, 4 - rel.length]
    );
    rel = [...rel, ...(extra.rows as Partial<Post>[])];
  }
  return {
    related: rel,
    prev: prev.rows[0] as { slug: string; title: string } | undefined,
    next: next.rows[0] as { slug: string; title: string } | undefined,
  };
}

export async function generateStaticParams() {
  const { rows } = await pool.query(
    "SELECT slug FROM posts WHERE status = 'published'"
  );
  return rows.map((row: { slug: string }) => ({ slug: row.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  if (!post) return { title: "글을 찾을 수 없습니다" };
  return {
    title: post.title,
    description: post.meta_description || post.title,
    keywords: post.keywords || undefined,
    alternates: { canonical: `/posts/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.meta_description || post.title,
      url: `${siteUrl}/posts/${post.slug}`,
      type: "article",
      publishedTime: isoDate(post.published_at || post.created_at),
      modifiedTime: isoDate(post.updated_at),
      ...(post.thumbnail_url && { images: [{ url: post.thumbnail_url }] }),
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.meta_description || post.title,
      ...(post.thumbnail_url && { images: [post.thumbnail_url] }),
    },
  };
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  await pool.query("UPDATE posts SET view_count = view_count + 1 WHERE id = $1", [post.id]);
  const [likeCount, { related, prev, next }] = await Promise.all([getLikeCount(post.id), getNeighbors(post)]);

  const type = contentType(post.slug);
  const published = formatDate(post.published_at, true);
  // 발행 다음 날 이후에 고친 경우에만 수정일을 보여준다
  const updatedLater = post.updated_at && post.published_at
    && new Date(post.updated_at).getTime() - new Date(post.published_at).getTime() > 86_400_000;
  const hasAffiliate = /link\.coupang\.com|쿠팡 파트너스/.test(post.content);

  return (
    <>
      <JsonLd post={post} />
      <SiteHeader active={post.category} />
      <div className="dt-post-layout">
      <main className="dt-article-wrap">
        <nav className="dt-crumbs" aria-label="현재 위치">
          <Link href="/">홈</Link>
          <span aria-hidden="true">›</span>
          <Link href={`/?view=card&category=${encodeURIComponent(post.category)}`}>{categoryLabel(post.category)}</Link>
        </nav>

        <article className="dt-article">
          <header className="dt-article__head">
            <p className="dt-meta">
              <span className={`dt-type dt-type--${type}`}>{CONTENT_TYPE_LABEL[type]}</span>
              <span>{categoryLabel(post.category)}</span>
            </p>
            <h1 className="dt-article__title">{post.title}</h1>
            {post.meta_description && <p className="dt-article__lead">{post.meta_description}</p>}
            <p className="dt-article__dates">
              {published && <span>발행 <time dateTime={isoDate(post.published_at)}>{published}</time></span>}
              {updatedLater && <span>수정 <time dateTime={isoDate(post.updated_at)}>{formatDate(post.updated_at, true)}</time></span>}
              <span>조회 {post.view_count.toLocaleString()}</span>
            </p>
          </header>

          {hasAffiliate && (
            <aside className="dt-disclosure" aria-label="제휴 안내">
              <strong>제휴 링크 안내</strong>
              <p>
                이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
                글 속 링크로 구매하셔도 가격은 같아요.
              </p>
            </aside>
          )}

          {post.thumbnail_url && (
            <figure className="dt-article__hero">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={proxyUrl(post.thumbnail_url)} alt={post.title} fetchPriority="high" />
            </figure>
          )}

          <CoupangAd />

          <div
            className="prose"
            dangerouslySetInnerHTML={{ __html: proxyImagesInHtml(post.content) }}
          />

          {type === "product" && (
            <section className="dt-checklist" aria-labelledby="dt-checklist-title">
              <h2 id="dt-checklist-title">구매 전 체크리스트</h2>
              <ul>
                <li>가격·할인·재고는 수시로 바뀌어요. 이 글에는 적지 않았으니 구매 시점에 판매 페이지에서 확인하세요.</li>
                <li>크기·용량·색상 옵션이 우리 집 공간과 용도에 맞는지 확인하세요.</li>
                <li>교환·반품 조건과 배송 방식(로켓배송 여부 등)을 확인하세요.</li>
                <li>최근 구매자 후기에서 반복해서 나오는 단점이 있는지 살펴보세요.</li>
              </ul>
            </section>
          )}

          <div className="dt-article__actions">
            <LikeButton postId={post.id} initialCount={likeCount} />
            <ShareButton title={post.title} />
          </div>
        </article>

        <CoupangAd variant="leaderboard" />

        {(prev || next) && (
          <nav className="dt-prevnext" aria-label="이전·다음 글">
            {prev ? (
              <Link href={`/posts/${prev.slug}`} className="dt-prevnext__item">
                <span>← 이전 글</span>
                <strong>{prev.title}</strong>
              </Link>
            ) : <span />}
            {next ? (
              <Link href={`/posts/${next.slug}`} className="dt-prevnext__item dt-prevnext__item--next">
                <span>다음 글 →</span>
                <strong>{next.title}</strong>
              </Link>
            ) : <span />}
          </nav>
        )}

        <CommentSection postId={post.id} />
      </main>
      <aside className="dt-post-aside" aria-label="쿠팡 바로가기">
        <WingBanner />
      </aside>
      </div>

      {related.length > 0 && (
        <section className="dt-band dt-band--cream dt-related">
          <div className="dt-wrap">
            <h2 className="dt-section__title">함께 읽으면 좋은 글</h2>
            <div className="dt-grid dt-grid--4">
              {related.map((p) => <EditorialCard key={p.id} post={p} compact />)}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
