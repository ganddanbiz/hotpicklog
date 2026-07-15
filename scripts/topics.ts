/**
 * 블로그 주제 목록 — 득템로그 (쿠팡 파트너스 상품 소개 블로그)
 *
 * 발행 우선순위:
 *  1. products.json 에 미발행 상품이 있으면 → 상품 리뷰 글 발행
 *  2. 상품이 없으면 → 아래 topics 기반 "쇼핑·득템 가이드" 글 발행
 *
 * ⚠️ 이 블로그는 "상품을 소개하는 블로그"입니다.
 * 일반 주제도 반드시 쇼핑·구매·가성비·득템 맥락의 실용 정보로만 구성합니다.
 * ("고급 접근법", "핵심 개념 10가지" 같은 정체불명 껍데기 주제 금지)
 */

export interface Topic {
  index: number;
  slug: string;
  level: "기초편" | "중급편" | "고급편";
  /** 저장되는 카테고리 라벨 (자유 문자열, DB 제약 없음) */
  category: string;
  title: string;
  keywords: string;
  meta_description: string;
}

// ── 득템로그 일반 주제 (쇼핑·득템 가이드) ──────────────────
export const allTopics: Topic[] = [
  {
    index: 1, slug: "basic-001", level: "기초편", category: "쇼핑정보",
    title: "쿠팡에서 진짜 가성비 상품만 골라내는 법 🛒",
    keywords: "가성비,쿠팡쇼핑,상품고르는법,알뜰구매",
    meta_description: "수많은 상품 중에서 진짜 가성비 좋은 제품만 골라내는 실전 체크리스트를 정리했어요.",
  },
  {
    index: 2, slug: "basic-002", level: "기초편", category: "쇼핑정보",
    title: "상품 후기·별점 제대로 읽는 법, 이것만 보면 돼요 ⭐",
    keywords: "상품후기,별점보는법,리뷰분석,구매실패방지",
    meta_description: "겉보기 별점에 속지 않고 진짜 좋은 상품을 가려내는 후기 읽는 요령을 알려드려요.",
  },
  {
    index: 3, slug: "basic-003", level: "기초편", category: "쇼핑정보",
    title: "온라인 최저가 찾는 5가지 방법 💸",
    keywords: "최저가,가격비교,할인,알뜰쇼핑",
    meta_description: "같은 상품을 조금이라도 더 싸게 사는, 온라인 최저가 찾는 현실적인 방법 5가지.",
  },
  {
    index: 4, slug: "mid-001", level: "중급편", category: "생활",
    title: "계절 바뀌기 전에 미리 사두면 이득인 생활용품 🍂",
    keywords: "계절준비,미리구매,생활용품,세일타이밍",
    meta_description: "제철 지나 비싸지기 전에 미리 사두면 돈 버는 생활용품 리스트를 정리했어요.",
  },
  {
    index: 5, slug: "mid-002", level: "중급편", category: "쇼핑정보",
    title: "로켓배송 200% 활용하는 꿀팁 모음 🚀",
    keywords: "로켓배송,쿠팡꿀팁,빠른배송,활용법",
    meta_description: "로켓배송을 알뜰하고 똑똑하게 쓰는 실전 꿀팁을 한데 모았어요.",
  },
  {
    index: 6, slug: "mid-003", level: "중급편", category: "생활",
    title: "사놓고 후회 없는 '재구매율 높은' 생활필수템 👍",
    keywords: "재구매,생활필수템,만족도,꾸준템",
    meta_description: "한 번 써보면 계속 사게 되는, 재구매율 높은 생활필수템만 골라 소개해요.",
  },
  {
    index: 7, slug: "adv-001", level: "고급편", category: "쇼핑정보",
    title: "할인 시즌(블프·광클절) 제대로 공략하는 법 🔥",
    keywords: "블랙프라이데이,쿠팡할인,세일공략,쇼핑전략",
    meta_description: "대형 할인 시즌에 정말 필요한 것만 싸게 쓸어 담는 공략법을 정리했어요.",
  },
  {
    index: 8, slug: "adv-002", level: "고급편", category: "쇼핑정보",
    title: "와우 멤버십, 이렇게 쓰면 회비 본전 뽑아요 💳",
    keywords: "와우멤버십,쿠팡회원,혜택정리,본전",
    meta_description: "쿠팡 와우 멤버십 회비 이상으로 뽑아 쓰는 실속 활용법을 알려드려요.",
  },
  {
    index: 9, slug: "adv-003", level: "고급편", category: "쇼핑정보",
    title: "묶음·대용량 구매, 진짜 이득일 때 vs 손해일 때 📦",
    keywords: "대용량,묶음구매,단가비교,알뜰쇼핑",
    meta_description: "대용량·묶음 구매가 정말 이득인 경우와 오히려 손해인 경우를 단가로 따져봤어요.",
  },
];
