/** 네이버 CDN 이미지 URL → 프록시 URL 변환 */
export function proxyUrl(src: string): string {
  if (!src) return src;
  if (src.startsWith("/")) return src; // 이미 로컬
  return `/api/image-proxy?url=${encodeURIComponent(src)}`;
}

/** HTML 내 모든 <img src="..."> 를 프록시 URL로 교체 */
export function proxyImagesInHtml(html: string): string {
  return html.replace(
    /(<img[^>]*?\s)src="(https?:\/\/[^"]+)"/g,
    (_, prefix, url) => `${prefix}src="${proxyUrl(url)}"`
  );
}
