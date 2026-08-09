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
│   ├── topics.ts           ← 일반 주제 목록 (폴백용 쇼핑 가이드)
│   └── generate.log        ← 발행 로그
├── .env.local              ← 환경변수
└── CLAUDE.md               ← 이 파일
```

## 발행 명령
```bash
cd "100 Blog_Manger/102 Blog_Partners"
npm run generate
```

## 발행 모드 (우선순위)
1. **상품 리뷰 모드** — `products.json`에 `used: false` 상품이 있으면 우선 발행
2. **일반 주제 모드** — 상품 없으면 `scripts/topics.ts` 기반 글 발행
   - ⚠️ `topics.ts`는 **이 블로그가 "상품 소개 블로그"임을 전제로** 한 쇼핑·득템 가이드 주제로만 구성한다.
     ("고급 접근법 / 핵심 개념 10가지" 같은 정체불명 껍데기 예시 주제 금지 — 2026-07 실제 발행 사고 있었음)
   - 슬러그 패턴: `basic-NNN` / `mid-NNN` / `adv-NNN`. DB에 이미 있는 슬러그는 건너뛰고 다음 미발행 주제를 발행한다.

## 상품 관리 명령
```bash
cd "100 Blog_Manger/102 Blog_Partners"
npm run product:add   # 상품 추가
npm run product:list  # 상품 목록 확인
npm run product:tag   # 태그 확인
```

## 상품 조달 (트렌드조달 파이프라인 Phase 1, 2026-08-01)

상품이 떨어지면 `topics.ts` 일반 모드로 떨어져 품질이 낮아진다. 이를 막기 위한 반자동 조달 루프.
설계·경위: `000_컨트롤타워/프로젝트/득템로그-트렌드조달-파이프라인.md`

```bash
npm run product:pick              # 네이버 데이터랩으로 이번 주 상품 후보 → 텔레그램
npm run product:pick -- --dry     # 전송 없이 콘솔 출력만
npm run product:pick -- --audit   # 키워드 풀 진단 (지수 0인 키워드 찾기)
npm run product:inbox             # 텔레그램으로 받은 쿠팡 상품을 products.json에 등록
npm run product:inbox -- --push   # 등록 후 커밋·푸시까지
npm run product:inbox -- --stdin  # 텔레그램 대신 붙여넣은 텍스트로 등록
```

### 자동 실행
| 워크플로 | 주기 | 내용 |
|---|---|---|
| `weekly-product-pick.yml` | 일요일 KST 08:00 | 이번 주 뜨는 상품 후보 5개 → 텔레그램 |
| `telegram-inbox.yml` | 매일 KST 06:00 | 텔레그램으로 받은 상품 등록·푸시 + 재고 3개 미만이면 경고 |

### 대표님 흐름
쿠팡 앱에서 **공유 → 텔레그램 → @Tugmanbot**. 상품명과 링크가 함께 있으면 자동 등록된다.
여러 개를 한 메시지에 보내도 되고, `카테고리:` / `키워드:` 줄로 덮어쓸 수 있다.
**링크만 보내면 등록되지 않고 상품명을 되묻는다** (이미 등록된 링크면 그 사실을 알려준다).

### 주의
- ⚠️ **네이버 쇼핑 검색 API(`/v1/search/shop.json`)는 사용 불가** — 404(SE05).
  같은 자격증명으로 image·blog·news는 200이므로 서비스 종료로 판단. 시세·대표상품 표시는 포기하고
  쿠팡·네이버쇼핑 검색 링크로 대체했다. 열리면 코드 수정 없이 자동 복구된다.
- ⚠️ **데이터랩은 카테고리 안에서의 클릭 비중만 준다.** `keyword-pool.ts`의 `category`가 틀리면
  지수가 0으로 나와 후보에서 조용히 탈락한다. 키워드를 추가하면 `--audit`으로 반드시 확인할 것.
  (철 지난 키워드는 `--from/--to`로 제철 구간을 지정해야 판단이 된다)
- ⚠️ `scripts/.telegram-offset`은 **커밋 대상이다.** CI는 실행마다 새 작업공간이라 이게 없으면
  매일 같은 메시지를 다시 읽어 같은 알림을 반복한다.
- ⚠️ **GitHub 예약은 최대 1시간 넘게 밀린다** (2026-08-02 실측: 23:30 예약 → 01:07 실행, 97분).
  그래서 inbox를 발행 3시간 전(06:00)에 둔다. `daily-post.yml`과 `telegram-inbox.yml`은 둘 다
  products.json을 커밋하므로 `concurrency: products-json`으로 묶고 push는 rebase 재시도를 붙였다.
  **products.json을 쓰는 워크플로를 새로 만들면 같은 그룹에 넣을 것.**

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
- ⚠️ **일반 주제 글은 썸네일이 Unsplash에만 의존** → `UNSPLASH_ACCESS_KEY` 미설정 시 썸네일이 비어(🏛️ 빈 카드) 발행된다.
  키가 없으면 발행 후 네이버 이미지 API로 썸네일을 수동 보완할 것. (상품 글은 네이버 이미지라 문제 없음)
- ⚠️ **썸네일 저작권 주의**: 네이버 이미지 검색 결과에 `depositphotos / shutterstock / istockphoto / gettyimages / 123rf` 등
  워터마크 스톡 이미지가 섞인다. 썸네일은 쿠팡/네이버 쇼핑 CDN(`coupangcdn.com`, `phinf.naver.net`) 등 깨끗한 상품 이미지로 고를 것.

## 환경변수 (.env.local)
- `BLOG_ANTHROPIC_API_KEY` — Claude API (일반 `ANTHROPIC_API_KEY` 사용 금지 → Claude Code CLI 충돌)
- `DATABASE_URL` — Neon PostgreSQL
- `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` — 네이버 이미지 API
- `NEXT_PUBLIC_SITE_URL=https://hotpicklog.com`
- `NEXT_PUBLIC_SITE_NAME=득템로그`

## GitHub 저장소 및 배포
- **GitHub:** `ganddanbiz/hotpicklog`
- **Vercel 프로젝트:** `hotpicklog`
- **자동 발행:** 이틀에 한 번, 홀숫날 KST 09:00 (`0 0 */2 * *` UTC, GitHub Actions)
  - 2026-08-09 변경. 그 전에는 화·목·토 주3회(`0 0 * * 2,4,6`)였다.
  - 31일까지 있는 달만 31일→1일이 연달아 발행된다 (cron이 요일이 아닌 날짜 기준이라 생기는 경계).
- **workflow_dispatch:** 텔레그램 `득템로그 발행` 명령으로 수동 트리거 가능

## 현재 발행 현황
- 2026-07-16 기준: 상품 리뷰 product-001~022 + 일반 주제 basic-001 발행됨
- 자동 발행(매일 KST 10:00)이 정상 작동 중 → products.json의 미발행 상품을 순서대로 소진
- **2026-07 정리 작업**: 템플릿 예시 껍데기 글 5편(basic-001~003, mid-001, adv-001) 삭제,
  `topics.ts`를 상품 블로그용 쇼핑 가이드 주제로 교체, basic-001("쿠팡 가성비 상품 고르는 법") 수동 발행

## 운영 주의사항 (2026-07 확인)
- ⚠️ **이 폴더(`참고폴더/득템로그`)는 로컬 사본** — 실제 자동 발행은 GitHub 저장소(`ganddanbiz/hotpicklog`)
  기준으로 돈다. `topics.ts` / `products.json` 등 **파일 수정은 커밋·푸시해야 자동 발행에 반영**된다.
  (단, `DATABASE_URL`은 프로덕션 Neon이라 DB 직접 수정·발행은 로컬에서도 즉시 라이브 반영됨)
- ⚠️ **products.json `used` 플래그가 실제 DB와 어긋날 수 있음** — 로컬 사본에는 자동 발행분이 누락되기도 한다.
  발행 전 `SELECT slug FROM posts WHERE slug ~ '^product-'`로 대조해 `used`를 DB 기준으로 동기화할 것.
  (동기화 없이 generate 시 이미 발행된 상품 슬러그 → UNIQUE 충돌 또는 중복 글 위험)


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

