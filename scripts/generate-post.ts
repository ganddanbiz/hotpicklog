/**
 * AI 블로그 자동 글 생성 스크립트
 * 사용법: npx tsx scripts/generate-post.ts
 * 크론탭: 0 9 * * 1-5 cd /path/to/my-blog && npx tsx scripts/generate-post.ts
 *
 * 동작 순서:
 *  1. products.json에 미사용 상품이 있으면 → 상품 리뷰 포스팅 생성 (쿠팡 파트너스 링크 포함)
 *  2. 상품이 없으면 → topics.ts 기반 일반 포스팅 생성
 */

import Anthropic from "@anthropic-ai/sdk";
import { Pool } from "pg";
import { allTopics, Topic } from "./topics";
import { loadProducts, saveProducts, Product } from "./add-product";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

// .env.local 로드
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// ── DB 연결 (Neon PostgreSQL) ─────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ── Claude 클라이언트 ─────────────────────────────
// ANTHROPIC_API_KEY는 Claude Code CLI가 자동으로 읽어 구독 인증을 덮어쓰므로 사용하지 않음.
// 우선순위: CLAUDE_CODE_OAUTH_TOKEN(구독) → BLOG_ANTHROPIC_API_KEY(스크립트 전용 API 키)
const oauthToken = process.env.CLAUDE_CODE_OAUTH_TOKEN;
const apiKey = process.env.BLOG_ANTHROPIC_API_KEY;
if (!oauthToken && !apiKey) {
  console.error(
    "❌ CLAUDE_CODE_OAUTH_TOKEN 또는 BLOG_ANTHROPIC_API_KEY가 .env.local에 필요합니다.\n" +
      "   구독 사용: `claude setup-token` 실행 후 CLAUDE_CODE_OAUTH_TOKEN에 토큰 입력"
  );
  process.exit(1);
}
const anthropic = oauthToken
  ? new Anthropic({ authToken: oauthToken })
  : new Anthropic({ apiKey: apiKey! });

// ── 카테고리 → Unsplash 검색어 맵 ────────────────
const CATEGORY_QUERY: Record<string, string> = {
  bidding: "real estate auction people meeting",
  law:     "lawyer people office consultation",
  before:  "house inspection people property",
  after:   "house keys family moving people",
  tax:     "finance advisor meeting people",
  ai:      "technology people computer office",
  // 상품 카테고리
  가전:    "home appliance electronics product",
  생활:    "home living product lifestyle",
  식품:    "food healthy nutrition product",
  패션:    "fashion clothing style product",
  뷰티:    "beauty skincare cosmetics product",
  스포츠:  "sports fitness exercise product",
  육아:    "baby child parenting product",
  반려동물: "pet animal care product",
  상품리뷰: "shopping product review lifestyle",
};

interface UnsplashResult {
  url: string;
  attribution: string;
}

// ── DB에서 이미 사용된 이미지 URL 조회 ──
async function getUsedImageIds(): Promise<Set<string>> {
  const { rows } = await pool.query(
    "SELECT thumbnail_url, content FROM posts WHERE status = 'published'"
  );
  const ids = new Set<string>();
  const inlineRegex = /src="(https:\/\/images\.unsplash\.com\/[^"?]+)/g;

  for (const row of rows) {
    if (row.thumbnail_url) {
      ids.add((row.thumbnail_url as string).split("?")[0]);
    }
    let match;
    while ((match = inlineRegex.exec(row.content as string)) !== null) {
      ids.add(match[1]);
    }
    inlineRegex.lastIndex = 0;
  }
  return ids;
}

// ── Unsplash 이미지 여러 장 가져오기 ─
async function fetchUnsplashImages(category: string, count: number, usedIds: Set<string> = new Set()): Promise<UnsplashResult[]> {
  const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!unsplashKey) {
    writeLog("⚠️  UNSPLASH_ACCESS_KEY 미설정 — 이미지 없이 진행");
    return [];
  }

  const query = CATEGORY_QUERY[category] ?? "product shopping lifestyle";

  try {
    const results: UnsplashResult[] = [];
    let page = 1;

    while (results.length < count && page <= 3) {
      const url = new URL("https://api.unsplash.com/search/photos");
      url.searchParams.set("query", query);
      url.searchParams.set("per_page", "10");
      url.searchParams.set("orientation", "landscape");
      url.searchParams.set("page", String(page));

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Client-ID ${unsplashKey}` },
      });

      if (!res.ok) {
        writeLog(`⚠️  Unsplash API 오류 (${res.status}) — 이미지 없이 진행`);
        break;
      }

      const data = await res.json() as {
        results: Array<{
          id: string;
          urls: { regular: string };
          user: { name: string };
          links: { html: string };
        }>;
      };

      if (!data.results?.length) break;

      for (const photo of data.results) {
        const baseUrl = photo.urls.regular.split("?")[0];
        if (usedIds.has(baseUrl)) continue;
        usedIds.add(baseUrl);
        results.push({
          url: photo.urls.regular,
          attribution: `<a href="${photo.links.html}?utm_source=my_blog&utm_medium=referral" rel="noopener noreferrer" style="color:rgba(255,255,255,0.9);">${photo.user.name}</a> / Unsplash`,
        });
        if (results.length >= count) break;
      }

      page++;
    }

    if (!results.length) writeLog("⚠️  Unsplash 미사용 이미지 없음 — 이미지 없이 진행");
    return results;
  } catch (err) {
    writeLog(`⚠️  Unsplash fetch 실패: ${err instanceof Error ? err.message : String(err)} — 이미지 없이 진행`);
    return [];
  }
}

// ── Unsplash 이미지 삽입 (일반 포스팅용) ─────────
function injectImagesIntoContent(html: string, images: UnsplashResult[]): string {
  if (!images.length) return html;

  const DELIMITER = "</h2>";
  const parts = html.split(DELIMITER);

  // h2 이후 섹션마다 순서대로 이미지 삽입
  let imgIdx = 0;
  for (let i = 1; i < parts.length && imgIdx < images.length; i++) {
    const img = images[imgIdx++];
    const figure = [
      `<figure style="margin:1.75em 0;position:relative;display:block;">`,
      `<img src="${img.url}" alt="관련 이미지" loading="lazy"`,
      ` style="width:100%;max-height:400px;object-fit:cover;border-radius:10px;border:1px solid var(--border);display:block;" />`,
      `<figcaption style="position:absolute;bottom:8px;right:10px;font-size:0.65rem;`,
      `color:rgba(255,255,255,0.85);background:rgba(0,0,0,0.45);`,
      `padding:2px 7px;border-radius:4px;line-height:1.5;white-space:nowrap;">`,
      img.attribution,
      `</figcaption></figure>`,
    ].join("");
    parts[i] = parts[i] + figure;
  }

  return parts.join(DELIMITER);
}

// ── 네이버 이미지 검색으로 상품 이미지 가져오기 ──
interface NaverImage { url: string; width: number; height: number; }

async function fetchNaverImages(query: string, count: number = 6): Promise<NaverImage[]> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    writeLog("⚠️  NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 미설정");
    return [];
  }

  try {
    writeLog(`🖼️  네이버 이미지 검색 중: "${query}"`);

    const url = new URL("https://openapi.naver.com/v1/search/image");
    url.searchParams.set("query", query);
    url.searchParams.set("display", String(count * 2)); // 여유있게 요청
    url.searchParams.set("sort", "sim");
    url.searchParams.set("filter", "large");

    const res = await fetch(url.toString(), {
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret,
      },
    });

    if (!res.ok) {
      writeLog(`⚠️  네이버 API 오류 (${res.status})`);
      return [];
    }

    const data = await res.json() as {
      items: Array<{ link: string; thumbnail: string; sizewidth: string; sizeheight: string }>;
    };

    // 작은 이미지 제외, 최대 count장 (width·height 포함 반환)
    const images = data.items
      .filter(item => Number(item.sizewidth) >= 300 && item.link.startsWith("http"))
      .map(item => ({
        url: item.link,
        width: Number(item.sizewidth) || 0,
        height: Number(item.sizeheight) || 0,
      }))
      .slice(0, count);

    writeLog(`🖼️  네이버 이미지 ${images.length}장 수집 완료`);
    return images;
  } catch (err) {
    writeLog(`⚠️  네이버 이미지 검색 실패: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}

// ── 이미지 비율에 맞는 figure HTML 생성 ──────────
function buildImageFigure(img: NaverImage, alt: string, loading: "eager" | "lazy", linkUrl?: string): string {
  const isPortrait = img.height > img.width * 1.2; // 세로가 긴 이미지
  const isSquare = Math.abs(img.width - img.height) / Math.max(img.width, img.height) < 0.15;

  // 세로형: 너무 넓게 펼치지 않고 중앙 정렬로 자연스럽게
  const wrapStyle = isPortrait
    ? `margin:1.5em auto;display:block;max-width:420px;border-radius:10px;overflow:hidden;border:1px solid var(--border);background:#f8f8f8;`
    : `margin:1.5em 0;display:block;border-radius:10px;overflow:hidden;border:1px solid var(--border);background:#f8f8f8;`;

  // 이미지 자체는 잘리지 않도록 height:auto 고정, max-height 제거
  const imgStyle = `width:100%;height:auto;display:block;`;

  const sizeAttr = img.width && img.height
    ? `width="${img.width}" height="${img.height}"`
    : "";

  const imgTag = `<img src="${img.url}" alt="${alt}" loading="${loading}" ${sizeAttr} referrerpolicy="no-referrer" style="${imgStyle}" />`;

  const inner = linkUrl
    ? `<a href="${linkUrl}" target="_blank" rel="noopener noreferrer sponsored" style="display:block;">${imgTag}</a>`
    : imgTag;

  return `
<figure style="${wrapStyle}">
  ${inner}
</figure>`;
}

// ── 상품 이미지를 h2 섹션마다 삽입 ──────────────
function injectProductImages(html: string, images: NaverImage[], productName: string, productUrl?: string): string {
  if (!images.length) return html;

  const DELIMITER = "</h2>";
  const parts = html.split(DELIMITER);

  // 첫 번째 이미지: 글 최상단 (상품 링크 연결)
  parts[0] = parts[0] + buildImageFigure(images[0], productName, "eager", productUrl);

  // 나머지 이미지: h2 섹션마다 순서대로 (상품 링크 연결)
  let imgIdx = 1;
  for (let i = 1; i < parts.length && imgIdx < images.length; i++) {
    parts[i] = parts[i] + buildImageFigure(images[imgIdx], `${productName} 이미지 ${imgIdx + 1}`, "lazy", productUrl);
    imgIdx++;
  }

  return parts.join(DELIMITER);
}

// ── 쿠팡 파트너스 고정 링크 (모든 포스팅 공통) ───
const COUPANG_GENERAL_URL = "https://link.coupang.com/a/eJzg1eIyu4";

// ── 쿠팡 공통 배너 (글 상단 삽입) ───────────────
function coupangTopBanner(): string {
  return `
<div style="margin:0 0 0.6em 0;padding:14px 20px;background:linear-gradient(135deg,#e4003a 0%,#ff4d6d 100%);
            border-radius:10px 10px 0 0;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
  <span style="color:#fff;font-weight:600;font-size:0.95rem;">🛒 쿠팡에서 다양한 상품을 만나보세요</span>
  <a href="${COUPANG_GENERAL_URL}"
     target="_blank"
     rel="noopener noreferrer sponsored"
     style="display:inline-block;padding:8px 22px;background:#fff;color:#e4003a;
            font-size:0.88rem;font-weight:700;border-radius:6px;text-decoration:none;white-space:nowrap;">
    쿠팡 바로가기 →
  </a>
</div>
<p style="margin:0 0 2em 0;padding:8px 14px;background:#fff5f7;border:1px solid #ffd0d8;border-top:none;
          border-radius:0 0 10px 10px;font-size:0.78rem;color:#888;line-height:1.5;">
  이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
</p>`;
}

// ── 쿠팡 파트너스 상품 구매 버튼 + 배너 태그 삽입 ─
function injectAffiliateButton(html: string, product: Product): string {
  // 쿠팡 파트너스 배너 태그 (상품별 제공되는 <a><img></a> 태그)
  const bannerTag = product.tag
    ? `<div style="display:flex;justify-content:center;margin-bottom:1.2em;">${product.tag}</div>`
    : "";

  const button = `
<div style="margin:2.5em 0;text-align:center;">
  ${bannerTag}
  <a href="${product.url}"
     target="_blank"
     rel="noopener noreferrer sponsored"
     style="display:inline-block;padding:16px 40px;background:#e4003a;color:#fff;
            font-size:1.1rem;font-weight:700;border-radius:8px;text-decoration:none;
            box-shadow:0 4px 14px rgba(228,0,58,0.35);letter-spacing:0.02em;">
    🛒 쿠팡에서 최저가 확인하기
  </a>
  <p style="margin-top:8px;font-size:0.78rem;color:var(--text-muted,#888);">
    또는 <a href="${COUPANG_GENERAL_URL}" target="_blank" rel="noopener noreferrer sponsored"
            style="color:#e4003a;text-decoration:underline;">쿠팡 전체 상품 둘러보기</a>
  </p>
  <p style="margin-top:6px;font-size:0.78rem;color:var(--text-muted,#888);">
    ※ 이 링크는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
  </p>
</div>`;

  return coupangTopBanner() + html + button;
}

// ── 다음 미사용 상품 가져오기 ─────────────────────
async function getNextProduct(): Promise<Product | null> {
  const products = loadProducts();
  return products.find((p) => !p.used) ?? null;
}

// ── 상품을 사용 완료로 표시 ───────────────────────
function markProductUsed(product: Product): void {
  const products = loadProducts();
  const target = products.find((p) => p.id === product.id);
  if (target) {
    target.used = true;
    saveProducts(products);
  }
}

// ── 다음 발행할 주제 결정 ─────────────────────────
async function getNextTopic(): Promise<Topic | null> {
  const { rows } = await pool.query(
    "SELECT slug FROM posts WHERE slug ~ '^(basic|mid|adv)-[0-9]+$'"
  );
  const existingSlugs = new Set(rows.map((r: { slug: string }) => r.slug));

  for (const topic of allTopics) {
    if (!existingSlugs.has(topic.slug)) {
      return topic;
    }
  }
  return null;
}

// ── 상품 리뷰 프롬프트 생성 ───────────────────────
function buildProductPrompt(product: Product): string {
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "내 블로그";
  return `당신은 "${siteName}" 블로그의 상품 리뷰 작가입니다.
네이버 블로그 감성으로 ${product.name} 리뷰를 작성해주세요.

상품명: ${product.name}
카테고리: ${product.category}
${product.keywords ? `키워드: ${product.keywords}` : ""}
${product.referenceUrl ? `참조 영상: ${product.referenceUrl} (이 유튜브 영상을 참고해 실제 사용 후기처럼 생생하게 작성해주세요)` : ""}

[출력 형식 - 반드시 이 형식으로]
첫 줄에 반드시 아래 형식으로 제목을 출력하고, 빈 줄 하나 후 HTML 본문을 시작하세요.
TITLE: <여기에 블로그 제목>

[제목 작성 규칙]
- 이모지 1~2개 포함
- 호기심·후킹 유발 (예: "진짜야?", "써봤더니...", "솔직히 말하면", "이건 꼭 봐야 해")
- 30자 이내로 짧고 강렬하게
- 좋은 예: "에어팟 프로 3 써봤는데... 이건 진짜야 🎧", "고기만두 끝판왕 등장?! 솔직 후기 🥟"
- 나쁜 예: "Apple 2025 에어팟 프로 3 USB-C 블루투스 이어폰 상세 리뷰 | 솔직한 사용 후기"

[문체 규칙 - 반드시 지킬 것]
1. 문장은 짧게, 1~2줄마다 줄바꿈 (<br> 또는 새 <p> 태그)
2. 친근하고 솔직한 구어체 존댓말 ("~해요", "~거든요", "~더라고요", "~했어요")
3. 이모지를 문장 앞이나 뒤에 자연스럽게 삽입 (📦 ✅ 💡 😊 🔥 ⭐ 👍 💕 등)
4. 첫 문장은 공감·후킹으로 시작 (예: "요즘 이거 진짜 난리났잖아요 🔥")
5. 딱딱한 표현 금지 → 대화하듯 자연스럽게
6. 강조할 내용은 <strong>태그</strong>로 굵게
7. "여러분", "독자님" 호칭 금지

[구성 - 이 순서대로]
① 공감 후킹 오프닝 (2~3문장)
② 상품 핵심 특징 3가지 (이모지 + 짧은 설명)
③ 직접 써본 솔직 후기 (장점·단점 나눠서)
④ 이런 분께 추천해요 (bullet 3가지)
⑤ 가격 대비 가치 한줄 총평
⑥ FAQ 3개 (Q&A 형식)

[HTML 출력 규칙]
- 순수 HTML만 출력, 마크다운 금지
- 사용 태그: <h2> <h3> <p> <br> <ul> <ol> <li> <strong> <blockquote> <table> <thead> <tbody> <tr> <th> <td>
- <h1> 금지
- <strong>은 핵심 단어·수치에만 최소 사용 (문장 전체를 감싸거나 연속 사용 금지)
- 인라인 style 속성 절대 사용 금지
- 각 문단 사이 <br> 충분히 넣어서 여백 확보
- h2 섹션 제목에도 이모지 포함 (예: <h2>📦 이 제품, 뭐가 다를까요?</h2>)`;
}

// ── 일반 주제 프롬프트 생성 ──────────────────────
function buildPrompt(topic: Topic): string {
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "내 블로그";
  return `당신은 "${siteName}" 블로그 작가입니다.
네이버 블로그 감성으로 아래 주제의 글을 작성해주세요.

주제: ${topic.title}
카테고리: ${topic.category}

[문체 규칙 - 반드시 지킬 것]
1. 문장은 짧게, 1~2줄마다 줄바꿈 (<br> 또는 새 <p> 태그)
2. 친근하고 솔직한 구어체 존댓말 ("~해요", "~거든요", "~더라고요", "~했어요")
3. 이모지를 문장 앞이나 뒤에 자연스럽게 삽입 (📌 ✅ 💡 😊 🔥 ⭐ 👍 등)
4. 첫 문장은 공감·후킹으로 시작 (인사말 금지)
5. 딱딱한 표현 금지 → 대화하듯 자연스럽게
6. 강조할 내용은 <strong>태그</strong>로 굵게
7. h2 섹션 제목에도 이모지 포함 (예: <h2>📌 꼭 알아야 할 핵심 3가지</h2>)
8. "여러분", "독자님" 호칭 금지

[구성]
- 공감 오프닝 → 핵심 내용 3~5개 섹션 → 마무리 정리
- 숫자·비교 내용은 표로 정리
- 각 문단 사이 <br> 충분히 넣어서 여백 확보

[HTML 출력 규칙]
- 순수 HTML만 출력, 마크다운 금지
- 사용 태그: <h2> <h3> <p> <br> <ul> <ol> <li> <strong> <blockquote> <table> <thead> <tbody> <tr> <th> <td>
- <h1> 금지, 제목 출력 금지
- <strong>은 핵심 단어·수치에만 최소 사용 (문장 전체를 감싸거나 연속 사용 금지)
- 인라인 style 속성 절대 사용 금지`;
}

// ── Claude 응답에서 TITLE 추출 ────────────────────
function extractTitle(raw: string): { title: string; body: string } {
  const match = raw.match(/^TITLE:\s*(.+)/m);
  if (match) {
    const title = match[1].trim();
    const body = raw.replace(/^TITLE:\s*.+\n?/m, "").trim();
    return { title, body };
  }
  return { title: "", body: raw };
}

// ── HTML 정리 ──────────────────────────────────────
function cleanHtml(raw: string): string {
  return raw
    .replace(/```html\s*/gi, "")
    .replace(/```\s*/g, "")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/^#{1,6}\s+(.+)$/gm, "<p>$1</p>")
    .replace(/<i\b[^>]*class="[^"]*(?:material-icons|fa|fas|far|fab)[^"]*"[^>]*>.*?<\/i>/gi, "")
    .replace(/<span\b[^>]*class="[^"]*(?:material-icons|material-symbols)[^"]*"[^>]*>.*?<\/span>/gi, "")
    .replace(/<i\b[^>]*>([a-z_]{3,30})<\/i>/gi, "")
    .trim();
}

// ── DB에 글 저장 ──────────────────────────────────
interface PostData {
  title: string;
  slug: string;
  category: string;
  keywords: string;
  meta_description: string;
}

async function savePost(post: PostData, content: string, thumbnailUrl: string | null): Promise<number> {
  const { rows } = await pool.query(
    `INSERT INTO posts
      (title, content, slug, category, thumbnail_url, meta_description, keywords, status, published_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'published', NOW())
     RETURNING id`,
    [
      post.title,
      content,
      post.slug,
      post.category,
      thumbnailUrl,
      post.meta_description,
      post.keywords,
    ]
  );
  return rows[0].id as number;
}

// ── 로그 파일 기록 ────────────────────────────────
function writeLog(message: string): void {
  const logPath = path.resolve(process.cwd(), "scripts/generate.log");
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(logPath, line, "utf-8");
  console.log(message);
}

// ── 메인 실행 ─────────────────────────────────────
async function main() {
  writeLog("=== 글 자동 생성 시작 ===");

  try {
    // ① 미사용 상품이 있으면 상품 리뷰 포스팅 우선
    const product = await getNextProduct();

    if (product) {
      writeLog(`🛒 상품 리뷰 모드: [${product.id}] ${product.name}`);

      // Claude로 상품 리뷰 생성
      writeLog("🤖 Claude로 상품 리뷰 생성 중...");
      const prompt = buildProductPrompt(product);
      const result = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      });
      const rawContent = result.content[0].type === "text" ? result.content[0].text : "";
      const { title: generatedTitle, body: rawBody } = extractTitle(rawContent);
      let content = cleanHtml(rawBody);
      writeLog(`✍️  생성 완료 (${content.length}자)`);
      if (generatedTitle) writeLog(`📝 제목: ${generatedTitle}`);

      // 네이버 이미지 검색으로 상품 이미지 가져오기
      const naverImages = await fetchNaverImages(product.name, 6);
      const thumbnailUrl = naverImages[0]?.url ?? null;

      // 이미지를 h2 섹션마다 삽입 (이미지 클릭 시 상품 링크로 이동)
      if (naverImages.length > 0) {
        content = injectProductImages(content, naverImages, product.name, product.url);
        writeLog(`🖼️  상품 이미지 ${naverImages.length}장 삽입 완료`);
      } else {
        // 폴백: Unsplash (API 키 있을 때)
        const usedIds = await getUsedImageIds();
        const fallbackImages = await fetchUnsplashImages(product.category, 5, usedIds);
        if (fallbackImages.length) {
          content = injectImagesIntoContent(content, fallbackImages);
          writeLog(`🖼️  Unsplash 폴백 이미지 ${fallbackImages.length}장 삽입`);
        }
      }

      // 쿠팡 파트너스 구매 버튼 삽입
      content = injectAffiliateButton(content, product);

      if (thumbnailUrl) writeLog(`🖼️  썸네일: ${thumbnailUrl} (${naverImages[0]?.width}x${naverImages[0]?.height})`);

      // 포스팅 데이터 구성
      const postData: PostData = {
        title: generatedTitle || `${product.name} 솔직 후기 🔥`,
        slug: product.slug,
        category: product.category,
        keywords: product.keywords || product.name,
        meta_description: `${product.name}의 특징, 장단점, 가격 분석까지 꼼꼼하게 정리했습니다. 구매 전 꼭 확인하세요.`,
      };

      // DB 저장
      const postId = await savePost(postData, content, thumbnailUrl);
      writeLog(`💾 DB 저장 완료 (id: ${postId}, slug: ${product.slug})`);
      writeLog(`🌐 URL: ${process.env.NEXT_PUBLIC_SITE_URL}/posts/${product.slug}`);

      // 상품 사용 완료 표시
      markProductUsed(product);
      writeLog(`✅ 상품 [${product.id}] 발행 완료 표시`);

      // 남은 상품 수 확인
      const remaining = loadProducts().filter((p) => !p.used).length;
      writeLog(`📦 남은 상품: ${remaining}개`);

    } else {
      // ② 상품 없으면 일반 주제 포스팅
      writeLog("📝 일반 주제 모드 (등록된 상품 없음)");
      const topic = await getNextTopic();

      if (!topic) {
        writeLog("✅ 모든 주제(130개)가 발행 완료됐습니다!");
        await pool.end();
        return;
      }

      writeLog(`📝 주제 선택: [${topic.level}] ${topic.index}/130 - ${topic.title}`);

      writeLog("🤖 Claude로 글 생성 중...");
      const prompt = buildPrompt(topic);
      const result = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      });
      const rawContent = result.content[0].type === "text" ? result.content[0].text : "";
      const content = cleanHtml(rawContent);
      writeLog(`✍️  생성 완료 (${content.length}자)`);

      writeLog("🖼️  Unsplash 이미지 가져오는 중...");
      const usedIds = await getUsedImageIds();
      const allImages = await fetchUnsplashImages(topic.category, 3, usedIds);
      const thumbnail = allImages[0] ?? null;
      const inlineImages = allImages.slice(1, 3);
      const contentWithImages = coupangTopBanner() + injectImagesIntoContent(content, inlineImages);
      if (thumbnail) writeLog(`🖼️  썸네일: ${thumbnail.url}`);

      const postData: PostData = {
        title: topic.title,
        slug: topic.slug,
        category: topic.category,
        keywords: topic.keywords,
        meta_description: topic.meta_description,
      };

      const postId = await savePost(postData, contentWithImages, thumbnail?.url ?? null);
      writeLog(`💾 DB 저장 완료 (id: ${postId}, slug: ${topic.slug})`);
      writeLog(`🌐 URL: ${process.env.NEXT_PUBLIC_SITE_URL}/posts/${topic.slug}`);
    }

    writeLog("=== 완료 ===\n");

  } catch (error) {
    writeLog(`❌ 오류 발생: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
