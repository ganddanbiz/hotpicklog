"use client";

import { useState, useRef } from "react";

interface CommentFormProps {
  postId: number;
  onCommentAdded: () => void;
}

export default function CommentForm({ postId, onCommentAdded }: CommentFormProps) {
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [content, setContent] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const honeypotRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId,
          nickname,
          password,
          content,
          website: honeypotRef.current?.value || "",
          captchaToken: captchaToken || undefined,
        }),
      });

      const data = await res.json();

      if (res.status === 429 && data.captcha_required) {
        setCaptchaRequired(true);
        setError("요청이 많습니다. hCaptcha를 완료해주세요.");
        return;
      }

      if (!res.ok) {
        setError(data.error || "댓글 등록에 실패했습니다.");
        return;
      }

      setNickname("");
      setPassword("");
      setContent("");
      setCaptchaToken("");
      setCaptchaRequired(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      onCommentAdded();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* 허니팟 - 봇 방어용 hidden 필드 */}
      <input
        ref={honeypotRef}
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        style={{ display: "none" }}
        aria-hidden="true"
      />

      <div className="flex gap-3">
        <div className="flex-1">
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="닉네임"
            maxLength={30}
            required
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#c4462f]"
          />
        </div>
        <div className="flex-1">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호 (삭제 시 필요)"
            required
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#c4462f]"
          />
        </div>
      </div>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="댓글을 입력하세요..."
        maxLength={2000}
        required
        rows={3}
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#c4462f] resize-none"
      />

      {captchaRequired && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
          <p className="mb-2">요청이 많아 보안 인증이 필요합니다.</p>
          {/* hCaptcha 위젯 - 사이트 키 설정 후 활성화 */}
          <div
            className="h-captcha"
            data-sitekey={process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY}
            data-callback={(token: string) => setCaptchaToken(token)}
          />
          {/* 개발환경 테스트용 */}
          {process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY === "10000000-ffff-ffff-ffff-000000000001" && (
            <button
              type="button"
              onClick={() => setCaptchaToken("dev-test-token")}
              className="mt-2 text-xs text-[#c4462f] underline"
            >
              [개발] 캡차 우회
            </button>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {success && (
        <p className="text-sm text-green-600">댓글이 등록되었습니다.</p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 bg-[#c4462f] text-white text-sm font-medium rounded-lg hover:bg-[#a83a26] min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? "등록 중..." : "댓글 등록"}
        </button>
      </div>
    </form>
  );
}
