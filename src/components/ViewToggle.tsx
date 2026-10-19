"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

interface ViewToggleProps {
  currentView: string;
}

export default function ViewToggle({ currentView }: ViewToggleProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const urlView = searchParams.get("view");
    if (!urlView) {
      const saved = localStorage.getItem("preferred-view");
      if (saved && saved !== "list") {
        const params = new URLSearchParams(searchParams.toString());
        params.set("view", saved);
        router.replace(`/?${params.toString()}`);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const switchView = (view: string) => {
    localStorage.setItem("preferred-view", view);
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", view);
    if (params.has("page")) params.set("page", "1"); // 전체 목록(?page=)에서 홈 매거진으로 튕기지 않게
    router.push(`/?${params.toString()}`);
  };

  return (
    <div className="view-toggle">
      <button
        onClick={() => switchView("list")}
        aria-label="목록형"
        className={`view-btn${currentView === "list" ? " active" : ""}`}
      >
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
          <rect x="0" y="1" width="14" height="2" rx="1" fill="currentColor"/>
          <rect x="0" y="6" width="14" height="2" rx="1" fill="currentColor"/>
          <rect x="0" y="11" width="14" height="2" rx="1" fill="currentColor"/>
        </svg>
        목록
      </button>
      <button
        onClick={() => switchView("card")}
        aria-label="카드형"
        className={`view-btn${currentView === "card" ? " active" : ""}`}
      >
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
          <rect x="0" y="0" width="6" height="6" rx="1.5" fill="currentColor"/>
          <rect x="8" y="0" width="6" height="6" rx="1.5" fill="currentColor"/>
          <rect x="0" y="8" width="6" height="6" rx="1.5" fill="currentColor"/>
          <rect x="8" y="8" width="6" height="6" rx="1.5" fill="currentColor"/>
        </svg>
        카드
      </button>
    </div>
  );
}
