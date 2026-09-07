/** Week arithmetic shared by AI reports. Weeks are Monday–Sunday. */

function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(dateStr: string, days: number): string {
  const d = parseDate(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return formatDate(d);
}

export function getComparisonWeeks(weekStart: string) {
  const currentStart = parseDate(weekStart);
  if (currentStart.getUTCDay() !== 1) {
    throw new Error('weekStart must be a Monday');
  }
  return {
    current: { weekStart, weekEnd: addDays(weekStart, 6) },
    previous: { weekStart: addDays(weekStart, -7), weekEnd: addDays(weekStart, -1) },
  };
}
