import { useMemo } from 'react';
import { PText, PTag, PIcon } from '@porsche-design-system/components-react';
import type { Booking } from '../../../types';

interface TodaySummaryBarProps {
  bookings: Booking[];
}

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getWeekRange(d: Date): { start: string; end: string } {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: toYMD(monday), end: toYMD(sunday) };
}

export function TodaySummaryBar({ bookings }: TodaySummaryBarProps) {
  const now = new Date();
  const todayStr = toYMD(now);
  const week = getWeekRange(now);
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const { todayCount, weekCount, pendingCount, activeNow, nextPickup } = useMemo(() => {
    let todayCount = 0;
    let weekCount = 0;
    let pendingCount = 0;
    let activeNow = 0;
    let nextPickup: { name: string; time: string } | null = null;

    for (const b of bookings) {
      if (b.status === 'cancelled') continue;

      const overlapsToday = todayStr >= b.start_date && todayStr <= b.end_date;
      if (overlapsToday) todayCount++;

      const overlapsWeek = b.start_date <= week.end && b.end_date >= week.start;
      if (overlapsWeek) weekCount++;

      if (b.status === 'pending') pendingCount++;

      if (overlapsToday && b.start_at && b.end_at) {
        const startTime = b.pickup_time?.slice(0, 5) || b.start_at.slice(11, 16);
        const endTime = b.dropoff_time?.slice(0, 5) || b.end_at.slice(11, 16);

        if (todayStr === b.start_date && todayStr === b.end_date) {
          if (currentTime >= startTime && currentTime <= endTime) activeNow++;
        } else if (todayStr === b.start_date) {
          if (currentTime >= startTime) activeNow++;
        } else if (todayStr === b.end_date) {
          if (currentTime <= endTime) activeNow++;
        } else {
          activeNow++;
        }
      } else if (overlapsToday && todayStr !== b.start_date && todayStr !== b.end_date) {
        activeNow++;
      }

      if (b.start_date === todayStr && b.pickup_time) {
        const pt = b.pickup_time.slice(0, 5);
        if (pt > currentTime) {
          if (!nextPickup || pt < nextPickup.time) {
            nextPickup = { name: b.customer_name, time: pt };
          }
        }
      }
    }

    return { todayCount, weekCount, pendingCount, activeNow, nextPickup };
  }, [bookings, todayStr, week.start, week.end, currentTime]);

  return (
    <div className="flex items-center gap-static-md flex-wrap border border-contrast-low rounded-[var(--p-border-radius-lg)] bg-surface px-static-md py-static-sm">
      <div className="flex items-center gap-static-xs">
        <PIcon name="calendar" size="small" color="contrast-medium" />
        <PText size="x-small" color="contrast-medium">Today</PText>
        <PTag variant={todayCount > 0 ? 'primary' : undefined} compact>{todayCount}</PTag>
      </div>

      <div className="w-px h-[16px] bg-contrast-low" />

      <div className="flex items-center gap-static-xs">
        <PText size="x-small" color="contrast-medium">This week</PText>
        <PTag compact>{weekCount}</PTag>
      </div>

      {pendingCount > 0 && (
        <>
          <div className="w-px h-[16px] bg-contrast-low" />
          <div className="flex items-center gap-static-xs">
            <PText size="x-small" color="contrast-medium">Pending</PText>
            <PTag variant="warning" compact>{pendingCount}</PTag>
          </div>
        </>
      )}

      {activeNow > 0 && (
        <>
          <div className="w-px h-[16px] bg-contrast-low" />
          <div className="flex items-center gap-static-xs">
            <PIcon name="clock" size="small" color="contrast-medium" />
            <PText size="x-small" color="contrast-medium">Active now</PText>
            <PTag variant="success" compact>{activeNow}</PTag>
          </div>
        </>
      )}

      {nextPickup && (
        <>
          <div className="flex-1" />
          <div className="flex items-center gap-static-xs">
            <PIcon name="duration" size="small" color="contrast-medium" />
            <PText size="x-small" color="contrast-medium">
              Next pickup {nextPickup.time} -- {nextPickup.name}
            </PText>
          </div>
        </>
      )}
    </div>
  );
}
