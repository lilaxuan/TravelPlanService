export function tripLengthInDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = Math.max(0, end.getTime() - start.getTime());
  return Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
}
