export function formatDuration(value: number | null): string {
  if (value === null) return "—";
  const totalSeconds = value / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  return minutes > 0 ? `${minutes}:${seconds.toFixed(3).padStart(6, "0")}` : seconds.toFixed(3);
}
export function formatClock(value: number): string {
  const clamped = Math.max(0, value);
  const hours = Math.floor(clamped / 3_600_000);
  const minutes = Math.floor((clamped % 3_600_000) / 60_000);
  const seconds = Math.floor((clamped % 60_000) / 1000);
  const tenths = Math.floor((clamped % 1000) / 100);
  return `${hours > 0 ? `${String(hours).padStart(2, "0")}:` : ""}${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths}`;
}

export function formatDate(value: string): string {
  const normalized = value.endsWith("Z") ? value : `${value}Z`;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(normalized));
}
