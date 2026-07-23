/**
 * 득템로그 — 이미지 없는 발행 글에 네이버 이미지 보완
 *
 * 일반 주제(topics) 글은 썸네일이 Unsplash에만 의존해, 키/레이트리밋 문제 시
 * 이미지 없이 발행되는 사고가 있었다. 이 스크립트는 이미 발행된 글 중
 * 썸네일 또는 본문 이미지가 없는 글에 네이버 이미지를 채워 넣는다. (본문 텍스트는 수정하지 않음)
 *
 * 사용법:
 *   npx tsx scripts/fix-missing-images.ts            # DRY RUN (미리보기, DB 미수정)
 *   npx tsx scripts/fix-missing-images.ts --apply    # 실제 DB 반영
 *   npx tsx scripts/fix-missing-images.ts --slug basic-002 --apply   # 특정 글만
 */

import { Pool } from "pg";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// 워터마크 스톡 + 아바타/로고성 도메인 제외 (CLAUDE.md 저작권·품질 주의)
const BLOCKED_DOMAINS = [
  "depositphotos", "shutterstock", "istockphoto", "gettyimages",
  "123rf", "alamy", "dreamstime", "freepik", "stock.adobe",
  "yt3.googleusercontent", "ytimg", "yt3.ggpht", // 유튜브 채널 아바타·썸네일
];
// 썸네일로 선호하는 깨끗한 쇼핑 CDN (CLAUDE.md 권장)
const PREFERRED_THUMB = ["phinf.naver.net", "pstatic.net", "coupangcdn.com"];

interface NaverImage { url: string; width: number; height: number; }

// ── 제목 → 네이버 검색어 ───────────────────────────
function titleToQuery(title: string): string {
  const map: [RegExp, string][] = [
    [/가성비|쿠팡|가격 대비/, "가성비 생활용품 쇼핑"],
    [/후기|별점|리뷰|평점/, "온라인 쇼핑 상품 리뷰"],
    [/최저가|할인|세일|특가/, "온라인 쇼핑 할인 특가"],
    [/생활용품|살림|정리/, "생활용품 정리 살림"],
    [/계절|겨울|여름|봄|가을/, "계절 생활용품 쇼핑"],
    [/주방|요리/, "주방용품 살림"],
    [/캠핑|여행/, "캠핑 여행 용품"],
    [/전자|가전|디지털/, "가전 디지털 제품"],
  ];
  for (const [re, q] of map) if (re.test(title)) return q;
  return "온라인 쇼핑 생활용품";
}

// ── 네이버 이미지 검색 (워터마크 스톡 필터) ────────
async function fetchNaverImages(query: string, count: number): Promise<NaverImage[]> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.log("⚠️  NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 미설정");
    return [];
  }
  const url = new URL("https://openapi.naver.com/v1/search/image");
  url.searchParams.set("query", query);
  url.searchParams.set("display", "30");
  url.searchParams.set("sort", "sim");
  url.searchParams.set("filter", "large");

  const res = await fetch(url.toString(), {
    headers: { "X-Naver-Client-Id": clientId, "X-Naver-Client-Secret": clientSecret },
  });
  if (!res.ok) { console.log(`⚠️  네이버 API 오류 (${res.status})`); return []; }

  const data = await res.json() as {
    items: Array<{ link: string; sizewidth: string; sizeheight: string }>;
  };
  return data.items
    .filter(it => it.link.startsWith("http") && Number(it.sizewidth) >= 300)
    .filter(it => !BLOCKED_DOMAINS.some(d => it.link.toLowerCase().includes(d)))
    .map(it => ({ url: it.link, width: Number(it.sizewidth) || 0, height: Number(it.sizeheight) || 0 }))
    .slice(0, count);
}

// ── 본문 h2 섹션마다 이미지 삽입 ───────────────────
function buildFigure(url: string): string {
  return [
    `<figure style="margin:1.75em 0;display:block;">`,
    `<img src="${url}" alt="관련 이미지" loading="lazy"`,
    ` style="width:100%;max-height:420px;object-fit:cover;border-radius:10px;display:block;" />`,
    `</figure>`,
  ].join("");
}
function injectInline(html: string, urls: string[]): string {
  if (!urls.length) return html;
  const DELIM = "</h2>";
  const parts = html.split(DELIM);
  // h2 1, 3 뒤에 삽입 (본문 앞부분 우선)
  const targets: Array<[number, number]> = [[1, 0], [3, 1]];
  for (const [partIdx, imgIdx] of targets) {
    if (partIdx < parts.length && urls[imgIdx]) {
      parts[partIdx] = parts[partIdx] + buildFigure(urls[imgIdx]);
    }
  }
  return parts.join(DELIM);
}

// ── 메인 ───────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const slugIdx = args.indexOf("--slug");
  const slugArg = slugIdx !== -1 ? args[slugIdx + 1] : null;

  console.log(`=== 득템로그 이미지 보완 ${apply ? "(실제 반영)" : "(DRY RUN)"} ===\n`);

  const where = slugArg
    ? "status='published' AND slug=$1"
    : "status='published'";
  const { rows } = await pool.query(
    `SELECT id, slug, title, thumbnail_url, content FROM posts WHERE ${where} ORDER BY published_at ASC`,
    slugArg ? [slugArg] : []
  );

  const targets = rows.filter(r =>
    !r.thumbnail_url || !/<img\s/i.test(String(r.content || ""))
  );
  console.log(`전체 ${rows.length}개 중 보완 대상 ${targets.length}개\n`);
  if (!targets.length) { console.log("✅ 모든 글에 이미지가 있습니다."); await pool.end(); return; }

  let fixed = 0, failed = 0;
  for (const post of targets) {
    const noThumb = !post.thumbnail_url;
    const noInline = !/<img\s/i.test(String(post.content || ""));
    const query = titleToQuery(post.title);
    const need = (noThumb ? 1 : 0) + (noInline ? 2 : 0);
    console.log(`[${fixed + failed + 1}/${targets.length}] ${post.slug} — "${query}" (썸네일없음=${noThumb}, 본문없음=${noInline})`);

    const images = await fetchNaverImages(query, need + 2); // 여유분
    if (images.length < need) {
      console.log(`  ⚠️  이미지 부족(${images.length}/${need}) — 건너뜀`);
      failed++;
      continue;
    }
    // 썸네일은 깨끗한 쇼핑 CDN을 우선 선택 (없으면 첫 이미지)
    const orderedForThumb = [...images].sort((a, b) => {
      const pa = PREFERRED_THUMB.some(d => a.url.includes(d)) ? 0 : 1;
      const pb = PREFERRED_THUMB.some(d => b.url.includes(d)) ? 0 : 1;
      return pa - pb;
    });
    let newThumb = post.thumbnail_url as string | null;
    let newContent = post.content as string;
    const usedForThumb = new Set<string>();
    if (noThumb) { newThumb = orderedForThumb[0].url; usedForThumb.add(newThumb); console.log(`  🖼️  썸네일: ${newThumb.slice(0, 70)}`); }
    const inlinePool = images.filter(i => !usedForThumb.has(i.url));
    let idx = 0;
    if (noInline) {
      const inline = inlinePool.slice(idx, idx + 2).map(i => i.url);
      newContent = injectInline(newContent, inline);
      console.log(`  🖼️  본문 이미지 ${inline.length}장 삽입`);
    }

    if (apply) {
      await pool.query(
        "UPDATE posts SET thumbnail_url=$1, content=$2, updated_at=NOW() WHERE id=$3",
        [newThumb, newContent, post.id]
      );
      console.log(`  ✅ DB 반영 완료`);
    } else {
      console.log(`  🔍 DRY RUN — DB 미수정`);
    }
    fixed++;
    await new Promise(r => setTimeout(r, 400)); // 네이버 레이트리밋 여유
  }

  console.log(`\n=== 완료 ===\n성공 ${fixed}개, 실패 ${failed}개`);
  await pool.end();
}

main().catch(err => { console.error("❌ 오류:", err); process.exit(1); });
