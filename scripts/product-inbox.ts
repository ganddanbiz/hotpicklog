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

export function parseMessage(text: string): Parsed | null {
  const urlMatch = text.match(COUPANG_RE);
  if (!urlMatch) return null;
  const url = urlMatch[0];

  let category = "";
  let keywords = "";
  const nameLines: string[] = [];

  for (const line of text.split(/\r?\n/)) {
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
    // 링크가 들어간 줄에서 링크만 걷어내고 남는 글자는 상품명 후보로 쓴다
    const rest = l.replace(COUPANG_RE, "").trim();
    if (rest) nameLines.push(rest);
  }

  const name = nameLines.join(" ").replace(/\s+/g, " ").trim();
  if (!name) return null; // 상품명을 못 찾으면 등록하지 않는다

  return {
    name,
    url,
    category: category || "생활",
    keywords: keywords || autoKeywords(name),
    raw: text,
  };
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
  git("add", "scripts/products.json");
  const staged = execFileSync("git", ["diff", "--cached", "--name-only"], {
    encoding: "utf-8",
  }).trim();
  if (!staged) return "변경 없음 — 커밋 생략";
  git(
    "commit",
    "-m",
    `상품 ${added.length}종 추가 (텔레그램 수신): ${names}\n\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
  );
  git("push", "origin", "HEAD:main");
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

  const { texts, lastId } = await fetchUpdates();
  console.log(`새 메시지 ${texts.length}건`);

  const parsed: Parsed[] = [];
  let ignored = 0;
  for (const t of texts) {
    const p = parseMessage(t);
    if (p) parsed.push(p);
    else ignored++;
  }
  if (ignored) console.log(`  (쿠팡 링크나 상품명이 없어 무시: ${ignored}건)`);

  if (!parsed.length) {
    console.log("등록할 상품이 없습니다.");
    // 읽은 메시지는 소비 처리해서 다음 실행 때 다시 안 보게 한다
    if (lastId !== null && !DRY) writeOffset(lastId + 1);
    return;
  }

  const { added, skipped } = addProducts(parsed);

  for (const p of added) {
    console.log(`✅ [${p.id}] ${p.name}`);
    console.log(`     ${p.slug} | ${p.category} | ${p.keywords}`);
  }
  for (const s of skipped) console.log(`⏭️  ${s.name} — ${s.reason}`);

  if (lastId !== null && !DRY) writeOffset(lastId + 1);

  let pushNote = "";
  if (added.length && PUSH && !DRY) {
    try {
      pushNote = "\n" + commitAndPush(added);
    } catch (e: any) {
      pushNote = `\n⚠️ 커밋·푸시 실패: ${e.message?.slice(0, 200)}`;
    }
    console.log(pushNote.trim());
  }

  const pending = loadProducts().filter((p) => !p.used).length;
  const lines = [
    `📦 [득템로그] 상품 ${added.length}종 등록 완료`,
    ...added.map((p) => `  · [${p.id}] ${p.name} (${p.slug})`),
    ...skipped.map((s) => `  ⏭️ ${s.name} — ${s.reason}`),
    ``,
    `대기중인 상품: ${pending}개`,
  ];
  if (pushNote) lines.push(pushNote.trim());
  else if (added.length && !PUSH)
    lines.push(`⚠️ 아직 로컬에만 있습니다 — 푸시해야 자동 발행에 반영됩니다.`);

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
