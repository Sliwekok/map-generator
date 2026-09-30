export function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${Math.round((n / 1024 / 1024) * 10) / 10} MB`;
  if (n < 1024) return `${Math.max(0, Math.round(n))} B`;
  return `${Math.round(n / 1024)} KB`;
}
