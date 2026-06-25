"use client";

import { useState } from "react";

interface PostShareButtonProps {
  slug: string;
  title: string;
}

export default function PostShareButton({ slug, title }: PostShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const postUrl = `${process.env.NEXT_PUBLIC_SITE_URL || ""}/posts/${slug}`;

  const stop = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); };

  const handleCopy = async (e: React.MouseEvent) => {
    stop(e);
    try {
      await navigator.clipboard.writeText(postUrl);
    } catch {
      const el = document.createElement("textarea");
      el.value = postUrl;
      el.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => { setCopied(false); setOpen(false); }, 1800);
  };

  const openWindow = (e: React.MouseEvent, url: string) => {
    stop(e);
    window.open(url, "_blank", "width=550,height=450");
    setOpen(false);
  };

  const items = [
    {
      label: "카카오",
      color: "#3C1E1E",
      hoverBg: "#FEF9C3",
      url: `https://story.kakao.com/share?url=${encodeURIComponent(postUrl)}`,
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="#3C1E1E">
          <path d="M12 3C6.477 3 2 6.477 2 10.8c0 2.74 1.63 5.16 4.1 6.66l-.9 3.37c-.06.24.21.43.42.3L9.8 18.8C10.5 18.93 11.24 19 12 19c5.523 0 10-3.477 10-8s-4.477-8-10-8z"/>
        </svg>
      ),
    },
    {
      label: "밴드",
      color: "#00C73C",
      hoverBg: "#f0fdf4",
      url: `https://band.us/plugin/share?body=${encodeURIComponent(title + "\n" + postUrl)}&route=${encodeURIComponent(postUrl)}`,
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" fill="#00C73C"/>
          <rect x="9" y="7" width="2.2" height="10" rx="1.1" fill="white"/>
          <rect x="12.8" y="7" width="2.2" height="10" rx="1.1" fill="white"/>
        </svg>
      ),
    },
    {
      label: "페이스북",
      color: "#1877F2",
      hoverBg: "#eff6ff",
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(postUrl)}`,
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="#1877F2">
          <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.97h-1.513c-1.491 0-1.956.93-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
        </svg>
      ),
    },
    {
      label: "X",
      color: "#000",
      hoverBg: "#f1f5f9",
      url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(postUrl)}`,
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      ),
    },
  ];

  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <button
        onClick={(e) => { stop(e); setOpen(!open); }}
        aria-label="공유하기"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.35rem",
          padding: "0.35rem 0.75rem",
          borderRadius: "999px",
          border: "1.5px solid var(--border)",
          background: open ? "var(--accent-faint)" : "var(--bg)",
          color: open ? "var(--accent)" : "var(--ink-muted)",
          fontSize: "0.75rem",
          fontWeight: 600,
          cursor: "pointer",
          transition: "all 0.15s",
        }}
      >
        <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
          <circle cx="15" cy="4" r="2" stroke="currentColor" strokeWidth="1.6"/>
          <circle cx="5" cy="10" r="2" stroke="currentColor" strokeWidth="1.6"/>
          <circle cx="15" cy="16" r="2" stroke="currentColor" strokeWidth="1.6"/>
          <line x1="7" y1="9" x2="13" y2="5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          <line x1="7" y1="11" x2="13" y2="15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
        </svg>
        공유
      </button>

      {open && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 40 }}
            onClick={(e) => { stop(e); setOpen(false); }}
          />
          <div style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            right: 0,
            zIndex: 50,
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            padding: "0.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
            minWidth: "140px",
          }}>
            {/* 링크 복사 */}
            <button
              onClick={handleCopy}
              style={{
                display: "flex", alignItems: "center", gap: "0.6rem",
                padding: "0.55rem 0.75rem", borderRadius: "8px",
                background: copied ? "#f0fdf4" : "transparent",
                color: copied ? "#16a34a" : "var(--ink-mid)",
                border: "none", cursor: "pointer",
                fontSize: "0.8125rem", fontWeight: 500,
                textAlign: "left", width: "100%",
                transition: "background 0.12s",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                <path d="M13 7H15C16.657 7 18 8.343 18 10C18 11.657 16.657 13 15 13H13M7 13H5C3.343 13 2 11.657 2 10C2 8.343 3.343 7 5 7H7M7 10H13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              {copied ? "복사됨! ✓" : "링크 복사"}
            </button>

            {/* 카카오 · 밴드 · 페이스북 · X */}
            {items.map(({ label, color, hoverBg, url, icon }) => (
              <button
                key={label}
                onClick={(e) => openWindow(e, url)}
                style={{
                  display: "flex", alignItems: "center", gap: "0.6rem",
                  padding: "0.55rem 0.75rem", borderRadius: "8px",
                  background: "transparent", color,
                  border: "none", cursor: "pointer",
                  fontSize: "0.8125rem", fontWeight: 500,
                  textAlign: "left", width: "100%",
                  transition: "background 0.12s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
