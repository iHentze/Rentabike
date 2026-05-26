import { useMemo } from 'react';
import type { Booking } from '../types';

export interface BookingStats {
  totalBookings: number;
  confirmedBookings: number;
  totalRevenue: number;
  activeToday: number;
}

export function useBookingStats(bookings: Booking[]): BookingStats {
  return useMemo(() => {
    const now = new Date().toISOString();
    const today = now.split('T')[0];

    const activeStatuses = ['confirmed', 'picked_up'];
    const revenueStatuses = ['confirmed', 'picked_up', 'returned'];

    return {
      totalBookings: bookings.length,
      confirmedBookings: bookings.filter((x) => activeStatuses.includes(x.status)).length,
      totalRevenue: bookings
        .filter((x) => revenueStatuses.includes(x.status))
        .reduce((s, x) => s + x.total_price, 0),
      activeToday: bookings.filter((x) => {
        if (!activeStatuses.includes(x.status)) return false;
        if (x.start_at && x.end_at) return x.start_at <= now && x.end_at >= now;
        return x.start_date <= today && x.end_date >= today;
      }).length,
    };
  }, [bookings]);
}
