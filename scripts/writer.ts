// 집필 엔진 전환기 — Codex(ChatGPT 구독)가 쓰고, 실패하면 Claude(구독)가 대신 쓴다.
// 2026-11-23 대표님 결정: "Codex가 쓰고 Claude가 검수". 검수관(Claude)이 쓴 모델과 다른 모델로 검수하게 된다.
//
// 기존 코드의 `anthropic.messages.create({ model, max_tokens, messages })` 호출을 그대로 둔 채
// 클라이언트만 감싼다 — 프롬프트·후처리·자동 주제 추론은 바뀌지 않는다.
//   WRITER=codex(기본) · WRITER=claude(되돌리기, Codex를 아예 부르지 않음)
//   CODEX_TIMEOUT_MIN(기본 12) · CODEX_BIN
// 이 파일은 득템로그·단단한50·지구촌TMI에 같은 내용으로 있다.
import { spawnSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// 토큰 A단계(2026-11-26): AI 호출 1번마다 ~/Library/Logs/aios-usage.jsonl에 한 줄 기록. 기록 실패는 무시(발행에 영향 없음).
function aiSpawn(job: string, bin: string, args: string[], opts: any): any {
  const t0 = Date.now();
  const r: any = spawnSync(bin, args, opts);
  try {
    const err = String(r.stderr || "");
    const tok = err.match(/tokens used\s*:?\s*([\d,]+)/i)?.[1];
    fs.appendFileSync(path.join(os.homedir(), "Library/Logs/aios-usage.jsonl"), JSON.stringify({
      t: new Date().toISOString(), who: "codex", job: `deuktem:${job}`, sec: Math.round((Date.now() - t0) / 1000),
      ok: r.status === 0, limit: /usage limit|rate limit|quota/i.test(err), tokens: tok ? Number(tok.replace(/,/g, "")) : null,
    }) + "\n");
  } catch {}
  return r;
}


type CreateFn = (params: any, ...rest: any[]) => Promise<any>;

const OUTPUT_RULE =
  "\n\n[출력 규칙] 최종 답변에는 위에서 요청한 결과물만 그대로 출력한다. " +
  "작업 설명·인사·확인 질문·출처 목록 덧붙이기·코드 블록(```) 감싸기를 하지 않는다. " +
  "파일을 만들거나 고치지 말고 답변 본문으로만 낸다. " +
  "본문에 링크(<a> 태그)·URL을 넣지 않는다(필요한 링크는 프로그램이 따로 붙인다). " +
  "사실(수치·연도·기록·인명·기관)은 웹 검색으로 확인한 것만 쓰고, 확인되지 않으면 쓰지 않거나 단정하지 않는다.";

function codexBin(): string {
  if (process.env.CODEX_BIN) return process.env.CODEX_BIN;
  const local = path.join(os.homedir(), ".local/bin/codex");
  if (fs.existsSync(local)) return local;
  return fs.existsSync("/opt/homebrew/bin/codex") ? "/opt/homebrew/bin/codex" : "codex";
}

function promptOf(params: any): string {
  const sys = typeof params.system === "string" ? params.system + "\n\n" : "";
  const body = (params.messages || [])
    .map((m: any) => (typeof m.content === "string" ? m.content : (m.content || []).map((c: any) => c.text || "").join("\n")))
    .join("\n\n");
  return sys + body;
}

function runCodex(prompt: string, tag: string): string {
  // Desktop 밖 임시 폴더에서 돌린다 (컨트롤타워 절대 규칙 10)
  const work = path.join(os.tmpdir(), "aios-headless", tag);
  fs.mkdirSync(work, { recursive: true });
  const outPath = path.join(work, `out-${process.pid}-${Date.now()}.txt`);
  const args = ["--search", "exec", "--skip-git-repo-check", "--ephemeral", "-s", "read-only", "-C", work,
    "-c", 'model_reasoning_effort="medium"', "-o", outPath, "-"];
  const timeoutMin = Number(process.env.CODEX_TIMEOUT_MIN || 12);
  const r = aiSpawn("write", codexBin(), args, {
    input: prompt + OUTPUT_RULE, encoding: "utf8", timeout: timeoutMin * 60 * 1000, maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, PATH: `${path.join(os.homedir(), ".local/bin")}:/opt/homebrew/bin:${process.env.PATH || "/usr/bin:/bin"}`,
      OPENAI_API_KEY: "" }, // 구독 로그인만 쓴다
  });
  if (r.error) throw new Error(`Codex 실행 실패: ${r.error.message}`);
  if (!fs.existsSync(outPath)) {
    const tail = (r.stderr || "").split("\n").filter(Boolean).slice(-3).join(" | ").slice(0, 200);
    throw new Error(`Codex 출력 없음(종료 ${r.status}): ${tail}`);
  }
  const text = fs.readFileSync(outPath, "utf8").trim();
  fs.rmSync(outPath, { force: true });
  if (text.length < 200) throw new Error(`Codex 출력이 너무 짧음(${text.length}자)`);
  return text;
}

/** Claude 클라이언트를 받아, messages.create만 Codex 우선으로 바꾼 클라이언트를 돌려준다. */
export function withCodexWriter<T extends { messages: { create: CreateFn } }>(client: T, tag: string): T {
  const mode = (process.env.WRITER || "codex").toLowerCase();
  if (mode === "claude") return client;
  const claudeCreate = client.messages.create.bind(client.messages);
  const wrapped = Object.create(client);
  wrapped.messages = Object.create(client.messages);
  wrapped.messages.create = async (params: any, ...rest: any[]) => {
    const t0 = Date.now();
    try {
      const text = runCodex(promptOf(params), tag);
      console.log(`✍️  집필: Codex (${Math.round((Date.now() - t0) / 1000)}초, ${text.length}자)`);
      return { content: [{ type: "text", text }], model: "codex-cli", role: "assistant", stop_reason: "end_turn" };
    } catch (e: any) {
      console.log(`⚠️  Codex 집필 실패 → Claude로 대신 씀: ${String(e?.message || e).slice(0, 200)}`);
      const t1 = Date.now();
      const res = await claudeCreate(params, ...rest);
      try { // 토큰 A단계: Claude가 대신 쓴 경우도 기록
        const u = res?.usage || {};
        const tokens = (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
        fs.appendFileSync(path.join(os.homedir(), "Library/Logs/aios-usage.jsonl"), JSON.stringify({
          t: new Date().toISOString(), who: "claude", job: `${tag}:write-fallback`, sec: Math.round((Date.now() - t1) / 1000),
          ok: true, limit: false, tokens: tokens || null }) + "\n");
      } catch {}
      return res;
    }
  };
  return wrapped as T;
}
