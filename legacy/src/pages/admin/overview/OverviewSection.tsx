import { PHeading, PText, PButton, PSpinner } from '@porsche-design-system/components-react';
import { useBookingStats } from '../../../hooks/useBookingStats';
import { StatCards } from './StatCards';
import type { Booking } from '../../../types';

interface OverviewSectionProps {
  bookings: Booking[];
  loading: boolean;
  onRefresh: () => void;
  onNavigateToBookings: () => void;
}

export function OverviewSection({ bookings, loading, onRefresh, onNavigateToBookings }: OverviewSectionProps) {
  const stats = useBookingStats(bookings);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <PSpinner size="large" />
      </div>
    );
  }

  const recentBookings = bookings.slice(0, 5);

  return (
    <div className="flex flex-col gap-fluid-md">
      <div className="flex justify-between items-start flex-wrap gap-static-md">
        <div>
          <PHeading size="x-large" tag="h1">Dashboard</PHeading>
          <PText color="contrast-medium">Manage bookings and inventory</PText>
        </div>
        <PButton variant="secondary" icon="refresh" compact onClick={onRefresh}>
          Refresh
        </PButton>
      </div>

      <StatCards stats={stats} />

      <div>
        <div className="flex justify-between items-center mb-static-sm">
          <PHeading size="medium" tag="h2">Recent Bookings</PHeading>
          <PButton variant="tertiary" compact onClick={onNavigateToBookings}>
            View All
          </PButton>
        </div>
        {recentBookings.length === 0 ? (
          <PText color="contrast-medium">No bookings yet</PText>
        ) : (
          <div className="flex flex-col gap-static-xs">
            {recentBookings.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between border border-contrast-low rounded-[var(--p-border-radius-md)] px-static-md py-static-sm cursor-pointer hover:bg-surface transition-colors"
                onClick={onNavigateToBookings}
              >
                <div className="flex items-center gap-static-md">
                  <PText size="small" weight="semi-bold">{b.confirmation_code}</PText>
                  <PText size="small">{b.customer_name}</PText>
                </div>
                <div className="flex items-center gap-static-sm">
                  <PText size="x-small" color="contrast-medium">
                    {new Date(b.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    {' - '}
                    {new Date(b.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </PText>
                  <PText size="small" weight="semi-bold">{b.total_price.toLocaleString()} DKK</PText>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
