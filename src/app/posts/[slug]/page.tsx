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

export const revalidate = 3600;

type Props = { params: Promise<{ slug: string }> };

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
    openGraph: {
      title: post.title,
      description: post.meta_description || post.title,
      url: `${siteUrl}/posts/${post.slug}`,
      type: "article",
      publishedTime: post.published_at || post.created_at,
      modifiedTime: post.updated_at,
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

const catLabels: Record<string, string> = {
  식품:     "식품",
  가전:     "가전·디지털",
  생활:     "생활·주방",
  패션:     "패션·의류",
  뷰티:     "뷰티·건강",
  스포츠:   "스포츠·레저",
  육아:     "육아·완구",
  반려동물: "반려동물",
  상품리뷰: "상품리뷰",
};
const catBadgeClass: Record<string, string> = {
  식품:     "badge badge-before",
  가전:     "badge badge-bidding",
  생활:     "badge badge-after",
  패션:     "badge badge-tax",
  뷰티:     "badge badge-law",
  스포츠:   "badge badge-ai",
  육아:     "badge badge-basic",
  반려동물: "badge badge-mid",
  상품리뷰: "badge badge-adv",
};

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  await pool.query("UPDATE posts SET view_count = view_count + 1 WHERE id = $1", [post.id]);
  const likeCount = await getLikeCount(post.id);

  const publishedDate = post.published_at
    ? new Date(post.published_at).toLocaleDateString("ko-KR", {
        year: "numeric", month: "long", day: "numeric",
      })
    : null;

  const levelLabel = post.slug?.startsWith("basic-") ? "기초"
    : post.slug?.startsWith("mid-") ? "중급"
    : post.slug?.startsWith("adv-") ? "고급"
    : null;
  const levelCls = levelLabel === "기초" ? "badge badge-basic"
    : levelLabel === "중급" ? "badge badge-mid"
    : "badge badge-adv";

  return (
    <>
      <JsonLd post={post} />
      <div style={{ background: "var(--bg)", minHeight: "100vh" }}>

        {/* ── 상단 내비 ─────────────────────────── */}
        <header style={{
          background: "var(--header-bg)",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
        }}>
          <div style={{
            maxWidth: "52rem", margin: "0 auto",
            padding: "0.875rem 1.5rem",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <Link href="/" style={{
              fontSize: "1.0625rem",
              fontWeight: 900,
              color: "#ffffff",
              textDecoration: "none",
              letterSpacing: "-0.02em",
            }}>
              {process.env.NEXT_PUBLIC_SITE_NAME || "득템로그"}
            </Link>
            <Link href="/" style={{
              fontSize: "0.75rem",
              color: "var(--header-muted)",
              textDecoration: "none",
              display: "flex", alignItems: "center", gap: "0.3rem",
              padding: "0.3rem 0.75rem",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "999px",
              transition: "border-color 0.15s",
            }}>
              ← 목록으로
            </Link>
          </div>
        </header>

        <main className="main-px" style={{ maxWidth: "52rem", margin: "0 auto" }}>

          {/* ── 아티클 ─────────────────────────── */}
          <article className="article-pad" style={{
            background: "var(--bg-card)",
            borderRadius: "0 0 16px 16px",
            border: "1px solid var(--border)",
            borderTop: "none",
            marginBottom: "2rem",
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
          }}>

            {/* 메타 */}
            <div style={{
              display: "flex", alignItems: "center", gap: "0.4rem",
              marginBottom: "1.25rem", flexWrap: "wrap",
            }}>
              <span className={catBadgeClass[post.category] || "badge"}>
                {catLabels[post.category] || post.category}
              </span>
              {levelLabel && (
                <span className={levelCls}>{levelLabel}</span>
              )}
              {publishedDate && (
                <span style={{ fontSize: "0.75rem", color: "var(--ink-faint)", marginLeft: "0.25rem" }}>
                  {publishedDate}
                </span>
              )}
              <span style={{ fontSize: "0.75rem", color: "var(--ink-faint)" }}>
                · 조회 {post.view_count.toLocaleString()}
              </span>
            </div>

            {/* 제목 */}
            <h1 style={{
              fontFamily: "var(--font-serif)",
              fontSize: "clamp(1.5rem, 3.5vw, 2rem)",
              fontWeight: 800,
              lineHeight: 1.35,
              letterSpacing: "-0.01em",
              color: "var(--ink)",
              marginBottom: "2rem",
            }}>
              {post.title}
            </h1>

            {/* 구분선 */}
            <div style={{
              display: "flex", alignItems: "center", gap: "0.75rem",
              marginBottom: "2rem",
            }}>
              <div style={{ width: "2.5rem", height: "3px", background: "var(--accent)", borderRadius: "2px" }} />
              <span style={{ fontSize: "0.75rem", color: "var(--ink-faint)", fontWeight: 600, letterSpacing: "0.05em" }}>
                {process.env.NEXT_PUBLIC_SITE_NAME || "운영자"}
              </span>
            </div>

            {/* 썸네일 */}
            {post.thumbnail_url && (
              <div style={{
                marginBottom: "2.5rem", borderRadius: "10px", overflow: "hidden",
                border: "1px solid var(--border)",
              }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={proxyUrl(post.thumbnail_url)}
                  alt={post.title}
                  style={{ width: "100%", height: "auto", display: "block", background: "#f8f8f8" }}
                />
              </div>
            )}

            {/* 쿠팡 다이내믹 광고 */}
            <CoupangAd />

            {/* 본문 */}
            <div
              className="prose"
              dangerouslySetInnerHTML={{ __html: proxyImagesInHtml(post.content) }}
            />

            {/* 좋아요 & 공유 */}
            <div style={{
              marginTop: "2.5rem",
              paddingTop: "1.5rem",
              borderTop: "1px solid var(--border)",
              display: "flex", alignItems: "center", gap: "0.75rem",
            }}>
              <LikeButton postId={post.id} initialCount={likeCount} />
              <ShareButton title={post.title} />
            </div>
          </article>

          {/* ── 댓글 ────────────────────────────── */}
          <CommentSection postId={post.id} />
          <div style={{ height: "3rem" }} />
        </main>
      </div>
    </>
  );
}
