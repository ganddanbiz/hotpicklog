"use client";

import { useState } from "react";
import CommentList from "./CommentList";
import CommentForm from "./CommentForm";

interface CommentSectionProps {
  postId: number;
}

export default function CommentSection({ postId }: CommentSectionProps) {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleCommentAdded = () => {
    setRefreshKey((k) => k + 1);
  };

  return (
    <section className="dt-comments bg-white rounded-xl p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-6">댓글</h2>

      <div className="mb-8">
        <CommentList postId={postId} refreshKey={refreshKey} />
      </div>

      <div className="border-t border-gray-200 pt-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">댓글 작성</h3>
        <CommentForm postId={postId} onCommentAdded={handleCommentAdded} />
      </div>
    </section>
  );
}
