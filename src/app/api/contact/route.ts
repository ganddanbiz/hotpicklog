import { NextRequest, NextResponse } from "next/server";

const TELEGRAM_TOKEN = "8860516747:AAGikwdjA120Jy8Dei9_IFVCFh4l3LudruI";
const TELEGRAM_CHAT_ID = "6625834513";

export async function POST(req: NextRequest) {
  const { name, email, type, message } = await req.json();

  if (!message?.trim()) {
    return NextResponse.json({ error: "내용을 입력해주세요." }, { status: 400 });
  }

  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "블로그";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";

  const text = [
    `📨 [${siteName}] 새 문의가 접수됐습니다`,
    ``,
    `📋 유형: ${type || "기타 문의"}`,
    `👤 이름: ${name?.trim() || "(미입력)"}`,
    `📧 이메일: ${email?.trim() || "(미입력)"}`,
    ``,
    `💬 내용:`,
    message.trim(),
    ``,
    `🌐 ${siteUrl}`,
  ].join("\n");

  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text }),
  });

  return NextResponse.json({ ok: true });
}
