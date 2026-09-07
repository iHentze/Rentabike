import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Tour, TourDate } from '../types';

export function useTours(activityFilter?: string) {
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('tours')
      .select('*, allowed_bikes:tour_allowed_bikes(tour_id, bike_id, bike:bikes(*, category:categories(*))), dates:tour_dates(*)')
      .order('name');

    if (activityFilter && activityFilter !== 'all') {
      query = query.eq('activity_type', activityFilter);
    }

    const { data } = await query;
    if (data) setTours(data as Tour[]);
    setLoading(false);
  }, [activityFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const createTour = useCallback(async (tour: Partial<Tour>) => {
    const { data, error } = await supabase.from('tours').insert(tour).select().maybeSingle();
    if (error) throw error;
    await loadData();
    return data;
  }, [loadData]);

  const updateTour = useCallback(async (id: string, updates: Partial<Tour>) => {
    const { error } = await supabase.from('tours').update(updates).eq('id', id);
    if (error) throw error;
    await loadData();
  }, [loadData]);

  const deleteTour = useCallback(async (id: string) => {
    const { error } = await supabase.from('tours').delete().eq('id', id);
    if (error) throw error;
    await loadData();
  }, [loadData]);

  const setAllowedBikes = useCallback(async (tourId: string, bikeIds: string[]) => {
    await supabase.from('tour_allowed_bikes').delete().eq('tour_id', tourId);
    if (bikeIds.length > 0) {
      const rows = bikeIds.map((bike_id) => ({ tour_id: tourId, bike_id }));
      await supabase.from('tour_allowed_bikes').insert(rows);
    }
    await loadData();
  }, [loadData]);

  const createTourDate = useCallback(async (tourDate: Partial<TourDate>) => {
    const { error } = await supabase.from('tour_dates').insert(tourDate);
    if (error) throw error;
    await loadData();
  }, [loadData]);

  const updateTourDate = useCallback(async (id: string, updates: Partial<TourDate>) => {
    const { error } = await supabase.from('tour_dates').update(updates).eq('id', id);
    if (error) throw error;
    await loadData();
  }, [loadData]);

  const deleteTourDate = useCallback(async (id: string) => {
    const { error } = await supabase.from('tour_dates').delete().eq('id', id);
    if (error) throw error;
    await loadData();
  }, [loadData]);

  return {
    tours,
    loading,
    refresh: loadData,
    createTour,
    updateTour,
    deleteTour,
    setAllowedBikes,
    createTourDate,
    updateTourDate,
    deleteTourDate,
  };
}
