"use client";

import { useEffect } from "react";

// 조회수는 방문자 브라우저에서 센다 (2026-11-01). 예전엔 글 페이지 서버 렌더에서 +1 했는데,
// 페이지가 1시간 캐시(ISR)라 실제 방문이 아니라 '페이지 재생성 횟수'가 쌓였다.
// 같은 탭 세션에서 같은 글은 한 번만, 검색 로봇·자동화 브라우저는 세지 않는다.
export default function ViewCounter({ postId }: { postId: number }) {
  useEffect(() => {
    if (navigator.webdriver || /bot|crawl|spider|slurp|headless|preview/i.test(navigator.userAgent)) return;
    const key = `viewed:${postId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // 저장소를 못 쓰는 브라우저는 그냥 센다
    }
    fetch(`/api/posts/${postId}/view`, { method: "POST", keepalive: true }).catch(() => {});
  }, [postId]);
  return null;
}
