export function buildDatetime(date: string, time: string): string {
  return `${date}T${time}:00`;
}

export function computeRentalDays(startAt: string, endAt: string): number {
  if (!startAt || !endAt) return 0;
  const ms = new Date(endAt).getTime() - new Date(startAt).getTime();
  if (ms <= 0) return 0;
  const totalHours = ms / (1000 * 60 * 60);
  const fullDays = Math.floor(totalHours / 24);
  const remainderHours = totalHours % 24;
  if (remainderHours === 0) return fullDays;
  if (remainderHours <= 5) return fullDays + 0.5;
  return fullDays + 1;
}

export interface RentalDuration {
  days: number;
  hours: number;
}

export function computeRentalDuration(startAt: string, endAt: string): RentalDuration {
  if (!startAt || !endAt) return { days: 0, hours: 0 };
  const ms = new Date(endAt).getTime() - new Date(startAt).getTime();
  if (ms <= 0) return { days: 0, hours: 0 };
  const totalMinutes = ms / (1000 * 60);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.round((totalMinutes % (24 * 60)) / 60);
  return { days, hours };
}

export function formatRentalDuration(days: number): string {
  if (days <= 0) return '0 days';
  if (days === 0.5) return 'half day';
  if (days === 1) return '1 day';
  if (Number.isInteger(days)) return `${days} days`;
  return `${days} days`;
}

export function formatDuration(dur: RentalDuration): string {
  const { days, hours } = dur;
  if (days === 0 && hours === 0) return '0 days';
  const parts: string[] = [];
  if (days > 0) parts.push(days === 1 ? '1 day' : `${days} days`);
  if (hours > 0) parts.push(hours === 1 ? '1 hr' : `${hours} hrs`);
  return parts.join(', ');
}

export function computeEndTime(startTime: string, durationHours: number): string {
  const [h, m] = startTime.split(':').map(Number);
  const totalMinutes = h * 60 + (m || 0) + durationHours * 60;
  const endH = Math.floor(totalMinutes / 60) % 24;
  const endM = Math.round(totalMinutes % 60);
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}

export function formatTimeRange(startTime: string, durationHours: number): string {
  const start = startTime.slice(0, 5);
  const end = computeEndTime(startTime, durationHours);
  return `${start} - ${end}`;
}
