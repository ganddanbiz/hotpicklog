# 102 득템로그 — CLAUDE.md

## 블로그 기본 정보
| 항목 | 내용 |
|------|------|
| 블로그명 | 득템로그 |
| 도메인 | hotpicklog.com |
| 언어 | 한국어 |
| 주제 | 쿠팡 파트너스 상품 리뷰 + 재테크/경매 정보 |
| AI 모델 | Claude Haiku (claude-haiku-4-5-20251001) |
| 이미지 | 네이버 이미지 API (상품), Unsplash (폴백) |
| DB | Neon PostgreSQL (us-east-1) |

## 코드베이스 출처
- **Create Next App → 경매AI블로그에서 발전한 독립 코드베이스**
- 110/130/140과 완전히 다른 구조 (코드 참조 불가)
- DB 라이브러리: `Pool` from `pg` (다른 블로그는 `@neondatabase/serverless`)
- 쿠팡 파트너스 + 상품 관리 시스템 포함 (다른 블로그에 없는 기능)
- GitHub Actions: `CLAUDE_CODE_OAUTH_TOKEN` 사용 (구독 토큰)

## 프로젝트 구조
```
102 Blog_Partners/
├── scripts/
│   ├── generate-post.ts    ← AI 글 자동 생성
│   ├── add-product.ts      ← 상품 관리
│   ├── products.json       ← 상품 목록 (used 플래그)
│   └── generate.log        ← 발행 로그
├── .env.local              ← 환경변수
├── src/lib/topics.ts       ← 일반 주제 목록
└── CLAUDE.md               ← 이 파일
```

## 발행 명령
```bash
cd "100 Blog_Manger/102 Blog_Partners"
npm run generate
```

## 발행 모드 (우선순위)
1. **상품 리뷰 모드** — `products.json`에 `used: false` 상품이 있으면 우선 발행
2. **일반 주제 모드** — 상품 없으면 `topics.ts` 기반 글 발행

## 상품 관리 명령
```bash
cd "100 Blog_Manger/102 Blog_Partners"
npm run product:add   # 상품 추가
npm run product:list  # 상품 목록 확인
npm run product:tag   # 태그 확인
```

## 쿠팡 파트너스 설정
- **고정 링크**: `https://link.coupang.com/a/eJzg1eIyu4` (모든 포스팅 공통)
- **수수료 고지 문구 필수**: "이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다."
- 글 상단: 쿠팡 배너 (빨간 그라디언트 박스)
- 글 하단: 상품별 구매 버튼 + 쿠팡 링크

## 상품 리뷰 글 작성 규칙

### 문체 (네이버 블로그 감성)
- 짧은 문장, 1~2줄마다 줄바꿈 (`<br>` 또는 새 `<p>`)
- 친근한 구어체 존댓말: "~해요", "~거든요", "~더라고요", "~했어요"
- 이모지 자연스럽게 삽입 (📦 ✅ 💡 😊 🔥 ⭐ 👍 💕)
- 첫 문장: 공감·후킹 ("요즘 이거 진짜 난리났잖아요 🔥")
- "여러분", "독자님" 호칭 금지

### 제목 규칙 (AI가 TITLE: 형식으로 출력)
- 이모지 1~2개 포함
- 후킹 유발: "써봤더니...", "솔직히 말하면", "진짜야?"
- 30자 이내
- 예: "에어팟 프로 3 써봤는데... 이건 진짜야 🎧"

### 상품 리뷰 구성 순서
1. 공감 후킹 오프닝 (2~3문장)
2. 상품 핵심 특징 3가지 (이모지 + 짧은 설명)
3. 직접 써본 솔직 후기 (장점·단점)
4. 이런 분께 추천해요 (3가지)
5. 가격 대비 가치 한줄 총평
6. FAQ 3개 (Q&A)

### HTML 출력 규칙
- 순수 HTML만, 마크다운 금지
- 허용 태그: `<h2> <h3> <p> <br> <ul> <ol> <li> <strong> <blockquote> <table> <thead> <tbody> <tr> <th> <td>`
- `<h1>` 금지
- h2 섹션 제목에도 이모지 포함 (예: `<h2>📦 이 제품, 뭐가 다를까요?</h2>`)

## 이미지 처리
- 상품 이미지: 네이버 이미지 검색 → h2 섹션마다 삽입 (클릭 시 상품 링크)
- 폴백: Unsplash
- 이미지 클릭 → 쿠팡 상품 링크 연결

## 환경변수 (.env.local)
- `BLOG_ANTHROPIC_API_KEY` — Claude API (일반 `ANTHROPIC_API_KEY` 사용 금지 → Claude Code CLI 충돌)
- `DATABASE_URL` — Neon PostgreSQL
- `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` — 네이버 이미지 API
- `NEXT_PUBLIC_SITE_URL=https://hotpicklog.com`
- `NEXT_PUBLIC_SITE_NAME=득템로그`

## GitHub 저장소 및 배포
- **GitHub:** `ganddanbiz/hotpicklog`
- **Vercel 프로젝트:** `hotpicklog`
- **자동 발행:** 매일 KST 10:00 (`0 1 * * *` UTC, GitHub Actions)
- **workflow_dispatch:** 텔레그램 `득템로그 발행` 명령으로 수동 트리거 가능

## 현재 발행 현황
- 총 20편 발행 (2026-06-25 기준, product-008까지)
- 남은 상품: 7개 (product-009~015)


## 검수 및 수정 절차

### 검수 시점
- 글 발행 후 자동 검수 또는 수동 요청 시 실행

### 검수 항목
| 항목 | 기준 |
|------|------|
| 내용 적합성 | 블로그 주제에 맞는지, 독자에게 유용한지 |
| 이미지 적합성 | 내용과 이미지가 일치하는지, 저작권 문제 없는지 |
| 사실 기반 | 통계·수치·고유명사를 웹 검색으로 팩트체크 |
| 문체·품질 | 맞춤법, 가독성, 블로그 감성 일치 여부 |

### 자주 발생하는 오류 유형
- AI가 그럴듯한 수치를 생성(hallucination) → 반드시 출처 검색 후 대조
- 이미지 키워드 미스매치 → 본문 주제와 이미지 일치 확인
- 시사 내용 outdated → 발행일 기준 최신 정보인지 확인

### 오류 수정 방법 (DB 직접 수정)
```bash
# 1. .env.local에서 DATABASE_URL 로드
source .env.local  # 또는 직접 export

# 2. 특정 slug의 content/thumbnail_url 수정
psql $DATABASE_URL -c "
UPDATE posts
SET content = $content_수정본$,
    updated_at = NOW()
WHERE slug = '수정할-slug';
"

# 3. 썸네일 교체
psql $DATABASE_URL -c "
UPDATE posts SET thumbnail_url = '새이미지URL' WHERE slug = 'slug';
"

# 4. 수정 확인
psql $DATABASE_URL -c "SELECT slug, title, updated_at FROM posts WHERE slug = 'slug';"
```

### 검수 결과 기록
- 검수 후 이슈가 있으면 `scripts/review.log`에 날짜·slug·내용·처리결과 기록
- 형식: `[YYYY-MM-DD] slug | 이슈 | 처리결과`

