"use client";

import { useState, useEffect, useCallback } from "react";

interface Comment {
  id: number;
  post_id: number;
  nickname: string;
  content: string;
  created_at: string;
}

interface CommentListProps {
  postId: number;
  refreshKey: number;
}

export default function CommentList({ postId, refreshKey }: CommentListProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/comments?postId=${postId}`);
      if (res.ok) {
        const data = await res.json();
        setComments(data);
      }
    } catch {
      // 무시
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments, refreshKey]);

  const handleDelete = async (commentId: number) => {
    const password = window.prompt("댓글 삭제를 위해 비밀번호를 입력하세요:");
    if (!password) return;

    const res = await fetch(`/api/comments/${commentId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } else {
      const data = await res.json();
      alert(data.error === "Wrong password" ? "비밀번호가 틀렸습니다." : "삭제에 실패했습니다.");
    }
  };

  if (loading) {
    return <div className="text-sm text-gray-400 py-4">댓글 불러오는 중...</div>;
  }

  if (comments.length === 0) {
    return (
      <div className="text-sm text-gray-400 py-6 text-center">
        첫 번째 댓글을 남겨보세요!
      </div>
    );
  }

  return (
    <ul className="space-y-4">
      {comments.map((comment) => {
        const date = new Date(comment.created_at).toLocaleDateString("ko-KR", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

        return (
          <li key={comment.id} className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#233347] flex items-center justify-center text-white text-sm font-bold">
              {comment.nickname.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-gray-800">{comment.nickname}</span>
                <span className="text-xs text-gray-400">{date}</span>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                {comment.content}
              </p>
            </div>
            <button
              onClick={() => handleDelete(comment.id)}
              className="flex-shrink-0 text-xs text-gray-400 hover:text-red-500 transition-colors self-start pt-1"
              title="댓글 삭제"
            >
              삭제
            </button>
          </li>
        );
      })}
    </ul>
  );
}
