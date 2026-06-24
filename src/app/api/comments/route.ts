import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import pool from "@/lib/db";

import { sha256 } from "@/lib/hash";
import { getClientIp } from "@/lib/seo";
import { checkHoneypot, checkRateLimit, verifyCaptcha, logSpam } from "@/lib/spam";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const postId = Number(searchParams.get("postId"));

    if (!postId || isNaN(postId)) {
      return NextResponse.json({ error: "postId is required" }, { status: 400 });
    }

    const { rows: comments } = await pool.query(
      `SELECT id, post_id, nickname, content, created_at
       FROM comments
       WHERE post_id = $1 AND is_approved = true
       ORDER BY created_at ASC`,
      [postId]
    );

    return NextResponse.json(comments);
  } catch (error) {
    console.error("GET /api/comments error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const ip = getClientIp(request);

    // 1단계: 허니팟 검사
    if (checkHoneypot(body)) {
      await logSpam(ip, "honeypot", JSON.stringify({ postId: body.postId }));
      // 봇에게 성공처럼 보이게 200 응답
      return NextResponse.json({ id: 0, success: true });
    }

    // 2단계: Rate Limit 검사
    const { limited, requireCaptcha } = await checkRateLimit(ip, "comment");
    if (limited) {
      const captchaToken = body.captchaToken;
      if (!captchaToken) {
        return NextResponse.json(
          { error: "Too many requests", captcha_required: true },
          { status: 429 }
        );
      }

      // 3단계: hCaptcha 검증
      const captchaOk = await verifyCaptcha(captchaToken);
      if (!captchaOk) {
        await logSpam(ip, "captcha_fail", JSON.stringify({ postId: body.postId }));
        return NextResponse.json(
          { error: "Captcha verification failed", captcha_required: true },
          { status: 429 }
        );
      }
    }
    void requireCaptcha; // unused but from destructure

    const { postId, nickname, password, content } = body;

    if (!postId || !nickname || !password || !content) {
      return NextResponse.json(
        { error: "postId, nickname, password, content are required" },
        { status: 400 }
      );
    }

    if (nickname.length > 30) {
      return NextResponse.json({ error: "nickname too long" }, { status: 400 });
    }

    if (content.length > 2000) {
      return NextResponse.json({ error: "content too long" }, { status: 400 });
    }

    // 글 존재 확인
    const { rows: postRows } = await pool.query(
      "SELECT id FROM posts WHERE id = $1",
      [postId]
    );
    if (!postRows[0]) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const ipHash = sha256(ip);

    const { rows: inserted } = await pool.query(
      `INSERT INTO comments (post_id, nickname, password, content, ip_hash, is_approved)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id`,
      [postId, nickname, passwordHash, content, ipHash]
    );

    return NextResponse.json({ id: inserted[0].id, success: true }, { status: 201 });
  } catch (error) {
    console.error("POST /api/comments error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
