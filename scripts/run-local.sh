#!/bin/bash
# launchd(com.aios.deuktem)가 홀수일 14:00에 실행 — 검수관이 재지시할 때도 이 작업을 깨운다(launchctl kickstart).
# 2026-11-14 GitHub Actions(daily-post.yml)에서 맥미니 로컬 실행으로 이전. 워크플로는 수동 예비용.
set -u
cd "$(dirname "$0")/.." || exit 1
MEDIA="$HOME/My World/Media"
export PATH="$HOME/.local/bin:$HOME/.nvm/versions/node/v24.18.0/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
echo "── $(date '+%F %T') 실행 (deuktem)"

# 검수관 localRunning()이 보는 잠금 파일 (90분 이내면 '실행 중')
LOCK=".generate.lock"
touch "$LOCK"
trap 'rm -f "$LOCK"' EXIT

git pull -q --ff-only origin main || echo "git pull 실패 — 로컬 사본으로 진행"

# npm ci: package-lock.json이 설치본보다 새로울 때만
if [ ! -d node_modules ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  npm ci --no-audit --no-fund || { echo "npm ci 실패"; exit 1; }
fi

# 환경변수 (값은 출력하지 않는다)
# .env.local을 source하지 않고 한 줄씩 읽는다 — 값에 공백·&가 있어도(예: SITE_NAME=지구촌 TMI, DATABASE_URL=...&...) 깨지지 않게
while IFS= read -r line || [ -n "$line" ]; do
  line="${line%$'\r'}"
  case "$line" in ''|'#'*) continue;; esac
  k="${line%%=*}"; v="${line#*=}"
  [[ "$k" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
  v="${v#\"}"; v="${v%\"}"
  export "$k=$v"
done < ./.env.local
if [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]; then
  export CLAUDE_CODE_OAUTH_TOKEN="$(grep -E '^CLAUDE_CODE_OAUTH_TOKEN=' "$MEDIA/.env" | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//')"
fi
# 구독 토큰만 쓴다 — API 키가 구독 인증을 덮어쓰지 않게 비운다(비어 있으면 dotenv도 덮어쓰지 않음)
export ANTHROPIC_API_KEY="" BLOG_ANTHROPIC_API_KEY=""
export POST_STATUS=draft   # 검수관(컨트롤타워)이 검수 후 공개
export NEXT_PUBLIC_SITE_NAME="득템로그"

rc=0
if ! npm run generate; then
  echo "1차 실패 — 120초 후 재시도"; sleep 120
  npm run generate; rc=$?
fi

# products.json 사용 표시 커밋 (telegram-inbox와 같은 파일 — 충돌 시 rebase 후 재시도)
git add scripts/products.json
if git diff --cached --quiet; then
  echo "변경 없음"
else
  git -c user.name=tugman77 -c user.email=144212220+tugman77@users.noreply.github.com \
    commit -q -m "chore: mark published product as used [skip ci]"
  PUSH=(-c credential.helper= -c "credential.helper=!gh auth git-credential")
  git "${PUSH[@]}" push -q origin HEAD:main \
    || { git "${PUSH[@]}" pull -q --rebase origin main && git "${PUSH[@]}" push -q origin HEAD:main; } \
    || echo "products.json push 실패"
fi
exit $rc
