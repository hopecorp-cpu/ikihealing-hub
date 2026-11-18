export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true" aria-live="polite">
      <span className="sr-only">Đang tải trang...</span>
      <div className="h-7 w-56 rounded-md bg-gray-200" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-lg border border-gray-100 bg-white" />
        ))}
      </div>
      <div className="rounded-lg border border-gray-100 bg-white p-4 space-y-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-4 rounded bg-gray-100" style={{ width: `${92 - i * 9}%` }} />
        ))}
      </div>
    </div>
  );
}
