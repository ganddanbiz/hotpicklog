/**
 * 생활용품 상품 후보 자동 선정 → 텔레그램 보고
 *
 * 흐름:
 *   1. 현재 시즌에 맞는 키워드를 keyword-pool.ts에서 추림
 *   2. 이미 발행한 상품(products.json)과 겹치는 키워드 제외
 *   3. 네이버 데이터랩으로 트렌드(수요지수·상승세) 측정 — 카테고리별로 나눠 조회
 *   4. 상위 N개에 대해 네이버 쇼핑에서 대표 상품·시세 조회(가능할 때만)
 *   5. 텔레그램으로 후보 목록 보고 (대표님이 쿠팡 링크만 복사해 product:add)
 *
 * 실행:
 *   npm run product:pick            # 후보 5개 → 텔레그램 전송
 *   npm run product:pick -- --dry   # 전송 안 하고 콘솔 출력만
 *   npm run product:pick -- --top=8 # 후보 개수 조정
 *   npm run product:pick -- --season=winter  # 시즌 강제 지정
 *   npm run product:pick -- --audit # 풀 전체 진단(지수 0인 키워드 찾기), 전송 안 함
 *   npm run product:pick -- --audit --from=2025-12-01 --to=2026-02-01  # 겨울 키워드 진단
 *
 * 필요한 환경변수(.env.local 또는 GitHub Secrets):
 *   NAVER_CLIENT_ID / NAVER_CLIENT_SECRET  (데이터랩 쇼핑인사이트)
 *   TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID   (보고용, --dry면 불필요)
 *
 * ── 점수 계산 (2026-08-01 전면 교정) ──────────────────────────────
 *  · 데이터랩 주간 지수에서 **마지막 주는 미완성이라 버린다.**
 *    (실측: 전 키워드가 마지막 주에 일제히 ~30% 낮게 나와 전부 "하락"으로 오판됐음)
 *  · 상승률 rise = 최근 2주 평균 ÷ 직전 4주 평균  → 1.3배 이상이면 급상승(설계서 기준)
 *  · 수요지수 heat = 최근 2주 평균 ÷ **같은 카테고리 앵커**의 최근 2주 평균 × 100
 *  · 정렬은 rise 우선. heat은 카테고리마다 앵커가 달라 카테고리 간 직접 비교가 안 되고,
 *    rise는 키워드 자기 자신의 시간 비교라 카테고리와 무관하게 비교된다.
 *    heat은 "이 키워드가 아예 죽었는지" 거르는 하한선(MIN_HEAT)과 동점 처리에만 쓴다.
 *
 * ⚠️ 네이버 쇼핑 검색 API(/v1/search/shop.json)는 2026-08-01 현재 이 앱에서 404(SE05)로
 *    막혀 있다(image·blog·news는 정상). 시세·대표상품은 자동으로 생략되고 검색 링크만 나간다.
 *    개발자센터에서 쇼핑 API가 열리면 코드 수정 없이 자동으로 다시 표시된다.
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { loadProducts } from "./add-product";
import {
  KEYWORD_POOL,
  PoolKeyword,
  Season,
  seasonForMonth,
  categoryOf,
  anchorOf,
  CAT_APPLIANCE,
  CAT_INTERIOR,
  CAT_BABY,
  CAT_SPORTS,
  CAT_LIVING,
} from "./keyword-pool";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const NAVER_ID = process.env.NAVER_CLIENT_ID;
const NAVER_SECRET = process.env.NAVER_CLIENT_SECRET;
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT = process.env.TELEGRAM_CHAT_ID;

const CATEGORY_NAMES: Record<string, string> = {
  [CAT_APPLIANCE]: "디지털/가전",
  [CAT_INTERIOR]: "가구/인테리어",
  [CAT_BABY]: "출산/육아",
  [CAT_SPORTS]: "스포츠/레저",
  [CAT_LIVING]: "생활/건강",
};

// ── 튜닝 상수 ─────────────────────────────────
const RECENT_WEEKS = 2; // "최근" 구간
const BASE_WEEKS = 4; // 비교 기준 구간
const LOOKBACK_DAYS = 84; // 12주치 조회 (미완성 1주 + 2주 + 4주 + 여유)
const RISE_THRESHOLD = 1.3; // 급상승 판정 (설계서 기준)
const FALL_THRESHOLD = 0.9; // 하락 판정
const MIN_HEAT = 2; // 앵커 대비 2% 미만 = 그 카테고리에서 사실상 지수 없음
const BATCH_SIZE = 4; // 데이터랩은 요청당 키워드 그룹 5개까지 → 앵커 1 + 후보 4

// ── CLI 인자 파싱 ─────────────────────────────
const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const AUDIT = args.includes("--audit");
const topArg = args.find((a) => a.startsWith("--top="));
const TOP_N = topArg ? Math.max(1, Number(topArg.split("=")[1]) || 5) : 5;
const seasonArg = args.find((a) => a.startsWith("--season="));
const FORCED_SEASON = seasonArg ? (seasonArg.split("=")[1] as Season) : null;
// 진단용 조회기간 override — 철 지난 키워드(겨울용품 등)는 그 시즌 구간으로 봐야 살아있는지 안다
const fromArg = args.find((a) => a.startsWith("--from="))?.split("=")[1];
const toArg = args.find((a) => a.startsWith("--to="))?.split("=")[1];

// ── 유틸 ──────────────────────────────────────
const kstNow = () => new Date(Date.now() + 9 * 60 * 60 * 1000);
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const stripTags = (s: string) => s.replace(/<[^>]*>/g, "").trim();
const mean = (xs: number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
const catName = (c: string) => CATEGORY_NAMES[c] ?? c;

interface Candidate {
  keyword: string;
  category: string;
  heat: number; // 같은 카테고리 앵커 대비 수요 지수 (100 = 앵커와 동일)
  rise: number; // 최근 2주 ÷ 직전 4주 (1 = 보합)
  sample?: { title: string; price: number; mall: string };
}

// ── 1. 시즌 필터 + 발행 이력 제외 ─────────────
function pickCandidates(season: Season, all = false): PoolKeyword[] {
  const products = loadProducts();
  const usedBlob = products
    .map((p) => `${p.name} ${p.keywords}`)
    .join(" ")
    .toLowerCase();

  const seen = new Set<string>();
  return KEYWORD_POOL.filter((k) => {
    if (!all && !k.seasons.includes(season) && !k.seasons.includes("all"))
      return false;
    if (k.keyword === anchorOf(categoryOf(k))) return false; // 앵커는 후보에서 제외
    if (seen.has(k.keyword)) return false;
    seen.add(k.keyword);
    // 이미 다룬 상품과 겹치면 제외 (진단 모드에선 전부 본다)
    if (!all && usedBlob.includes(k.keyword.toLowerCase())) return false;
    return true;
  });
}

// ── 2. 데이터랩 트렌드 측정 (카테고리별 앵커 정규화) ──
interface WeeklySeries {
  periods: string[]; // 배치 내 전 키워드의 주(period) 합집합, 오름차순
  byKeyword: Map<string, Map<string, number>>;
}

async function datalabBatch(
  category: string,
  keywords: string[],
  startDate: string,
  endDate: string
): Promise<WeeklySeries> {
  const body = {
    startDate,
    endDate,
    timeUnit: "week",
    category,
    keyword: keywords.map((k) => ({ name: k, param: [k] })),
  };
  const res = await fetch(
    "https://openapi.naver.com/v1/datalab/shopping/category/keywords",
    {
      method: "POST",
      headers: {
        "X-Naver-Client-Id": NAVER_ID!,
        "X-Naver-Client-Secret": NAVER_SECRET!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const err = new Error(`datalab ${res.status}: ${await res.text()}`);
    (err as any).status = res.status;
    throw err;
  }
  const json: any = await res.json();

  // 키워드마다 비어 있는 주가 생긴다(지수가 너무 낮으면 아예 빠짐).
  // 배열 인덱스로 자르면 구간이 밀리므로 period(주 시작일) 기준으로 맞춘다.
  const periodSet = new Set<string>();
  const byKeyword = new Map<string, Map<string, number>>();
  for (const r of json.results ?? []) {
    const m = new Map<string, number>();
    for (const d of r.data ?? []) {
      m.set(d.period, d.ratio);
      periodSet.add(d.period);
    }
    byKeyword.set(r.title, m);
  }
  return { periods: [...periodSet].sort(), byKeyword };
}

/** 미완성 마지막 주를 버리고 최근/기준 구간 평균을 뽑는다. */
function windowMeans(
  periods: string[],
  series: Map<string, number> | undefined
): { recent: number; base: number } {
  const complete = periods.slice(0, -1); // 마지막 주는 아직 진행 중 → 폐기
  const val = (p: string) => series?.get(p) ?? 0; // 빠진 주 = 지수 없음 = 0
  const recentPeriods = complete.slice(-RECENT_WEEKS);
  const basePeriods = complete.slice(-(RECENT_WEEKS + BASE_WEEKS), -RECENT_WEEKS);
  return {
    recent: mean(recentPeriods.map(val)),
    base: mean(basePeriods.map(val)),
  };
}

async function measureTrends(pool: PoolKeyword[]): Promise<Candidate[]> {
  const end = toArg ?? ymd(kstNow());
  const start =
    fromArg ??
    ymd(new Date(new Date(end + "T00:00:00Z").getTime() - LOOKBACK_DAYS * 86400_000));

  // 카테고리별로 묶어야 한다 — 데이터랩은 요청당 카테고리 1개만 받는다.
  const byCategory = new Map<string, string[]>();
  for (const k of pool) {
    const c = categoryOf(k);
    if (!byCategory.has(c)) byCategory.set(c, []);
    byCategory.get(c)!.push(k.keyword);
  }

  const candidates: Candidate[] = [];

  for (const [category, keywords] of byCategory) {
    const anchor = anchorOf(category);
    for (let i = 0; i < keywords.length; i += BATCH_SIZE) {
      const batch = keywords.slice(i, i + BATCH_SIZE);
      const { periods, byKeyword } = await datalabBatch(
        category,
        [anchor, ...batch],
        start,
        end
      );

      const anchorW = windowMeans(periods, byKeyword.get(anchor));
      if (anchorW.recent <= 0) {
        throw new Error(
          `[${catName(category)}] 앵커 '${anchor}'의 최근 지수가 0입니다. ` +
            `keyword-pool.ts의 CATEGORY_ANCHORS를 이 카테고리에서 지수가 꾸준한 키워드로 바꾸세요.`
        );
      }

      for (const kw of batch) {
        const w = windowMeans(periods, byKeyword.get(kw));
        candidates.push({
          keyword: kw,
          category,
          heat: (w.recent / anchorW.recent) * 100,
          rise: w.base > 0 ? w.recent / w.base : 1,
        });
      }
    }
  }

  return candidates;
}

// ── 3. 네이버 쇼핑 대표 상품 조회 (열려 있을 때만) ──
let shopApiAvailable = true;

async function shopSearch(
  keyword: string
): Promise<Candidate["sample"] | undefined> {
  if (!shopApiAvailable) return undefined;
  const url = `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(
    keyword
  )}&display=5&sort=sim`;
  const res = await fetch(url, {
    headers: {
      "X-Naver-Client-Id": NAVER_ID!,
      "X-Naver-Client-Secret": NAVER_SECRET!,
    },
  });
  if (!res.ok) {
    if (res.status === 404 || res.status === 401 || res.status === 403) {
      shopApiAvailable = false;
      console.warn(
        `⚠️ 네이버 쇼핑 검색 API 사용 불가 (${res.status}) — 시세·대표상품은 생략하고 검색 링크만 넣습니다.\n` +
          `   개발자센터(https://developers.naver.com/apps)에서 쇼핑 검색 API가 열리면 자동 복구됩니다.`
      );
    }
    return undefined;
  }
  const json: any = await res.json();
  const it = (json.items ?? [])[0];
  if (!it) return undefined;
  return {
    title: stripTags(it.title),
    price: Number(it.lprice) || 0,
    mall: it.mallName || "",
  };
}

// ── 4. 메시지 구성 ────────────────────────────
function buildMessage(list: Candidate[], season: Season): string {
  const seasonKo: Record<Season, string> = {
    spring: "봄",
    summer: "여름",
    fall: "가을",
    winter: "겨울",
    all: "연중",
  };
  const lines: string[] = [];
  lines.push(`🛒 [득템로그] 이번 주 생활용품 상품 후보 (${seasonKo[season]})`);
  lines.push(
    `기준: 네이버 데이터랩 · 최근 ${RECENT_WEEKS}주 vs 직전 ${BASE_WEEKS}주 · ${ymd(kstNow())}`
  );
  lines.push(`(지수는 같은 카테고리 앵커=100 기준 — 카테고리끼리는 비교하지 마세요)`);
  lines.push("");

  list.forEach((c, idx) => {
    const pct = Math.round((c.rise - 1) * 100);
    const badge =
      c.rise >= RISE_THRESHOLD
        ? `🔥급상승 +${pct}%`
        : c.rise <= FALL_THRESHOLD
          ? `🔻하락 ${pct}%`
          : `➡️보합 ${pct >= 0 ? "+" : ""}${pct}%`;
    lines.push(
      `${idx + 1}. ${c.keyword} ${badge}  (지수 ${Math.round(c.heat)} · ${catName(c.category)})`
    );
    if (c.sample) {
      const price = c.sample.price
        ? `${c.sample.price.toLocaleString()}원`
        : "가격미상";
      lines.push(`   예시: ${c.sample.title} — ${price}`);
    }
    lines.push(
      `   쿠팡 → https://www.coupang.com/np/search?q=${encodeURIComponent(c.keyword)}`
    );
    lines.push(
      `   네이버쇼핑 → https://search.shopping.naver.com/search/all?query=${encodeURIComponent(c.keyword)}`
    );
    lines.push("");
  });

  lines.push("👉 마음에 드는 상품을 쿠팡에서 고르신 뒤 파트너스 링크를 복사해");
  lines.push('   npm run product:add "상품명" "링크" 생활 "키워드"');
  return lines.join("\n");
}

// ── 5. 텔레그램 전송 ──────────────────────────
async function sendTelegram(text: string): Promise<void> {
  if (!TG_TOKEN || !TG_CHAT) {
    console.warn(
      "⚠️ TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID 미설정 — 전송 생략(콘솔 출력만).\n"
    );
    return;
  }
  const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TG_CHAT,
      text,
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) {
    console.error(`❌ 텔레그램 전송 실패: ${res.status} ${await res.text()}`);
  } else {
    console.log("✅ 텔레그램 전송 완료");
  }
}

// ── 진단 모드: 풀 전체가 데이터랩에 제대로 잡히는지 점검 ──
async function runAudit() {
  const pool = pickCandidates("all", true);
  console.log(
    `풀 전체 ${pool.length}개 키워드를 카테고리별로 진단합니다 ` +
      `(조회기간 ${fromArg ?? "최근 12주"} ~ ${toArg ?? "오늘"})\n`
  );
  const measured = await measureTrends(pool);
  const dead = measured.filter((c) => c.heat < MIN_HEAT);
  const alive = measured.filter((c) => c.heat >= MIN_HEAT);

  const byCat = new Map<string, Candidate[]>();
  for (const c of alive) {
    if (!byCat.has(c.category)) byCat.set(c.category, []);
    byCat.get(c.category)!.push(c);
  }
  for (const [cat, list] of byCat) {
    console.log(`✅ ${catName(cat)} (앵커 ${anchorOf(cat)}=100)`);
    for (const c of list.sort((a, b) => b.heat - a.heat)) {
      console.log(`     ${c.keyword.padEnd(10)} 지수 ${Math.round(c.heat).toString().padStart(4)}`);
    }
  }
  if (dead.length) {
    console.log(`\n⛔ 이 기간에 지수가 잡히지 않는 키워드 ${dead.length}개:`);
    for (const c of dead) {
      console.log(`     ${c.keyword.padEnd(10)} ${catName(c.category)} 지수 ${c.heat.toFixed(2)}`);
    }
    console.log(
      `   ※ 철 지난 키워드(겨울용품을 여름에 조회 등)는 여기 뜨는 게 정상입니다.\n` +
        `     제철 구간으로 다시 확인하세요:  npm run product:pick -- --audit --from=2025-12-01 --to=2026-02-01\n` +
        `     제철에도 0이면 카테고리가 틀린 것 — keyword-pool.ts의 category를 고치세요.`
    );
  } else {
    console.log("\n✅ 지수가 잡히지 않는 키워드 없음 — 풀 전체 정상.");
  }
}

// ── 메인 ──────────────────────────────────────
async function main() {
  if (!NAVER_ID || !NAVER_SECRET) {
    console.error("❌ NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 가 .env.local에 필요합니다.");
    process.exit(1);
  }

  if (AUDIT) return runAudit();

  const season = FORCED_SEASON ?? seasonForMonth(kstNow().getMonth() + 1);
  const pool = pickCandidates(season);
  if (!pool.length) {
    console.log("후보 키워드가 없습니다. keyword-pool.ts를 확인하세요.");
    return;
  }
  console.log(`시즌: ${season} | 후보 키워드 ${pool.length}개 트렌드 측정 중...`);

  const measured = await measureTrends(pool);

  const noData = measured.filter((c) => c.heat < MIN_HEAT);
  if (noData.length) {
    console.warn(
      `\n⚠️ 지수가 잡히지 않아 제외된 키워드 ${noData.length}개: ` +
        noData.map((c) => `${c.keyword}(${catName(c.category)})`).join(", ") +
        `\n   → npm run product:pick -- --audit 로 카테고리를 점검하세요.`
    );
  }

  // rise(상승률) 우선 정렬 — heat은 카테고리 간 비교가 안 되므로 동점 처리에만 쓴다.
  const ranked = measured
    .filter((c) => c.heat >= MIN_HEAT)
    .sort((a, b) => b.rise - a.rise || b.heat - a.heat)
    .slice(0, TOP_N);

  if (!ranked.length) {
    console.log("지수가 잡히는 후보가 없습니다. --audit 으로 풀을 점검하세요.");
    return;
  }

  for (const c of ranked) {
    c.sample = await shopSearch(c.keyword);
  }

  const msg = buildMessage(ranked, season);
  console.log("\n" + msg + "\n");

  if (!DRY) await sendTelegram(msg);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
