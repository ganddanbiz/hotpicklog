import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import pool from "@/lib/db";

import { verifyAdminKey } from "@/lib/seo";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const commentId = Number(id);

    if (isNaN(commentId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const { rows: commentRows } = await pool.query(
      "SELECT id, password FROM comments WHERE id = $1",
      [commentId]
    );
    const comment = commentRows[0];

    if (!comment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // 관리자 인증
    if (verifyAdminKey(request)) {
      await pool.query("DELETE FROM comments WHERE id = $1", [commentId]);
      return NextResponse.json({ success: true });
    }

    // 비밀번호 검증
    const body = await request.json().catch(() => ({}));
    const { password } = body;

    if (!password) {
      return NextResponse.json({ error: "Password required" }, { status: 401 });
    }

    const passwordOk = await bcrypt.compare(password, comment.password);
    if (!passwordOk) {
      return NextResponse.json({ error: "Wrong password" }, { status: 403 });
    }

    await pool.query("DELETE FROM comments WHERE id = $1", [commentId]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/comments/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
