import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

const BOT = /bot|crawl|spider|slurp|headless|preview|curl|wget|python|node-fetch/i;

// 조회수 +1 — 방문자 브라우저의 ViewCounter만 부른다. 공개된 글만, 로봇은 세지 않는다.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const postId = Number(id);
    if (!Number.isInteger(postId) || postId <= 0) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    if (BOT.test(request.headers.get("user-agent") || "")) {
      return new NextResponse(null, { status: 204 });
    }
    await pool.query(
      "UPDATE posts SET view_count = view_count + 1 WHERE id = $1 AND status = 'published'",
      [postId]
    );
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("POST /api/posts/[id]/view error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
