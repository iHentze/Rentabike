import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Location } from '../types';

export function useLocations() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('locations').select('*').order('sort_order');
    if (data) setLocations(data as Location[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const createLocation = useCallback(
    async (location: Omit<Location, 'id' | 'created_at'>) => {
      await supabase.from('locations').insert(location);
      loadData();
    },
    [loadData],
  );

  const updateLocation = useCallback(
    async (id: string, updates: Partial<Location>) => {
      await supabase.from('locations').update(updates).eq('id', id);
      loadData();
    },
    [loadData],
  );

  const deleteLocation = useCallback(
    async (id: string) => {
      await supabase.from('locations').delete().eq('id', id);
      loadData();
    },
    [loadData],
  );

  return { locations, loading, refresh: loadData, createLocation, updateLocation, deleteLocation };
}
