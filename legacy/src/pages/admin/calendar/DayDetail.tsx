import { useMemo } from 'react';
import { PHeading, PText, PButtonPure, PIcon, PTag } from '@porsche-design-system/components-react';
import { StatusTag } from '../shared/StatusTag';
import type { Booking } from '../../../types';

interface DayDetailProps {
  dateStr: string;
  bookings: Booking[];
  onViewBooking: (b: Booking) => void;
  onClose: () => void;
}

const STATUS_COLORS: Record<string, { border: string }> = {
  confirmed: { border: '#017E2F' },
  pending: { border: '#FF9B00' },
  cancelled: { border: '#E50000' },
};

function getPickupTime(b: Booking): string {
  if (b.pickup_time) return b.pickup_time.slice(0, 5);
  if (b.start_at) return b.start_at.slice(11, 16);
  return '';
}

function getDropoffTime(b: Booking): string {
  if (b.dropoff_time) return b.dropoff_time.slice(0, 5);
  if (b.end_at) return b.end_at.slice(11, 16);
  return '';
}

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type TimeGroup = 'morning' | 'afternoon' | 'evening' | 'all-day';

function getTimeGroup(time: string): TimeGroup {
  if (!time) return 'all-day';
  const hour = parseInt(time.slice(0, 2), 10);
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

const GROUP_LABELS: Record<TimeGroup, string> = {
  'morning': 'Morning',
  'afternoon': 'Afternoon',
  'evening': 'Evening',
  'all-day': 'All Day',
};

const GROUP_ICONS: Record<TimeGroup, string> = {
  'morning': 'sun',
  'afternoon': 'sun',
  'evening': 'moon',
  'all-day': 'clock',
};

export function DayDetail({ dateStr, bookings, onViewBooking, onClose }: DayDetailProps) {
  const d = new Date(dateStr + 'T00:00:00');
  const isToday = toYMD(new Date()) === dateStr;
  const nowTime = `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;

  const formatted = d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const sortedBookings = useMemo(() => {
    return [...bookings].sort((a, b) => {
      const ta = getPickupTime(a) || '99:99';
      const tb = getPickupTime(b) || '99:99';
      return ta.localeCompare(tb);
    });
  }, [bookings]);

  const grouped = useMemo(() => {
    const groups = new Map<TimeGroup, Booking[]>();
    for (const b of sortedBookings) {
      const pickup = dateStr === b.start_date ? getPickupTime(b) : '';
      const group = getTimeGroup(pickup);
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)!.push(b);
    }
    const order: TimeGroup[] = ['morning', 'afternoon', 'evening', 'all-day'];
    return order.filter(g => groups.has(g)).map(g => ({ group: g, items: groups.get(g)! }));
  }, [sortedBookings, dateStr]);

  const totalRevenue = bookings.reduce((sum, b) => sum + b.total_price, 0);
  const activeCount = bookings.filter(b => b.status === 'confirmed').length;
  const pendingCount = bookings.filter(b => b.status === 'pending').length;

  return (
    <div className="border border-contrast-low rounded-[var(--p-border-radius-lg)] bg-surface overflow-hidden">
      <div className="flex items-center justify-between px-static-md py-static-sm border-b border-contrast-low">
        <div className="flex items-center gap-static-sm">
          <PIcon name="calendar" />
          <PHeading size="small" tag="h3">{formatted}</PHeading>
          {isToday && <PTag variant="info" compact>Today</PTag>}
        </div>
        <PButtonPure icon="close" hideLabel onClick={onClose}>Close</PButtonPure>
      </div>

      {bookings.length > 0 && (
        <div className="flex items-center gap-static-md px-static-md py-static-xs border-b border-contrast-low bg-canvas">
          <div className="flex items-center gap-static-xs">
            <PText size="x-small" color="contrast-medium">{bookings.length} booking{bookings.length !== 1 ? 's' : ''}</PText>
          </div>
          <div className="w-px h-[14px] bg-contrast-low" />
          {activeCount > 0 && (
            <div className="flex items-center gap-static-xs">
              <PTag variant="success" compact>{activeCount} confirmed</PTag>
            </div>
          )}
          {pendingCount > 0 && (
            <div className="flex items-center gap-static-xs">
              <PTag variant="warning" compact>{pendingCount} pending</PTag>
            </div>
          )}
          <div className="flex-1" />
          <PText size="x-small" weight="semi-bold">{totalRevenue.toLocaleString()} DKK</PText>
        </div>
      )}

      {bookings.length === 0 ? (
        <div className="p-static-md text-center">
          <PText color="contrast-medium">No bookings on this date</PText>
        </div>
      ) : (
        <div className="flex flex-col">
          {grouped.map(({ group, items }) => (
            <div key={group}>
              <div className="flex items-center gap-static-xs px-static-md py-static-xs bg-canvas border-b border-contrast-low">
                <PIcon name={GROUP_ICONS[group] as 'sun' | 'moon' | 'clock'} size="x-small" color="contrast-medium" />
                <PText size="xx-small" weight="semi-bold" color="contrast-medium">
                  {GROUP_LABELS[group]}
                </PText>
              </div>
              {items.map(b => {
                const colors = STATUS_COLORS[b.status] || STATUS_COLORS.pending;
                const pickup = dateStr === b.start_date ? getPickupTime(b) : '';
                const dropoff = dateStr === b.end_date ? getDropoffTime(b) : '';

                const isActive = isToday && b.status === 'confirmed' && (() => {
                  if (dateStr === b.start_date && dateStr === b.end_date) {
                    return nowTime >= (pickup || '00:00') && nowTime <= (dropoff || '23:59');
                  }
                  if (dateStr === b.start_date) return nowTime >= (pickup || '00:00');
                  if (dateStr === b.end_date) return nowTime <= (dropoff || '23:59');
                  return true;
                })();

                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => onViewBooking(b)}
                    className={`flex items-center gap-static-md px-static-md py-static-sm border-b border-contrast-low last:border-b-0 hover:bg-[rgba(148,149,152,.18)] transition-colors text-left ${isActive ? 'bg-success-soft' : ''}`}
                    style={{ outline: 'none' }}
                  >
                    <div
                      className="w-[4px] self-stretch rounded-full shrink-0"
                      style={{ backgroundColor: colors.border }}
                    />

                    <div className="w-[52px] shrink-0 text-center">
                      {pickup ? (
                        <div className="flex flex-col items-center">
                          <PText size="small" weight="semi-bold">{pickup}</PText>
                          {dropoff && (
                            <PText size="xx-small" color="contrast-medium">{dropoff}</PText>
                          )}
                        </div>
                      ) : (
                        <PText size="xx-small" color="contrast-medium">--:--</PText>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-static-sm">
                        <PText size="small" weight="semi-bold">{b.customer_name}</PText>
                        <PText size="x-small" color="contrast-medium">{b.confirmation_code}</PText>
                        {isActive && (
                          <PTag variant="success" compact icon="clock">Active</PTag>
                        )}
                      </div>
                      <div className="flex items-center gap-static-sm mt-[2px]">
                        <PText size="x-small" color="contrast-medium">
                          {new Date(b.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          {' - '}
                          {new Date(b.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </PText>
                      </div>
                      {b.items && b.items.length > 0 && (
                        <PText size="x-small" color="contrast-medium" className="mt-[2px]">
                          {b.items.map(item => `${item.quantity}x ${item.bike?.name || 'Bike'}`).join(', ')}
                        </PText>
                      )}
                    </div>

                    <div className="flex items-center gap-static-sm shrink-0">
                      <StatusTag status={b.status} />
                      <PText size="small" weight="semi-bold">{b.total_price.toLocaleString()} DKK</PText>
                      <PIcon name="arrow-head-right" size="small" color="contrast-medium" />
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
