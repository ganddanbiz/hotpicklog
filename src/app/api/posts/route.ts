import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import pool from "@/lib/db";
import { generateSlug, verifyAdminKey } from "@/lib/seo";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 10));
    const category = searchParams.get("category") || null;
    const offset = (page - 1) * limit;

    const countResult = category
      ? await pool.query("SELECT COUNT(*) as total FROM posts WHERE status = 'published' AND category = $1", [category])
      : await pool.query("SELECT COUNT(*) as total FROM posts WHERE status = 'published'");
    const total = Number(countResult.rows[0].total);

    const postsResult = category
      ? await pool.query(
          `SELECT id, title, slug, category, thumbnail_url, meta_description,
                  published_at, created_at, view_count
           FROM posts WHERE status = 'published' AND category = $1
           ORDER BY published_at DESC LIMIT $2 OFFSET $3`,
          [category, limit, offset]
        )
      : await pool.query(
          `SELECT id, title, slug, category, thumbnail_url, meta_description,
                  published_at, created_at, view_count
           FROM posts WHERE status = 'published'
           ORDER BY published_at DESC LIMIT $1 OFFSET $2`,
          [limit, offset]
        );
    const posts = postsResult.rows;

    return NextResponse.json({
      posts,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/posts error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!verifyAdminKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { title, content, slug, category, thumbnail_url, meta_description, keywords, status, published_at } = body;

    if (!title || !content) {
      return NextResponse.json({ error: "title and content are required" }, { status: 400 });
    }

    const finalSlug = slug || generateSlug(title);

    const { rows: inserted } = await pool.query(
      `INSERT INTO posts (title, content, slug, category, thumbnail_url, meta_description, keywords, status, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        title,
        content,
        finalSlug,
        category || "general",
        thumbnail_url || null,
        meta_description || null,
        keywords || null,
        status || "draft",
        published_at || null,
      ]
    );

    revalidatePath("/");
    if (status === "published") {
      revalidatePath(`/posts/${finalSlug}`);
    }

    return NextResponse.json({ id: inserted[0].id, slug: finalSlug }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && (error as { code: string }).code === "23505") {
      return NextResponse.json({ error: "slug already exists" }, { status: 409 });
    }
    console.error("POST /api/posts error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
