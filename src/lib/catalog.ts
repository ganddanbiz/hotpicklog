// 득템로그 2.0 — 카테고리·글 유형·시즌 큐레이션 공통 정의
// 카테고리 key는 DB `posts.category` 값과 `/?category=` 주소에 그대로 쓰이므로 바꾸지 않는다.

export const CATEGORIES: { key: string; label: string }[] = [
  { key: "생활",     label: "생활·주방" },
  { key: "가전",     label: "가전·디지털" },
  { key: "식품",     label: "식품" },
  { key: "패션",     label: "패션·의류" },
  { key: "뷰티",     label: "뷰티·건강" },
  { key: "스포츠",   label: "스포츠·레저" },
  { key: "육아",     label: "육아·완구" },
  { key: "반려동물", label: "반려동물" },
  { key: "상품리뷰", label: "상품 소개" },
];

export function categoryLabel(key?: string | null): string {
  if (!key) return "";
  return CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

// 글 유형 — DB 컬럼 없이 slug 규칙으로 판별한다 (product-NNN / basic·mid·adv-NNN / auto-…)
// 실사용 여부를 확인할 수 없으므로 상품 글은 '리뷰'가 아니라 '상품 소개'로 표기한다.
export type ContentType = "product" | "guide";

export function contentType(slug?: string | null): ContentType {
  return slug?.startsWith("product-") ? "product" : "guide";
}

export const CONTENT_TYPE_LABEL: Record<ContentType, string> = {
  product: "상품 소개",
  guide: "구매 가이드",
};

export const GUIDE_SLUG_SQL = "(slug LIKE 'basic-%' OR slug LIKE 'mid-%' OR slug LIKE 'adv-%' OR slug LIKE 'auto-%')";

// 시즌 큐레이션 — 달마다 제목 키워드로 글을 고른다. 맞는 글이 2개 미만이면 섹션을 숨긴다.
export function seasonCuration(date = new Date()): { title: string; lead: string; keywords: string[] } {
  const m = date.getMonth() + 1;
  if (m >= 10 || m <= 2) {
    return {
      title: "찬바람 불기 전에, 겨울 준비 득템",
      lead: "이불·난방·가습처럼 추워지면 바로 찾게 되는 물건들을 모았어요.",
      keywords: ["이불", "극세사", "가습", "손난로", "전기요", "전기장판", "난방", "보온", "겨울", "히터", "담요"],
    };
  }
  if (m <= 5) {
    return {
      title: "봄맞이 정리·청소 득템",
      lead: "옷장 바꾸고 집 정리할 때 쓸모 있는 물건들을 모았어요.",
      keywords: ["정리", "수납", "청소", "압축", "봄", "옷장", "세탁"],
    };
  }
  if (m <= 8) {
    return {
      title: "더위·습기 잡는 여름 득템",
      lead: "덥고 눅눅한 계절을 버티게 해 줄 물건들을 모았어요.",
      keywords: ["선풍기", "제습", "여름", "쿨", "냉감", "모기", "자외선", "선크림"],
    };
  }
  return {
    title: "환절기 살림 득템",
    lead: "아침저녁 기온 차가 커질 때 미리 챙겨 두면 좋은 물건들이에요.",
    keywords: ["이불", "가습", "환절기", "수납", "정리", "보온", "차렵"],
  };
}

export function formatDate(d?: string | Date | null, long = false): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("ko-KR", long
    ? { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Seoul" }
    : { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Seoul" });
}

// 본문 h2에서 이모지·태그를 걷어 "이 글에서 다루는 것" 목록을 만든다 (가이드 카드용)
export function outline(html?: string | null, max = 3): string[] {
  if (!html) return [];
  const out: string[] = [];
  const re = /<h2[^>]*>([\s\S]*?)(?:<figure|<\/h2>)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < max) {
    const text = m[1]
      .replace(/<[^>]+>/g, "")
      .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "")
      .replace(/\s+/g, " ")
      .trim();
    if (text && !/^(FAQ|자주 묻는)/.test(text)) out.push(text);
  }
  return out;
}
