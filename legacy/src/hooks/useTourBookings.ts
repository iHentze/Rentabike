import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { TourBooking, TourBookingStatus } from '../types';

export function useTourBookings() {
  const [bookings, setBookings] = useState<TourBooking[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('tour_bookings')
      .select('*, tour_date:tour_dates(*, tour:tours(*)), participants:tour_participants(*, bike:bikes(name, size, category:categories(name)))')
      .order('created_at', { ascending: false });

    if (data) setBookings(data as TourBooking[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateStatus = useCallback(async (bookingId: string, status: TourBookingStatus) => {
    await supabase.from('tour_bookings').update({ status }).eq('id', bookingId);
    await loadData();
  }, [loadData]);

  const updateNotes = useCallback(async (bookingId: string, internal_notes: string) => {
    await supabase.from('tour_bookings').update({ internal_notes }).eq('id', bookingId);
    await loadData();
  }, [loadData]);

  return { bookings, loading, refresh: loadData, updateStatus, updateNotes };
}
