# 120 득템로그 — CLAUDE.md

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

## 프로젝트 구조
```
120 Blog_ Partners/
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
cd "120 Blog_ Partners"
npm run generate
```

## 발행 모드 (우선순위)
1. **상품 리뷰 모드** — `products.json`에 `used: false` 상품이 있으면 우선 발행
2. **일반 주제 모드** — 상품 없으면 `topics.ts` 기반 글 발행

## 상품 관리 명령
```bash
cd "120 Blog_ Partners"
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

## 현재 발행 현황
- 총 15편 발행 (2026-06-23 기준, product-005까지)
- 남은 상품: 10개 (2026-06-23 기준)
