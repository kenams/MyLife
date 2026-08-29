/** Parse « 2026-09-05 20:00 » ou « 05/09 20:00 » (année courante) en Date locale. */
export function parseWhen(input: string, now = new Date()): Date | null {
  const s = input.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);
  if (m) {
    return build(+m[1], +m[2], +m[3], +m[4], +m[5]);
  }
  m = s.match(/^(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})$/);
  if (m) {
    const d = build(now.getFullYear(), +m[2], +m[1], +m[3], +m[4]);
    if (!d) return null;
    if (d.getTime() < now.getTime() - 86400_000) d.setFullYear(now.getFullYear() + 1);
    return d;
  }
  return null;
}

function build(y: number, mo: number, day: number, h: number, min: number): Date | null {
  if (mo < 1 || mo > 12 || day < 1 || day > 31 || h > 23 || min > 59) return null;
  const d = new Date(y, mo - 1, day, h, min);
  if (isNaN(d.getTime()) || d.getMonth() !== mo - 1 || d.getDate() !== day) return null;
  return d;
}
