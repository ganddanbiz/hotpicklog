import Link from "next/link";
import { Post } from "@/types";
import PostShareButton from "./PostShareButton";
import AdBanner from "./AdBanner";
import { proxyUrl } from "@/lib/imageProxy";

interface PostCardProps {
  posts: Partial<Post>[];
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

// Top border accent per category
const catAccent: Record<string, string> = {
  식품:     "#e85d04",
  가전:     "#0077b6",
  생활:     "#2d6a4f",
  패션:     "#7b2d8b",
  뷰티:     "#c77dff",
  스포츠:   "#1b4332",
  육아:     "#f48c06",
  반려동물: "#6d4c41",
  상품리뷰: "#e63946",
};

function getLevelBadge(slug?: string): { cls: string; label: string } | null {
  if (!slug) return null;
  if (slug.startsWith("basic-")) return { cls: "badge badge-basic", label: "기초" };
  if (slug.startsWith("mid-"))   return { cls: "badge badge-mid",   label: "중급" };
  if (slug.startsWith("adv-"))   return { cls: "badge badge-adv",   label: "고급" };
  return null;
}

const CHUNK_SIZE = 6;

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export default function PostCard({ posts }: PostCardProps) {
  if (posts.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "5rem 1rem", color: "var(--ink-muted)" }}>
        <p>아직 게시된 글이 없습니다.</p>
      </div>
    );
  }

  const adSlot = process.env.NEXT_PUBLIC_ADSENSE_SLOT_LIST || "";
  const chunks = chunkArray(posts, CHUNK_SIZE);
  const gridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
    gap: "1rem",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {chunks.map((chunk, chunkIndex) => (
        <div key={chunkIndex}>
          <div style={gridStyle}>
            {chunk.map((post) => {
              const cat = post.category || "상품리뷰";
              const level = getLevelBadge(post.slug);
              const accent = catAccent[cat] || "var(--accent)";
              const publishedDate = post.published_at
                ? new Date(post.published_at).toLocaleDateString("ko-KR")
                : "";

              return (
                <Link
                  key={post.id}
                  href={`/posts/${post.slug}`}
                  className="post-card"
                  style={{ borderTop: `3px solid ${accent}` }}
                >
                  {post.thumbnail_url ? (
                    <div className="post-card-thumb">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={proxyUrl(post.thumbnail_url!)}
                        alt={post.title || ""}
                        style={{ width: "100%", height: "100%", objectFit: "contain", background: "#f8f8f8", display: "block" }}
                      />
                    </div>
                  ) : (
                    <div className="post-card-placeholder">
                      <span style={{ fontSize: "2rem", opacity: 0.4 }}>🏛</span>
                    </div>
                  )}

                  <div className="post-card-body">
                    <div style={{ display: "flex", gap: "0.35rem", marginBottom: "0.6rem", flexWrap: "wrap" }}>
                      <span className={catBadgeClass[cat] || "badge"}>{catLabels[cat] || cat}</span>
                      {level && <span className={level.cls}>{level.label}</span>}
                    </div>

                    <h2 className="post-card-title">{post.title}</h2>

                    {post.meta_description && (
                      <p style={{
                        fontSize: "0.75rem",
                        color: "var(--ink-muted)",
                        lineHeight: 1.6,
                        marginBottom: "0.75rem",
                        display: "-webkit-box",
                        WebkitBoxOrient: "vertical",
                        WebkitLineClamp: 2,
                        overflow: "hidden",
                      }}>
                        {post.meta_description}
                      </p>
                    )}

                    <div style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      fontSize: "0.6875rem", color: "var(--ink-faint)", marginTop: "auto",
                      paddingTop: "0.5rem", borderTop: "1px solid var(--border-light)",
                    }}>
                      <span>{publishedDate || ""} · 조회 {(post.view_count || 0).toLocaleString()}</span>
                      <PostShareButton slug={post.slug || ""} title={post.title || ""} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
          {chunkIndex < chunks.length - 1 && (
            <div style={{ marginTop: "1rem" }}>
              <AdBanner slot={adSlot} format="horizontal" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
