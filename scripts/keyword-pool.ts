/**
 * 생활용품 상품 후보 키워드 풀
 *
 * pick-product.ts가 이 풀을 읽어 → 네이버 데이터랩으로 트렌드를 재고
 * → 상승 중인 상위 키워드를 상품 후보로 추립니다.
 *
 * 여기에 없는 키워드는 절대 후보로 뽑히지 않습니다. 새 아이디어가 생기면
 * 이 파일에 한 줄 추가하세요.
 *
 * ⚠️ category를 반드시 맞게 넣으세요 (2026-08-01 실측으로 전면 교정).
 *    데이터랩은 "그 카테고리 안에서의 클릭 비중"만 주기 때문에, 카테고리가 틀리면
 *    지수가 0으로 나와 후보에서 조용히 탈락합니다.
 *    실제로 있었던 오분류 — 전부 생활/건강으로 넣어 뒀다가 죽어 있던 것들:
 *      전기장판  생활/건강 0.11  →  디지털/가전 66.02
 *      온수매트  생활/건강 0.04  →  디지털/가전 48.26
 *      핫팩     생활/건강 0.10  →  스포츠/레저 63.40
 *      물티슈    생활/건강 0.04  →  출산/육아  84.40
 *      제습기    생활/건강 0.00  →  디지털/가전 59.20
 */

export type Season = "spring" | "summer" | "fall" | "winter" | "all";

export interface PoolKeyword {
  keyword: string; // 데이터랩 트렌드 + 네이버쇼핑 검색에 쓰는 키워드
  seasons: Season[]; // 이 키워드를 밀 시즌 (all = 연중)
  category?: string; // 데이터랩 카테고리 코드 (기본: 생활/건강)
}

// ── 데이터랩 쇼핑인사이트 대분류 코드 ──────────
export const CAT_APPLIANCE = "50000003"; // 디지털/가전
export const CAT_INTERIOR = "50000004"; // 가구/인테리어
export const CAT_BABY = "50000005"; // 출산/육아
export const CAT_SPORTS = "50000007"; // 스포츠/레저
export const CAT_LIVING = "50000008"; // 생활/건강

export const DEFAULT_CATEGORY = CAT_LIVING;

/**
 * 카테고리별 앵커 키워드 — 배치 간 점수 정규화 기준(= 수요지수 100).
 *
 * 앵커 조건: ① 그 카테고리에서 지수가 꾸준히 중간~높게 나올 것
 *            ② 계절 변동이 작을 것  ③ 풀에 없는 키워드일 것(후보를 잡아먹지 않게)
 * 지수가 0에 가까운 키워드를 앵커로 쓰면 heat = 대상/앵커 가 폭발한다.
 * (구 앵커 '물티슈'는 생활/건강에서 0.04라 수요지수가 317641 같은 값으로 터졌었다)
 *
 * 2026-08-01 실측 (평균 / 변동계수):
 *   전자레인지 84.2 / 5%   세탁세제 89.7 / 낮음   방석 49.6 / 8%
 *   러그 50.6 / 5% (풀에 있어 제외)   커튼 56.8 / 12%
 */
export const CATEGORY_ANCHORS: Record<string, string> = {
  [CAT_LIVING]: "세탁세제",
  [CAT_APPLIANCE]: "전자레인지",
  [CAT_INTERIOR]: "방석",
  // 출산/육아는 물티슈가 카테고리 클릭을 사실상 독식(82.4)해서 마땅한 대형 앵커가 없다.
  // 그중 가장 안정적인 카시트(17.6/CV12%)를 쓴다 → 물티슈 지수가 400대로 크게 나오는 건 정상.
  [CAT_BABY]: "카시트",
  [CAT_SPORTS]: "등산스틱",
};

export const KEYWORD_POOL: PoolKeyword[] = [
  // ── 여름 ──────────────────────────────
  { keyword: "제습제", seasons: ["summer"] },
  { keyword: "곰팡이제거제", seasons: ["summer"] },
  { keyword: "빨래건조대", seasons: ["summer", "all"] },
  { keyword: "제습기", seasons: ["summer"], category: CAT_APPLIANCE },
  { keyword: "모기퇴치기", seasons: ["summer"], category: CAT_APPLIANCE },
  { keyword: "휴대용선풍기", seasons: ["summer"], category: CAT_APPLIANCE },
  { keyword: "제빙기", seasons: ["summer"], category: CAT_APPLIANCE },
  { keyword: "쿨매트", seasons: ["summer"], category: CAT_INTERIOR },
  { keyword: "냉감패드", seasons: ["summer"], category: CAT_INTERIOR },
  { keyword: "발매트", seasons: ["summer", "all"], category: CAT_INTERIOR },

  // ── 가을 ──────────────────────────────
  { keyword: "가습기", seasons: ["fall", "winter"], category: CAT_APPLIANCE },
  { keyword: "전기요", seasons: ["fall", "winter"], category: CAT_APPLIANCE },
  { keyword: "극세사이불", seasons: ["fall", "winter"], category: CAT_INTERIOR },
  { keyword: "러그", seasons: ["fall", "winter"], category: CAT_INTERIOR },
  { keyword: "핫팩", seasons: ["fall", "winter"], category: CAT_SPORTS },

  // ── 겨울 ──────────────────────────────
  { keyword: "전기장판", seasons: ["winter"], category: CAT_APPLIANCE },
  { keyword: "온수매트", seasons: ["winter"], category: CAT_APPLIANCE },
  { keyword: "히터", seasons: ["winter"], category: CAT_APPLIANCE },
  { keyword: "손난로", seasons: ["winter"], category: CAT_SPORTS },
  { keyword: "정전기방지", seasons: ["winter"] },
  { keyword: "결로방지", seasons: ["winter"] },

  // ── 봄 ────────────────────────────────
  { keyword: "공기청정기필터", seasons: ["spring"], category: CAT_APPLIANCE },
  { keyword: "미세먼지마스크", seasons: ["spring"] },
  { keyword: "창문청소", seasons: ["spring"] },
  { keyword: "청소포", seasons: ["spring", "all"] },
  { keyword: "돌돌이", seasons: ["spring", "all"] },

  // ── 연중 (스테디셀러) ──────────────────
  // ※ 세탁세제는 생활/건강 앵커라 후보에서 자동 제외됩니다.
  { keyword: "물티슈", seasons: ["all"], category: CAT_BABY },
  { keyword: "칫솔살균기", seasons: ["all"], category: CAT_APPLIANCE },
  { keyword: "키친타월", seasons: ["all"] },
  { keyword: "롤화장지", seasons: ["all"] },
  { keyword: "지퍼백", seasons: ["all"] },
  { keyword: "주방세제", seasons: ["all"] },
  { keyword: "섬유유연제", seasons: ["all"] },
  { keyword: "욕실세제", seasons: ["all"] },
  { keyword: "락스", seasons: ["all"] },
  { keyword: "수세미", seasons: ["all"] },
  { keyword: "고무장갑", seasons: ["all"] },
  { keyword: "밀폐용기", seasons: ["all"] },
  { keyword: "옷걸이", seasons: ["all"] },
  { keyword: "압축팩", seasons: ["all"] },
  { keyword: "수납정리함", seasons: ["all"] },
  { keyword: "욕실화", seasons: ["all"] },
  { keyword: "샤워기필터", seasons: ["all"] },

  // 2026-08-01 제거 — 어느 카테고리에서도 지수가 잡히지 않거나 중복:
  //   종량제봉투(0.4) · 청소세제(0.6→욕실세제로 대체) · 욕실곰팡이(곰팡이제거제와 중복)
  //   실내빨래건조대(1.6, 빨래건조대와 중복)
];

/** 월(1~12)을 시즌으로 매핑 */
export function seasonForMonth(month: number): Season {
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "fall";
  return "winter";
}

/** 키워드가 속한 데이터랩 카테고리 (미지정이면 생활/건강) */
export function categoryOf(k: PoolKeyword): string {
  return k.category ?? DEFAULT_CATEGORY;
}

/** 카테고리의 앵커 키워드 */
export function anchorOf(category: string): string {
  const a = CATEGORY_ANCHORS[category];
  if (!a) throw new Error(`카테고리 ${category}의 앵커가 CATEGORY_ANCHORS에 없습니다.`);
  return a;
}
