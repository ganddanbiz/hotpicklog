import { Post } from "@/types";
import { categoryLabel } from "@/lib/catalog";

interface JsonLdProps {
  post: Post;
}

export default function JsonLd({ post }: JsonLdProps) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "내 블로그";

  const article = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.meta_description || "",
    datePublished: post.published_at || post.created_at,
    dateModified: post.updated_at,
    author: {
      "@type": "Organization",
      name: siteName,
      url: siteUrl,
    },
    publisher: {
      "@type": "Organization",
      name: siteName,
      url: siteUrl,
    },
    mainEntityOfPage: `${siteUrl}/posts/${post.slug}`,
    url: `${siteUrl}/posts/${post.slug}`,
    ...(post.thumbnail_url && { image: post.thumbnail_url }),
    keywords: post.keywords || "",
  };

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: siteName, item: siteUrl },
      {
        "@type": "ListItem", position: 2, name: categoryLabel(post.category),
        item: `${siteUrl}/?view=card&category=${encodeURIComponent(post.category)}`,
      },
      { "@type": "ListItem", position: 3, name: post.title, item: `${siteUrl}/posts/${post.slug}` },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify([article, breadcrumb]) }}
    />
  );
}
