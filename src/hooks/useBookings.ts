import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Booking, ItemStatus } from '../types';

export function useBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [updateMsg, setUpdateMsg] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('bookings')
      .select('*, items:booking_items(*, bike:bikes(name, size, price_per_day)), persons:booking_persons(*)')
      .order('created_at', { ascending: false });

    if (data) setBookings(data as Booking[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateStatus = useCallback(async (bookingId: string, status: string) => {
    await supabase.from('bookings').update({ status }).eq('id', bookingId);
    setUpdateMsg('Status updated');
    setTimeout(() => setUpdateMsg(''), 3000);
    loadData();
  }, [loadData]);

  const updateItemStatus = useCallback(async (itemId: string, itemStatus: ItemStatus) => {
    const { error } = await supabase
      .from('booking_items')
      .update({ item_status: itemStatus })
      .eq('id', itemId);
    if (error) throw error;
    await loadData();
  }, [loadData]);

  const updateAllItemsStatus = useCallback(async (bookingId: string, itemStatus: ItemStatus) => {
    const { error } = await supabase
      .from('booking_items')
      .update({ item_status: itemStatus })
      .eq('booking_id', bookingId)
      .neq('item_status', 'released');
    if (error) throw error;
    await loadData();
  }, [loadData]);

  return { bookings, loading, refresh: loadData, updateStatus, updateMsg, updateItemStatus, updateAllItemsStatus };
}
