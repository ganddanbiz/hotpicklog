/**
 * 쿠팡 파트너스 상품 등록 스크립트
 * 사용법:
 *   npx tsx scripts/add-product.ts <상품명> <URL> [카테고리] [키워드]
 *   npx tsx scripts/add-product.ts 목록
 *   npx tsx scripts/add-product.ts 태그 <id> <태그HTML>   ← 쿠팡 파트너스 배너 태그 등록
 */

import * as fs from "fs";
import * as path from "path";

const PRODUCTS_FILE = path.resolve(process.cwd(), "scripts/products.json");

export interface Product {
  id: number;
  name: string;
  url: string;
  category: string;
  keywords: string;
  used: boolean;
  slug: string;
  tag?: string;        // 쿠팡 파트너스 배너 태그 HTML
  referenceUrl?: string; // 참조 유튜브/링크
}

export function loadProducts(): Product[] {
  if (!fs.existsSync(PRODUCTS_FILE)) return [];
  const raw = fs.readFileSync(PRODUCTS_FILE, "utf-8").trim();
  if (!raw || raw === "[]") return [];
  return JSON.parse(raw) as Product[];
}

export function saveProducts(products: Product[]): void {
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2) + "\n", "utf-8");
}

// ── 직접 실행 시에만 CLI 동작 ────────────────────────────
if (process.argv[1]?.includes("add-product")) {
  const args = process.argv.slice(2);

  if (args[0] === "목록" || args[0] === "list") {
    const products = loadProducts();
    if (!products.length) {
      console.log("등록된 상품이 없습니다.");
      console.log("추가 방법: npx tsx scripts/add-product.ts <상품명> <URL> [카테고리] [키워드]");
    } else {
      console.log(`\n등록된 상품 (총 ${products.length}개)\n`);
      for (const p of products) {
        const status = p.used ? "✅ 발행완료" : "⏳ 대기중 ";
        console.log(`${status} [${p.id}] ${p.name}`);
        console.log(`        URL: ${p.url}`);
        console.log(`        카테고리: ${p.category} | 슬러그: ${p.slug}`);
        console.log(`        태그: ${p.tag ? "등록됨 ✅" : "없음"}`);
      }
      const pending = products.filter((p) => !p.used).length;
      console.log(`\n대기중: ${pending}개 | 발행완료: ${products.length - pending}개\n`);
    }
    process.exit(0);
  }

  // 태그 등록: npx tsx scripts/add-product.ts 태그 <id> <태그HTML>
  if (args[0] === "태그" || args[0] === "tag") {
    const id = Number(args[1]);
    const tagHtml = args.slice(2).join(" ");

    if (!id || !tagHtml) {
      console.error("사용법: npx tsx scripts/add-product.ts 태그 <id> <태그HTML>");
      process.exit(1);
    }

    const products = loadProducts();
    const target = products.find((p) => p.id === id);
    if (!target) {
      console.error(`❌ id ${id}인 상품을 찾을 수 없습니다.`);
      process.exit(1);
    }

    target.tag = tagHtml;
    saveProducts(products);
    console.log(`✅ 태그 등록 완료! [${id}] ${target.name}`);
    process.exit(0);
  }

  const [name, url, category = "상품리뷰", keywords = ""] = args;

  if (!name || !url) {
    console.error("사용법: npx tsx scripts/add-product.ts <상품명> <URL> [카테고리] [키워드]");
    console.error("목록 보기: npx tsx scripts/add-product.ts 목록");
    process.exit(1);
  }

  if (!url.startsWith("http")) {
    console.error("❌ URL은 http:// 또는 https://로 시작해야 합니다.");
    process.exit(1);
  }

  const products = loadProducts();
  const id = products.length + 1;
  const slug = `product-${String(id).padStart(3, "0")}`;

  products.push({ id, name, url, category, keywords, used: false, slug });
  saveProducts(products);

  const pending = products.filter((p) => !p.used).length;
  console.log(`✅ 상품 추가 완료!`);
  console.log(`   [${id}] ${name}`);
  console.log(`   URL: ${url}`);
  console.log(`   카테고리: ${category}`);
  console.log(`   슬러그: ${slug}`);
  console.log(`\n현재 대기중인 상품: ${pending}개`);
}
