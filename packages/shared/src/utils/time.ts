/** Format a Date as a local YYYY-MM-DD string.
 *  Use this instead of `d.toISOString().split('T')[0]`, which returns the UTC
 *  date and shifts local midnight back one day in UTC+ timezones (e.g. UTC+8). */
export function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dayOfMonth = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dayOfMonth}`;
}

/** Current local date as YYYY-MM-DD. */
export function todayLocalDate(): string {
  return formatLocalDate(new Date());
}

/** Monday of the week containing dateStr (YYYY-MM-DD). */
export function getWeekStartDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return formatLocalDate(d);
}
