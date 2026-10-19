export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <div className="flex flex-col items-center gap-3">
        <div
          className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: "var(--coral)", borderTopColor: "transparent" }}
        />
        <p className="text-sm" style={{ color: "var(--ink-muted)" }}>불러오는 중...</p>
      </div>
    </div>
  );
}
