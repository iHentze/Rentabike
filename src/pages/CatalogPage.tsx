import { useState, useEffect, useCallback } from 'react';
import {
  PHeading,
  PText,
  PInputDate,
  PButton,
  PTabsBar,
  PSpinner,
  PInlineNotification,
  PIcon,
  PDivider,
  PTag,
} from '@porsche-design-system/components-react';
import { supabase } from '../lib/supabase';
import { useCart } from '../store/cartStore';
import { BikeCard } from '../components/BikeCard';
import { computeRentalDuration, formatDuration } from '../utils/rentalDuration';
import type { Bike, Category } from '../types';

interface AvailabilityMap {
  [bikeId: string]: number;
}

async function fetchAvailability(startAt: string, endAt: string): Promise<AvailabilityMap> {
  const { data, error } = await supabase
    .from('booking_items')
    .select('bike_id, quantity, bookings!inner(start_at, end_at, status)')
    .neq('bookings.status', 'cancelled')
    .lt('bookings.start_at', endAt)
    .gt('bookings.end_at', startAt);

  if (error || !data) return {};

  const booked: Record<string, number> = {};
  for (const item of data as Array<{ bike_id: string; quantity: number }>) {
    booked[item.bike_id] = (booked[item.bike_id] || 0) + item.quantity;
  }
  return booked;
}

const CATEGORY_ICONS: Record<string, string> = {
  'e-bikes': 'flash',
  'mountain-bikes': 'country-road',
  'gravel-bikes': 'highway',
  'road-bikes': 'car',
  'children-bikes': 'heart',
  accessories: 'attachment',
};

export function CatalogPage() {
  const { startDate, endDate, startAt, endAt, rentalDays: cartRentalDays, setDates } = useCart();
  const [localStart, setLocalStart] = useState(startDate || '');
  const [localEnd, setLocalEnd] = useState(endDate || '');
  const [bikes, setBikes] = useState<Bike[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [availability, setAvailability] = useState<AvailabilityMap>({});
  const today = new Date().toISOString().split('T')[0];
  const hasDates = !!(localStart && localEnd);
  const datesApplied = !!(startDate && endDate);

  useEffect(() => {
    Promise.all([
      supabase.from('categories').select('*').order('name'),
      supabase.from('bikes').select('*, category:categories(*)').order('name'),
    ]).then(([catRes, bikeRes]) => {
      if (catRes.data) setCategories(catRes.data);
      if (bikeRes.data) setBikes(bikeRes.data as Bike[]);
      setLoading(false);
    });
  }, []);

  const loadAvailability = useCallback(async () => {
    if (!startAt || !endAt) return;
    const avail = await fetchAvailability(startAt, endAt);
    setAvailability(avail);
  }, [startAt, endAt]);

  useEffect(() => {
    loadAvailability();
  }, [loadAvailability]);

  function applyDates() {
    setDates(localStart, localEnd);
  }

  const filteredBikes = bikes.filter((b) => {
    if (activeCategory === 'all') return true;
    return b.category?.slug === activeCategory;
  });

  const enrichedBikes = filteredBikes.map((bike) => ({
    ...bike,
    available_quantity:
      localStart && localEnd
        ? bike.total_quantity - (availability[bike.id] || 0)
        : bike.total_quantity,
  }));

  const categoryTabs = [{ slug: 'all', name: 'All Bikes', icon: 'grid' }, ...categories.map((c) => ({ ...c, icon: CATEGORY_ICONS[c.slug] || 'car' }))];
  const activeTabIndex = categoryTabs.findIndex((c) => c.slug === activeCategory);

  const rentalDays = cartRentalDays;

  const availableCount = enrichedBikes.filter((b) => (b.available_quantity || 0) > 0).length;

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <PSpinner size="large" />
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          background: 'linear-gradient(135deg, var(--p-color-background-surface) 0%, var(--p-color-background-base) 100%)',
          borderBottom: '1px solid var(--p-color-contrast-low)',
          padding: 'clamp(32px, 5vw, 64px) clamp(16px, 4vw, 48px) 0',
        }}
      >
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ marginBottom: '32px' }}>
            <PHeading size="xx-large" tag="h1" style={{ marginBottom: '8px' }}>
              Rent a Bike
            </PHeading>
            <PText size="medium" color="contrast-medium">
              Explore the Faroe Islands on two wheels — {bikes.length} bikes available
            </PText>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-end',
              flexWrap: 'wrap',
              padding: '20px 24px',
              backgroundColor: 'var(--p-color-background-base)',
              borderRadius: 'var(--p-border-radius-lg) var(--p-border-radius-lg) 0 0',
              border: '1px solid var(--p-color-contrast-low)',
              borderBottom: 'none',
              boxShadow: '0px -4px 20px rgba(0,0,0,0.04)',
            }}
          >
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap', flex: 1 }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px', minWidth: '100%' }}>
                <PIcon name="calendar" size="small" color="contrast-medium" />
                <PText size="small" weight="semi-bold">Select your rental period</PText>
              </div>
              <PInputDate
                label="Pick-up date"
                name="pickup"
                value={localStart}
                min={today}
                onInput={(e) => setLocalStart((e.target as HTMLInputElement).value)}
              />
              <div style={{ display: 'flex', alignItems: 'center', paddingBottom: '10px' }}>
                <PIcon name="arrow-right" size="small" color="contrast-medium" />
              </div>
              <PInputDate
                label="Return date"
                name="return"
                value={localEnd}
                min={localStart || today}
                onInput={(e) => setLocalEnd((e.target as HTMLInputElement).value)}
              />
              {hasDates && rentalDays > 0 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    paddingBottom: '10px',
                  }}
                >
                  <PTag variant="secondary" compact icon="clock">
                    {formatDuration(computeRentalDuration(startAt, endAt))}
                  </PTag>
                </div>
              )}
            </div>
            <PButton
              onClick={applyDates}
              disabled={!hasDates || rentalDays <= 0}
              icon="check"
            >
              Check Availability
            </PButton>
          </div>

          {datesApplied && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '0 24px',
                height: '40px',
                backgroundColor: 'var(--p-color-notification-success-soft)',
                border: '1px solid var(--p-color-contrast-low)',
                borderTop: 'none',
                borderBottom: 'none',
              }}
            >
              <PIcon name="check" size="x-small" color="notification-success" />
              <PText size="x-small" color="contrast-medium">
                {availableCount} bikes available for{' '}
                <strong>
                  {new Date(startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  {' – '}
                  {new Date(endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </strong>
              </PText>
            </div>
          )}

          <div
            style={{
              padding: '0 24px',
              backgroundColor: 'var(--p-color-background-base)',
              borderLeft: '1px solid var(--p-color-contrast-low)',
              borderRight: '1px solid var(--p-color-contrast-low)',
            }}
          >
            <PTabsBar
              activeTabIndex={activeTabIndex >= 0 ? activeTabIndex : 0}
              onUpdate={(e) => setActiveCategory(categoryTabs[e.detail.activeTabIndex].slug)}
            >
              {categoryTabs.map((cat) => (
                <button key={cat.slug} type="button">
                  {cat.name}
                </button>
              ))}
            </PTabsBar>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px clamp(16px, 4vw, 48px) 64px' }}>
        {datesApplied && enrichedBikes.length > 0 && enrichedBikes.every((b) => (b.available_quantity || 0) <= 0) && (
          <PInlineNotification
            state="warning"
            heading="No bikes available for selected dates"
            description="All bikes in this category are booked. Please try different dates or browse another category."
            dismissButton={false}
            style={{ marginBottom: '24px' }}
          />
        )}

        {enrichedBikes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 16px' }}>
            <PIcon name="car" size="x-large" color="contrast-low" />
            <PText size="large" color="contrast-medium" style={{ marginTop: '16px' }}>
              No bikes in this category
            </PText>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '8px' }}>
              <PText size="small" color="contrast-medium">
                {enrichedBikes.length} {enrichedBikes.length === 1 ? 'bike' : 'bikes'}
                {activeCategory !== 'all' && ` in ${categoryTabs.find((c) => c.slug === activeCategory)?.name}`}
              </PText>
              {!datesApplied && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <PIcon name="information" size="x-small" color="contrast-medium" />
                  <PText size="x-small" color="contrast-medium">Select dates above to check availability</PText>
                </div>
              )}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))',
                gap: '24px',
              }}
            >
              {enrichedBikes.map((bike) => (
                <BikeCard key={bike.id} bike={bike} />
              ))}
            </div>
          </>
        )}

        <PDivider style={{ margin: '64px 0 32px' }} />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
            gap: '24px',
          }}
        >
          {[
            { icon: 'geo-localization', title: 'Two locations', desc: 'Pick up in Tórshavn or Vágar Airport' },
            { icon: 'check', title: 'Helmet included', desc: 'Safety gear provided at no extra cost' },
            { icon: 'clock', title: 'Flexible hours', desc: 'Open 09:00–18:00 daily' },
            { icon: 'card', title: 'Pay at pick-up', desc: 'No advance payment required' },
          ].map((item) => (
            <div
              key={item.title}
              style={{
                display: 'flex',
                gap: '16px',
                alignItems: 'flex-start',
                padding: '20px',
                border: '1px solid var(--p-color-contrast-low)',
                borderRadius: 'var(--p-border-radius-lg)',
                backgroundColor: 'var(--p-color-background-surface)',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--p-color-background-base)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  border: '1px solid var(--p-color-contrast-low)',
                }}
              >
                <PIcon name={item.icon as never} size="small" />
              </div>
              <div>
                <PText size="small" weight="semi-bold" style={{ marginBottom: '2px' }}>{item.title}</PText>
                <PText size="x-small" color="contrast-medium">{item.desc}</PText>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
