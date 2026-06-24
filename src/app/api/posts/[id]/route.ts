import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import pool from "@/lib/db";
import { verifyAdminKey } from "@/lib/seo";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const postId = Number(id);
    if (isNaN(postId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const { rows } = await pool.query(
      "SELECT * FROM posts WHERE id = $1",
      [postId]
    );
    const post = rows[0];

    if (!post) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await pool.query("UPDATE posts SET view_count = view_count + 1 WHERE id = $1", [postId]);

    return NextResponse.json(post);
  } catch (error) {
    console.error("GET /api/posts/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdminKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const postId = Number(id);
    if (isNaN(postId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const body = await request.json();
    const allowedFields = ["title", "content", "slug", "category", "thumbnail_url", "meta_description", "keywords", "status", "published_at"];
    const updates: string[] = [];
    const values: unknown[] = [];

    for (const field of allowedFields) {
      if (field in body) {
        updates.push(`${field} = $${updates.length + 1}`);
        values.push(body[field]);
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    values.push(postId);
    await pool.query(
      `UPDATE posts SET ${updates.join(", ")} WHERE id = $${values.length}`,
      values
    );

    // ISR 재생성
    const { rows: slugRows } = await pool.query("SELECT slug FROM posts WHERE id = $1", [postId]);
    const post = slugRows[0];
    if (post) {
      revalidatePath(`/posts/${post.slug}`);
    }
    revalidatePath("/");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/posts/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdminKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const postId = Number(id);
    if (isNaN(postId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const { rows: delRows } = await pool.query("SELECT slug FROM posts WHERE id = $1", [postId]);
    const post = delRows[0];

    await pool.query("DELETE FROM posts WHERE id = $1", [postId]);

    if (post) {
      revalidatePath(`/posts/${post.slug}`);
    }
    revalidatePath("/");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/posts/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
