import Link from "next/link";
import { Post } from "@/types";
import PostShareButton from "./PostShareButton";
import AdBanner from "./AdBanner";
import { proxyUrl, proxyImagesInHtml } from "@/lib/imageProxy";

interface PostListProps {
  posts: Partial<Post>[];
}

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

function getLevelBadge(slug?: string): { cls: string; label: string } | null {
  if (!slug) return null;
  if (slug.startsWith("basic-")) return { cls: "badge badge-basic", label: "기초" };
  if (slug.startsWith("mid-"))   return { cls: "badge badge-mid",   label: "중급" };
  if (slug.startsWith("adv-"))   return { cls: "badge badge-adv",   label: "고급" };
  return null;
}

export default function PostList({ posts }: PostListProps) {
  if (posts.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "5rem 1rem", color: "var(--ink-muted)" }}>
        <p style={{ fontSize: "1rem" }}>아직 게시된 글이 없습니다.</p>
      </div>
    );
  }

  const adSlot = process.env.NEXT_PUBLIC_ADSENSE_SLOT_LIST || "";

  return (
    <div>
      {posts.map((post, index) => {
        const cat = post.category || "상품리뷰";
        const level = getLevelBadge(post.slug);
        const publishedDate = post.published_at
          ? new Date(post.published_at).toLocaleDateString("ko-KR", {
              year: "numeric", month: "long", day: "numeric",
            })
          : "";

        return (
          <div key={post.id}>
          <article className="feed-article">

            {/* 메타 */}
            <div style={{
              display: "flex", alignItems: "center", gap: "0.4rem",
              marginBottom: "0.875rem", flexWrap: "wrap",
            }}>
              <span className={catBadgeClass[cat] || "badge"}>
                {catLabels[cat] || cat}
              </span>
              {level && <span className={level.cls}>{level.label}</span>}
              {publishedDate && (
                <span style={{ fontSize: "0.75rem", color: "var(--ink-faint)", marginLeft: "0.25rem" }}>
                  {publishedDate}
                </span>
              )}
              <span style={{ fontSize: "0.75rem", color: "var(--ink-faint)" }}>
                · 조회 {(post.view_count || 0).toLocaleString()}
              </span>
            </div>

            {/* 제목 */}
            <Link href={`/posts/${post.slug}`} className="feed-title">
              {post.title}
            </Link>

            {/* 썸네일 */}
            {post.thumbnail_url && (
              <div style={{
                position: "relative", width: "100%", height: "18rem",
                margin: "1.25rem 0", borderRadius: "10px", overflow: "hidden",
                border: "1px solid var(--border)",
              }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={proxyUrl(post.thumbnail_url!)}
                    alt={post.title || ""}
                    style={{ width: "100%", height: "100%", objectFit: "contain", background: "#f8f8f8", display: "block" }}
                  />
              </div>
            )}

            {/* 본문 */}
            {post.content && (
              <div
                className="prose"
                style={{ marginTop: "1.25rem" }}
                dangerouslySetInnerHTML={{ __html: proxyImagesInHtml(post.content) }}
              />
            )}

            {/* 하단 */}
            <div style={{
              marginTop: "1.75rem",
              paddingTop: "1.25rem",
              borderTop: "1px solid var(--border-light)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
            }}>
              <Link href={`/posts/${post.slug}`} className="feed-more-link">
                댓글 · 좋아요 보기 →
              </Link>
              <PostShareButton slug={post.slug || ""} title={post.title || ""} />
            </div>
          </article>
          {index % 3 === 2 && index < posts.length - 1 && (
            <div className="feed-ad-slot">
              <AdBanner slot={adSlot} format="horizontal" />
            </div>
          )}
          </div>
        );
      })}
    </div>
  );
}
