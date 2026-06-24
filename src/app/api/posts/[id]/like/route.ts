import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

import { sha256 } from "@/lib/hash";
import { getClientIp } from "@/lib/seo";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const postId = Number(id);

    if (isNaN(postId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const { rows: postRows } = await pool.query(
      "SELECT id FROM posts WHERE id = $1",
      [postId]
    );

    if (!postRows[0]) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const ip = getClientIp(request);
    const ua = request.headers.get("user-agent") || "";
    const visitorHash = sha256(ip + ua);

    // 좋아요 토글: INSERT 시도 → 중복이면 DELETE
    let liked = false;
    try {
      await pool.query(
        "INSERT INTO likes (post_id, visitor_hash) VALUES ($1, $2)",
        [postId, visitorHash]
      );
      liked = true;
    } catch (err: unknown) {
      if (err instanceof Error && "code" in err && (err as { code: string }).code === "23505") {
        await pool.query(
          "DELETE FROM likes WHERE post_id = $1 AND visitor_hash = $2",
          [postId, visitorHash]
        );
        liked = false;
      } else {
        throw err;
      }
    }

    const { rows: countRows } = await pool.query(
      "SELECT COUNT(*) as count FROM likes WHERE post_id = $1",
      [postId]
    );
    const count = Number(countRows[0].count);

    return NextResponse.json({ liked, count });
  } catch (error) {
    console.error("POST /api/posts/[id]/like error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
