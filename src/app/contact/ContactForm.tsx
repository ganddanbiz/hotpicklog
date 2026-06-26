"use client";
import { useState } from "react";

const INQUIRY_TYPES = [
  "콘텐츠 오류 신고",
  "광고·제휴 문의",
  "개인정보 요청",
  "기타 문의",
];

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.625rem 0.875rem",
  fontSize: "0.9375rem",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  background: "var(--bg)",
  color: "var(--ink)",
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.875rem",
  fontWeight: 600,
  color: "var(--ink)",
  marginBottom: "0.4rem",
};

export default function ContactForm() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    type: INQUIRY_TYPES[0],
    message: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.message.trim()) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "12px",
        padding: "3rem 1.5rem",
        textAlign: "center",
      }}>
        <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>✅</div>
        <p style={{ fontWeight: 700, fontSize: "1.0625rem", color: "var(--ink)", marginBottom: "0.5rem" }}>
          문의가 접수됐습니다
        </p>
        <p style={{ fontSize: "0.875rem", color: "var(--ink-muted)", lineHeight: 1.7 }}>
          검토 후 빠르게 답변드리겠습니다.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

      {/* 이름 */}
      <div>
        <label style={labelStyle}>이름 <span style={{ fontWeight: 400, color: "var(--ink-muted)" }}>(선택)</span></label>
        <input
          type="text"
          name="name"
          value={form.name}
          onChange={handleChange}
          placeholder="홍길동"
          style={inputStyle}
        />
      </div>

      {/* 이메일 */}
      <div>
        <label style={labelStyle}>이메일 <span style={{ fontWeight: 400, color: "var(--ink-muted)" }}>(선택 — 답변 원하시면 입력)</span></label>
        <input
          type="email"
          name="email"
          value={form.email}
          onChange={handleChange}
          placeholder="example@email.com"
          style={inputStyle}
        />
      </div>

      {/* 문의 유형 */}
      <div>
        <label style={labelStyle}>문의 유형</label>
        <select
          name="type"
          value={form.type}
          onChange={handleChange}
          style={inputStyle}
        >
          {INQUIRY_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* 내용 */}
      <div>
        <label style={labelStyle}>내용 <span style={{ color: "var(--accent)" }}>*</span></label>
        <textarea
          name="message"
          value={form.message}
          onChange={handleChange}
          required
          placeholder="문의 내용을 입력해주세요."
          rows={6}
          style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
        />
      </div>

      {status === "error" && (
        <p style={{ fontSize: "0.875rem", color: "#ef4444", margin: 0 }}>
          전송 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.
        </p>
      )}

      <button
        type="submit"
        disabled={status === "loading" || !form.message.trim()}
        style={{
          padding: "0.75rem 1.5rem",
          background: "var(--accent)",
          color: "#fff",
          fontWeight: 700,
          fontSize: "0.9375rem",
          border: "none",
          borderRadius: "8px",
          cursor: status === "loading" ? "not-allowed" : "pointer",
          opacity: status === "loading" || !form.message.trim() ? 0.6 : 1,
          transition: "opacity 0.15s",
        }}
      >
        {status === "loading" ? "전송 중..." : "문의 보내기"}
      </button>
    </form>
  );
}
