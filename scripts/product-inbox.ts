/**
 * 텔레그램으로 받은 쿠팡 상품을 products.json에 자동 등록
 *
 * 대표님이 쿠팡 앱/웹에서 "공유 → 텔레그램"으로 봇(@Tugmanbot)에 보내면,
 * 이 스크립트가 그 메시지를 읽어 상품으로 등록하고 결과를 다시 텔레그램으로 알린다.
 * (트렌드조달 파이프라인 Phase 1의 마지막 수동 구간을 메신저로 옮긴 것)
 *
 * 실행:
 *   npm run product:inbox           # 새 메시지 읽어 등록 (로컬 products.json만)
 *   npm run product:inbox -- --push # 등록 후 커밋·푸시까지 (GitHub Actions 발행에 반영)
 *   npm run product:inbox -- --dry  # 파싱 결과만 보고 저장·전송 안 함
 *
 * ── 보내는 형식 ───────────────────────────────────────────────
 * 쿠팡 공유 문구를 그대로 붙여넣으면 된다. 링크만 있으면 인식한다.
 *
 *   야마치쿠 스스케 23cm 천연 대나무 젓가락
 *   https://link.coupang.com/a/fkqQIwAHWm
 *
 * 선택 항목은 줄을 추가해 덮어쓸 수 있다:
 *   카테고리: 주방
 *   키워드: 대나무젓가락,일본젓가락,천연젓가락
 *
 * 상품명을 생략하면 링크 앞뒤 텍스트에서 자동으로 잡고, 그것도 없으면 등록을 건너뛴다.
 * 같은 링크가 이미 있으면 중복 등록하지 않는다.
 */

import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import { execFileSync } from "child_process";
import { loadProducts, saveProducts, Product } from "./add-product";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT = process.env.TELEGRAM_CHAT_ID;

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const PUSH = args.includes("--push");
const STDIN = args.includes("--stdin");

const LOW_STOCK = 3; // 대기중인 상품이 이 개수 미만이면 재고 경고 (설계서 기준)
const PUBLISH_PER_WEEK = 3.5; // 이틀에 한 번 발행(홀숫날) → 남은 주수 계산용

const OFFSET_FILE = path.resolve(process.cwd(), "scripts/.telegram-offset");
const COUPANG_RE = /https?:\/\/(?:link\.coupang\.com\/a\/[A-Za-z0-9]+|(?:www\.)?coupang\.com\/vp\/products\/[^\s]+)/i;

// 상품명에서 키워드를 뽑을 때 버릴 토큰 (용량·수량·규격 등)
const NOISE_RE = /^(\d+[a-z]*|[0-9.]+(ml|l|g|kg|cm|mm|m|호|매|개|입|팩|세트|켤레|장|p|ea)|1\+1|무료배송|정품|공식)$/i;

interface Parsed {
  name: string;
  url: string;
  category: string;
  keywords: string;
  raw: string;
}

// ── 텔레그램 수신 ──────────────────────────────
function readOffset(): number | undefined {
  if (!fs.existsSync(OFFSET_FILE)) return undefined;
  const n = Number(fs.readFileSync(OFFSET_FILE, "utf-8").trim());
  return Number.isFinite(n) ? n : undefined;
}

function writeOffset(n: number): void {
  fs.writeFileSync(OFFSET_FILE, String(n), "utf-8");
}

async function fetchUpdates(): Promise<{ texts: string[]; lastId: number | null }> {
  const offset = readOffset();
  const url =
    `https://api.telegram.org/bot${TG_TOKEN}/getUpdates?limit=100` +
    (offset !== undefined ? `&offset=${offset}` : "");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`getUpdates ${res.status}: ${await res.text()}`);
  const json: any = await res.json();
  if (!json.ok) throw new Error(`getUpdates 실패: ${JSON.stringify(json)}`);

  const texts: string[] = [];
  let lastId: number | null = null;
  for (const u of json.result ?? []) {
    lastId = u.update_id;
    const m = u.message ?? u.channel_post;
    const text: string | undefined = m?.text ?? m?.caption;
    // 지정된 채팅에서 온 것만 처리 (봇이 다른 곳에 초대돼도 오염되지 않게)
    if (!text) continue;
    if (TG_CHAT && String(m.chat?.id) !== String(TG_CHAT)) continue;
    texts.push(text);
  }
  return { texts, lastId };
}

// ── 메시지 파싱 ────────────────────────────────
function autoKeywords(name: string): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tok of name.split(/[\s,·/()[\]]+/)) {
    const t = tok.trim();
    if (t.length < 2 || NOISE_RE.test(t)) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= 5) break;
  }
  return out.join(",");
}

/**
 * 붙여넣기 사고 보정: 링크가 공백 없이 이어 붙는 경우가 실제로 있다.
 *   ".../a/fQ5Vle6hcyhttps://link.coupang.com/a/fQ5Vle6hcy"
 * 그대로 두면 코드에 "https"까지 빨려 들어가 엉뚱한 URL이 만들어진다.
 * 앞에 글자가 붙어 있는 http는 떼어내 별도 토큰으로 만든다.
 */
function normalizeLinks(text: string): string {
  return text.replace(/(?!^)(?<=\S)(https?:\/\/)/g, " $1");
}

function parseOne(
  lines: string[],
  url: string,
  fallbackCategory: string,
  fallbackKeywords: string,
  raw: string
): Parsed | null {
  const name = lines
    .join(" ")
    .replace(new RegExp(COUPANG_RE.source, "gi"), "")
    .replace(/\s+/g, " ")
    .trim();
  if (!name) return null; // 상품명을 못 찾으면 등록하지 않는다
  return {
    name,
    url,
    category: fallbackCategory || "생활",
    keywords: fallbackKeywords || autoKeywords(name),
    raw,
  };
}

/**
 * 메시지에서 상품을 뽑는다. 링크가 하나면 메시지 전체가 상품 하나,
 * 여러 개면 **링크가 들어간 줄 하나하나가 각각 상품**이다.
 * (대표님이 여러 상품을 한 번에 보내는 경우가 실제 사용 패턴)
 */
export function parseMessage(text: string): Parsed[] {
  const norm = normalizeLinks(text);
  const globalRe = new RegExp(COUPANG_RE.source, "gi");
  const urls = [...new Set(norm.match(globalRe) ?? [])];
  if (!urls.length) return [];

  let category = "";
  let keywords = "";
  const bodyLines: string[] = [];

  for (const line of norm.split(/\r?\n/)) {
    const l = line.trim();
    if (!l) continue;
    const cat = l.match(/^(?:카테고리|category)\s*[:：]\s*(.+)$/i);
    if (cat) {
      category = cat[1].trim();
      continue;
    }
    const kw = l.match(/^(?:키워드|keywords?)\s*[:：]\s*(.+)$/i);
    if (kw) {
      keywords = kw[1].trim();
      continue;
    }
    bodyLines.push(l);
  }

  // 링크 1개 → 메시지 전체가 상품명 (쿠팡 앱 공유 형식)
  if (urls.length === 1) {
    const p = parseOne(bodyLines, urls[0], category, keywords, text);
    return p ? [p] : [];
  }

  // 링크 여러 개 → 줄 단위로 쪼갠다. 카테고리·키워드 지정은 전체에 공통 적용.
  const out: Parsed[] = [];
  for (const line of bodyLines) {
    const found = [...new Set(line.match(globalRe) ?? [])];
    if (found.length !== 1) continue; // 링크가 없거나 한 줄에 여러 개면 판단 불가 → 건너뜀
    const p = parseOne([line], found[0], category, keywords, line);
    if (p) out.push(p);
  }
  return out;
}

// ── 등록 ───────────────────────────────────────
interface AddResult {
  added: Product[];
  skipped: { name: string; reason: string }[];
}

function addProducts(parsed: Parsed[]): AddResult {
  const products = loadProducts();
  const added: Product[] = [];
  const skipped: { name: string; reason: string }[] = [];

  for (const p of parsed) {
    if (products.some((x) => x.url === p.url)) {
      skipped.push({ name: p.name, reason: "이미 등록된 링크" });
      continue;
    }
    const id = products.length + 1;
    const item: Product = {
      id,
      name: p.name,
      url: p.url,
      category: p.category,
      keywords: p.keywords,
      used: false,
      slug: `product-${String(id).padStart(3, "0")}`,
    };
    products.push(item);
    added.push(item);
  }

  if (added.length && !DRY) saveProducts(products);
  return { added, skipped };
}

// ── 커밋·푸시 ──────────────────────────────────
function git(...a: string[]): string {
  return execFileSync("git", a, { encoding: "utf-8" }).trim();
}

function commitAndPush(added: Product[]): string {
  const names = added.map((p) => p.name.slice(0, 20)).join(", ");
  // 오프셋도 함께 커밋한다 — 이게 없으면 CI가 매일 같은 메시지를 다시 읽어
  // 같은 알림을 반복해서 보낸다 (CI는 실행마다 새 작업공간이라 로컬 파일이 남지 않음)
  git("add", "scripts/products.json", "scripts/.telegram-offset");
  const staged = execFileSync("git", ["diff", "--cached", "--name-only"], {
    encoding: "utf-8",
  }).trim();
  if (!staged) return "변경 없음 — 커밋 생략";
  const msg = added.length
    ? `상품 ${added.length}종 추가 (텔레그램 수신): ${names}\n\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
    : `chore: 텔레그램 수신 오프셋 갱신 [skip ci]`;
  git("commit", "-m", msg);
  try {
    git("push", "origin", "HEAD:main");
  } catch {
    // 발행 워크플로가 products.json을 먼저 커밋했을 수 있다 → 리베이스 후 재시도
    git("pull", "--rebase", "origin", "main");
    git("push", "origin", "HEAD:main");
  }
  return `커밋·푸시 완료 (${git("rev-parse", "--short", "HEAD")})`;
}

// ── 보고 ───────────────────────────────────────
async function reply(text: string): Promise<void> {
  if (!TG_TOKEN || !TG_CHAT || DRY) return;
  await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TG_CHAT, text, disable_web_page_preview: true }),
  });
}

// ── 메인 ───────────────────────────────────────
async function main() {
  if (!TG_TOKEN || !TG_CHAT) {
    console.error("❌ TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID 가 .env.local에 필요합니다.");
    process.exit(1);
  }

  // --stdin: 텔레그램 대신 붙여넣은 텍스트로 처리 (대화창으로 받은 목록 등)
  let texts: string[];
  let lastId: number | null = null;
  if (STDIN) {
    texts = [fs.readFileSync(0, "utf-8")];
    console.log("입력: 표준입력");
  } else {
    const r = await fetchUpdates();
    texts = r.texts;
    lastId = r.lastId;
    console.log(`새 메시지 ${texts.length}건`);
  }

  const parsed: Parsed[] = [];
  const orphanLinks: string[] = []; // 링크는 있는데 상품명이 없어 등록 못 한 것
  let ignored = 0;
  for (const t of texts) {
    const ps = parseMessage(t);
    if (ps.length) {
      parsed.push(...ps);
      continue;
    }
    // 링크는 왔는데 상품명이 없으면 조용히 버리지 말고 되물어야 한다
    const links = t.match(new RegExp(COUPANG_RE.source, "gi"));
    if (links) orphanLinks.push(...new Set(links));
    else ignored++;
  }
  if (ignored) console.log(`  (쿠팡 링크가 없어 무시: ${ignored}건)`);
  if (orphanLinks.length)
    console.log(`  ⚠️ 상품명 없는 링크 ${orphanLinks.length}건: ${orphanLinks.join(", ")}`);
  console.log(`상품 ${parsed.length}건 인식`);

  const { added, skipped } = parsed.length
    ? addProducts(parsed)
    : { added: [], skipped: [] as { name: string; reason: string }[] };

  for (const p of added) {
    console.log(`✅ [${p.id}] ${p.name}`);
    console.log(`     ${p.slug} | ${p.category} | ${p.keywords}`);
  }
  for (const s of skipped) console.log(`⏭️  ${s.name} — ${s.reason}`);
  if (!parsed.length) console.log("등록할 상품이 없습니다.");

  // 읽은 메시지는 소비 처리해서 다음 실행 때 다시 안 보게 한다
  if (lastId !== null && !DRY) writeOffset(lastId + 1);

  // 등록된 상품이 없어도 오프셋 갱신은 커밋해야 CI가 같은 메시지를 다시 읽지 않는다
  let pushNote = "";
  if (PUSH && !DRY) {
    try {
      pushNote = "\n" + commitAndPush(added);
    } catch (e: any) {
      pushNote = `\n⚠️ 커밋·푸시 실패: ${e.message?.slice(0, 200)}`;
    }
    console.log(pushNote.trim());
  }

  const pending = loadProducts().filter((p) => !p.used).length;
  console.log(`대기중인 상품: ${pending}개`);

  // ── 텔레그램 보고 ────────────────────────────
  // 매일 자동 실행되므로 "새로 등록된 게 있을 때"와 "재고가 바닥일 때"만 보낸다.
  // 이미 등록된 링크를 다시 읽어 skipped만 나온 경우는 조용히 넘어간다.
  const lines: string[] = [];

  if (added.length) {
    lines.push(`📦 [득템로그] 상품 ${added.length}종 등록 완료`);
    lines.push(...added.map((p) => `  · [${p.id}] ${p.name} (${p.slug})`));
    if (skipped.length)
      lines.push(...skipped.map((s) => `  ⏭️ ${s.name} — ${s.reason}`));
    lines.push("");
    lines.push(`대기중인 상품: ${pending}개`);
    if (pushNote) lines.push(pushNote.trim());
    else if (!PUSH)
      lines.push(`⚠️ 아직 로컬에만 있습니다 — 푸시해야 자동 발행에 반영됩니다.`);
  }

  // 이미 등록된 링크를 다시 보내신 경우도 알려드린다 (보냈는데 무반응이면 안 되니)
  const dupLinks = skipped.length && !added.length ? skipped : [];
  if (dupLinks.length) {
    if (lines.length) lines.push("");
    lines.push(`ℹ️ [득템로그] 이미 등록된 상품이라 건너뛰었습니다:`);
    lines.push(...dupLinks.map((s) => `  · ${s.name}`));
  }

  if (orphanLinks.length) {
    // 상품명이 없어도 링크로 이미 등록된 건지는 알 수 있다 → 괜히 상품명을 요구하지 않는다
    const all = loadProducts();
    const known = orphanLinks.filter((u) => all.some((p) => p.url === u));
    const unknown = orphanLinks.filter((u) => !known.includes(u));

    if (known.length) {
      if (lines.length) lines.push("");
      lines.push(`ℹ️ [득템로그] 이미 등록된 링크입니다:`);
      for (const u of known) {
        const p = all.find((x) => x.url === u)!;
        lines.push(`  · [${p.id}] ${p.name} (${p.slug}${p.used ? ", 발행완료" : ", 대기중"})`);
      }
    }
    if (unknown.length) {
      if (lines.length) lines.push("");
      lines.push(
        `⚠️ [득템로그] 상품명이 없어 등록하지 못한 링크 ${unknown.length}건:`,
        ...unknown.map((u) => `  · ${u}`),
        ``,
        `상품명과 링크를 같이 보내주세요. 예:`,
        `  유한락스 멀티액션 곰팡이제거제 510ml 3개`,
        `  https://link.coupang.com/a/...`
      );
    }
  }

  if (pending < LOW_STOCK) {
    if (lines.length) lines.push("");
    const weeks = (pending / PUBLISH_PER_WEEK).toFixed(1);
    lines.push(
      `⚠️ [득템로그] 상품 재고 ${pending}개 — 약 ${weeks}주치입니다.`,
      `쿠팡 앱에서 공유 → 텔레그램으로 상품을 보내주시면 자동 등록됩니다.`,
      `이번 주 후보는 일요일 아침에 따로 보내드립니다.`
    );
  }

  if (!lines.length) {
    console.log("보고할 내용 없음 — 텔레그램 전송 생략.");
    return;
  }

  console.log("\n" + lines.join("\n"));
  await reply(lines.join("\n"));
}

// 직접 실행할 때만 동작 (parseMessage를 테스트에서 import할 수 있게)
if (process.argv[1]?.includes("product-inbox")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
