import { PIcon, PText, PHeading } from '@porsche-design-system/components-react';
import type { BookingStats } from '../../../hooks/useBookingStats';

interface StatCardsProps {
  stats: BookingStats;
}

const CARDS: { key: keyof BookingStats; label: string; icon: string; format?: (v: number) => string }[] = [
  { key: 'totalBookings', label: 'Total Bookings', icon: 'card' },
  { key: 'confirmedBookings', label: 'Confirmed', icon: 'check' },
  { key: 'activeToday', label: 'Active Today', icon: 'clock' },
  { key: 'totalRevenue', label: 'Total Revenue', icon: 'card', format: (v) => `${v.toLocaleString()} DKK` },
];

export function StatCards({ stats }: StatCardsProps) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-static-md">
      {CARDS.map((card) => (
        <div
          key={card.key}
          className="border border-contrast-low rounded-[var(--p-border-radius-lg)] p-static-md bg-canvas"
        >
          <div className="flex items-center gap-static-xs mb-static-xs">
            <PIcon name={card.icon as never} size="small" color="contrast-medium" />
            <PText size="x-small" color="contrast-medium">{card.label}</PText>
          </div>
          <PHeading size="medium">
            {card.format ? card.format(stats[card.key]) : stats[card.key]}
          </PHeading>
        </div>
      ))}
    </div>
  );
}
