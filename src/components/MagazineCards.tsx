import Link from "next/link";
import { Post } from "@/types";
import { proxyUrl } from "@/lib/imageProxy";
import { categoryLabel, contentType, CONTENT_TYPE_LABEL, formatDate, outline } from "@/lib/catalog";

type P = Partial<Post>;

function Thumb({ post, ratio, eager }: { post: P; ratio: "4/3" | "1/1" | "hero"; eager?: boolean }) {
  return (
    <div className={`dt-thumb dt-thumb--${ratio === "4/3" ? "43" : ratio === "1/1" ? "11" : "hero"}`}>
      {post.thumbnail_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={proxyUrl(post.thumbnail_url)}
          alt=""
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : undefined}
          decoding="async"
        />
      ) : (
        <span className="dt-thumb__empty" aria-hidden="true">득</span>
      )}
    </div>
  );
}

function TypeTag({ slug }: { slug?: string }) {
  const t = contentType(slug);
  return <span className={`dt-type dt-type--${t}`}>{CONTENT_TYPE_LABEL[t]}</span>;
}

export function FeaturedCard({ post }: { post: P }) {
  return (
    <Link href={`/posts/${post.slug}`} className="dt-featured">
      <Thumb post={post} ratio="hero" eager />
      <div className="dt-featured__body">
        <p className="dt-eyebrow">
          <span className="dt-eyebrow__pick">Editor&apos;s Pick</span>
          <span>{categoryLabel(post.category)}</span>
        </p>
        <h2 className="dt-featured__title">{post.title}</h2>
        {post.meta_description && <p className="dt-featured__desc">{post.meta_description}</p>}
        <p className="dt-meta">
          <TypeTag slug={post.slug} />
          <time dateTime={String(post.published_at ?? "")}>{formatDate(post.published_at, true)}</time>
        </p>
        <span className="dt-featured__more">읽어보기 →</span>
      </div>
    </Link>
  );
}

export function EditorialCard({ post, compact }: { post: P; compact?: boolean }) {
  return (
    <Link href={`/posts/${post.slug}`} className={`dt-card${compact ? " dt-card--compact" : ""}`}>
      <Thumb post={post} ratio="4/3" />
      <div className="dt-card__body">
        <p className="dt-card__cat">{categoryLabel(post.category)}</p>
        <h3 className="dt-card__title">{post.title}</h3>
        {!compact && post.meta_description && <p className="dt-card__desc">{post.meta_description}</p>}
        <p className="dt-meta">
          <TypeTag slug={post.slug} />
          <time dateTime={String(post.published_at ?? "")}>{formatDate(post.published_at)}</time>
        </p>
      </div>
    </Link>
  );
}

export function BuyingGuideCard({ post }: { post: P }) {
  const points = outline(post.content, 3);
  return (
    <Link href={`/posts/${post.slug}`} className="dt-guide">
      <Thumb post={post} ratio="1/1" />
      <div className="dt-guide__body">
        <span className="dt-type dt-type--guide">구매 가이드</span>
        <h3 className="dt-guide__title">{post.title}</h3>
        {points.length > 0 && (
          <>
            <p className="dt-guide__label">이 글에서 확인할 것</p>
            <ul className="dt-guide__points">
              {points.map((p) => <li key={p}>{p}</li>)}
            </ul>
          </>
        )}
        <span className="dt-guide__more">가이드 읽기 →</span>
      </div>
    </Link>
  );
}

export function RankList({ posts }: { posts: P[] }) {
  return (
    <ol className="dt-rank">
      {posts.map((p, i) => (
        <li key={p.id}>
          <Link href={`/posts/${p.slug}`}>
            <span className="dt-rank__no" aria-hidden="true">{i + 1}</span>
            <span className="dt-rank__text">
              <span className="dt-rank__title">{p.title}</span>
              <span className="dt-rank__meta">{categoryLabel(p.category)} · 조회 {(p.view_count ?? 0).toLocaleString()}</span>
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

export function SectionHead({ title, lead, href, more = "더 보기" }: { title: string; lead?: string; href?: string; more?: string }) {
  return (
    <div className="dt-section__head">
      <div>
        <h2 className="dt-section__title">{title}</h2>
        {lead && <p className="dt-section__lead">{lead}</p>}
      </div>
      {href && <Link href={href} className="dt-section__more">{more} →</Link>}
    </div>
  );
}
