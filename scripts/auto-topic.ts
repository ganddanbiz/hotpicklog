/**
 * 자동 주제 모드 — 상품·주제가 모두 소진돼도 대표님 손 없이 발행이 이어지게 한다 (2026-10-13)
 *
 * 형제 채널(단단한50·지구촌TMI·소재타임스·시그널코리아)의 최근 글과 계절을 읽어
 * "그 글을 읽은 사람이 지금 살 법한 생활 상품" 구매 가이드 주제 1개를 Claude가 추론한다.
 *   예) 단단한50 「중장년 단백질 섭취」 → "50대 단백질 쉐이크 고르는 기준"
 *       시그널코리아 「갈륨 수출통제」 → "충전기·보조배터리 고를 때 GaN 표기 보는 법"
 * 특정 상품 딥링크가 없으므로 쿠팡 파트너스 공통 링크·배너로 수익화한다.
 * 모든 소스는 공개 엔드포인트라 추가 비밀정보가 필요 없다.
 */

import type Anthropic from "@anthropic-ai/sdk";
import type { Pool } from "pg";
import type { Topic } from "./topics";

// 홈 메뉴 키 (src/app/page.tsx CATEGORIES) — 이 밖의 값은 메뉴에서 안 보인다
export const MENU_CATEGORIES = ["식품", "가전", "생활", "패션", "뷰티", "스포츠", "육아", "반려동물", "상품리뷰"];

const SIGNAL_SOURCES: { name: string; url: string; pick: (j: any) => string[] }[] = [
  { name: "단단한50(50대 재테크·건강)", url: "https://dandan50.vercel.app/api/posts?limit=6", pick: (j) => (j.posts || []).map((p: any) => p.title) },
  { name: "지구촌TMI(세계 상식)", url: "https://jigu-tmi-blog.vercel.app/api/posts?limit=4", pick: (j) => (j.posts || []).map((p: any) => p.title) },
  { name: "소재타임스(소재·반도체 뉴스)", url: "https://raw.githubusercontent.com/tugman77/materials-news/main/articles.json", pick: (j) => (j.articles || []).map((a: any) => a.title) },
  { name: "시그널코리아(산업 공급망)", url: "https://raw.githubusercontent.com/tugman77/the-signal-korea/main/articles.json", pick: (j) => (j.articles || []).map((a: any) => a.title) },
];

async function collectSignals(): Promise<string> {
  const blocks: string[] = [];
  for (const src of SIGNAL_SOURCES) {
    try {
      const res = await fetch(src.url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) continue;
      const titles = src.pick(await res.json()).slice(0, 6);
      if (titles.length) blocks.push(`[${src.name}]\n${titles.map((t) => `- ${t}`).join("\n")}`);
    } catch {
      // 한 소스가 죽어도 나머지로 진행
    }
  }
  return blocks.join("\n\n");
}

function season(d: Date): string {
  const m = d.getUTCMonth() + 1;
  return m <= 2 || m === 12 ? "겨울" : m <= 5 ? "봄" : m <= 8 ? "여름" : "가을";
}

export async function inferAutoTopic(anthropic: Anthropic, pool: Pool, log: (s: string) => void): Promise<Topic | null> {
  const { rows } = await pool.query(
    "SELECT title FROM posts WHERE status = 'published' ORDER BY published_at DESC LIMIT 30"
  );
  const recent = rows.map((r: { title: string }) => r.title);
  const signals = await collectSignals();
  const now = new Date(Date.now() + 9 * 3600e3); // KST
  log(`🧭 자동 주제 모드 — 형제 채널 신호 ${signals ? signals.split("\n- ").length - 1 : 0}건 수집`);

  const prompt = `당신은 쿠팡 파트너스 생활 상품 블로그 "득템로그"의 편집자입니다.
아래 형제 채널의 최근 글을 읽은 독자가 ${now.getUTCMonth() + 1}월(${season(now)})에 실제로 살 법한 생활 상품의
"구매 가이드" 주제 1개를 정하세요.

[형제 채널 최근 글]
${signals || "(수집 실패 — 계절 수요만으로 정하세요)"}

[득템로그 최근 글 — 겹치지 말 것]
${recent.map((t) => `- ${t}`).join("\n")}

[규칙]
- 형제 채널 글 하나에서 "이 글을 읽은 사람이라면 이게 필요하겠다"고 독자가 바로 납득할 상품군을 고른다.
  (좋은 예: 「중장년 단백질 섭취」 → 단백질 쉐이크 / 「세계에서 가장 추운 도시」 → 방한 장갑)
  글의 논리·태도만 빌려오는 연결(예: 배당 ETF 글 → 손난로)은 금지. 납득할 연결이 없으면 계절 수요로 정하고 source에 "계절"이라고 쓴다.
- 득템로그 최근 글과 같은 품목군(예: 수납함 뒤에 또 정리함)은 고르지 않는다.
- 특정 브랜드·모델을 단정 추천하지 않는다. "고르는 기준·체크리스트·가격대별 차이"를 다루는 주제.
- 의약품·건강기능식품의 효능, 투자 상품은 제외 (식품표시광고법·투자권유 리스크).
- category는 반드시 다음 중 하나: ${MENU_CATEGORIES.join(", ")}
- title은 30자 이내, 이모지 1개, 효과 단정 금지("끝!", "인생템", "달라진다" 금지).

JSON 하나만 출력:
{"title": "...", "category": "...", "keywords": "쉼표로 구분 3~5개 (첫 번째는 이미지 검색어로 쓰일 상품명)", "meta_description": "120자 이내", "source": "어느 채널의 어떤 글에서 착안했는지 한 줄"}`;

  const res = await anthropic.messages.create({
    model: "claude-sonnet-5-5", // 채널 간 연결 추론은 판단 품질이 중요해 Sonnet (하루 1회·짧은 출력)
    max_tokens: 600,
    messages: [{ role: "user", content: prompt }],
  });
  const text = res.content[0].type === "text" ? res.content[0].text : "";
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) {
    log(`❌ 자동 주제 추론 실패 — JSON 없음: ${text.slice(0, 200)}`);
    return null;
  }
  const t = JSON.parse(m[0]);
  if (!t.title || recent.includes(t.title)) {
    log(`❌ 자동 주제 추론 실패 — 제목 없음/중복: ${t.title}`);
    return null;
  }
  const category = MENU_CATEGORIES.includes(t.category) ? t.category : "생활";
  const stamp = now.toISOString().slice(0, 16).replace(/[-:T]/g, "");
  log(`🧭 자동 주제: [${category}] ${t.title} — 착안: ${t.source || "-"}`);
  return {
    index: 0,
    slug: `auto-${stamp}`,
    level: "기초편",
    category,
    title: t.title,
    keywords: t.keywords || t.title,
    meta_description: t.meta_description || "",
  };
}

// 자동 주제 글 본문에 덧붙이는 지시 — 구매 가이드 형식
export const AUTO_GUIDE_RULES = `
[자동 구매 가이드 규칙]
- 특정 상품 한 개를 단정 추천하지 말고, 고르는 기준 3~5가지와 체크리스트, 가격대별 차이를 표로 정리
- 쿠팡에서 검색할 때 쓸 검색어 예시를 마지막에 2~3개 제시
- 실제로 써본 것처럼 꾸미지 않는다 (사용 후기 날조 금지) — "고를 때 이런 점을 보세요" 관점
- 효과·효능 단정 금지, 건강 관련 표현은 "도움이 될 수 있다" 수준`;
