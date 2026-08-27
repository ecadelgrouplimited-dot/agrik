export function normalizePhone(raw: string): string {
  const trimmed = raw.trim().replace(/[\s-]/g, "");
  if (trimmed.startsWith("+")) return trimmed;
  if (trimmed.startsWith("0")) return `+256${trimmed.slice(1)}`;
  if (trimmed.startsWith("256")) return `+${trimmed}`;
  return `+256${trimmed}`;
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}
