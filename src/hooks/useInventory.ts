import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Bike, Category } from '../types';

export function useInventory() {
  const [bikes, setBikes] = useState<Bike[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [bikesRes, catsRes] = await Promise.all([
      supabase.from('bikes').select('*, category:categories(*)').order('name'),
      supabase.from('categories').select('*').order('name'),
    ]);
    if (bikesRes.data) setBikes(bikesRes.data as Bike[]);
    if (catsRes.data) setCategories(catsRes.data as Category[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateBike = useCallback(async (id: string, updates: Partial<Bike>) => {
    await supabase.from('bikes').update(updates).eq('id', id);
    loadData();
  }, [loadData]);

  const createBike = useCallback(async (bike: Omit<Bike, 'id' | 'created_at' | 'category' | 'available_quantity'>) => {
    await supabase.from('bikes').insert(bike);
    loadData();
  }, [loadData]);

  const deleteBike = useCallback(async (id: string) => {
    await supabase.from('bikes').delete().eq('id', id);
    loadData();
  }, [loadData]);

  return { bikes, categories, loading, refresh: loadData, updateBike, createBike, deleteBike };
}
