import { useState, useEffect } from 'react';
import {
  PDisplay,
  PText,
  PHeading,
  PTag,
  PIcon,
  PSpinner,
  PSegmentedControl,
  PSegmentedControlItem,
} from '@porsche-design-system/components-react';
import {
  spacingFluidMedium,
  spacingFluidSmall,
  spacingFluidLarge,
  spacingStaticSmall,
  spacingStaticMedium,
  borderRadiusLarge,
  motionDurationShort,
  motionEasingBase,
  motionDurationModerate,
  motionEasingIn,
  dropShadowLowStyle,
} from '@porsche-design-system/components-react/styles';
import { supabase } from '../lib/supabase';
import type { Page, Tour } from '../types';

interface ToursPageProps {
  onNavigate?: (page: Page) => void;
  onSelectTour: (tourId: string) => void;
}

type TourWithDates = Tour & { next_date?: string; upcoming_dates: string[] };

const ACTIVITY_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'bike', label: 'Biking' },
  { value: 'combo', label: 'Hike & Bike' },
  { value: 'hike', label: 'Hiking' },
  { value: 'trail-run', label: 'Trail Run' },
];

const ACTIVITY_ICONS: Record<string, string> = {
  bike: 'country-road',
  combo: 'arrows',
  hike: 'map',
  'trail-run': 'flash',
};

const DATE_FILTERS = [
  { value: 'all', label: 'All dates' },
  { value: 'today', label: 'Today' },
  { value: 'this-week', label: 'This week' },
  { value: 'this-month', label: 'This month' },
  { value: 'next-7', label: 'Next 7 days' },
  { value: 'next-30', label: 'Next 30 days' },
];

function getLocalToday(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDateRange(filter: string): { start: string; end: string } | null {
  const todayStr = getLocalToday();
  const parts = todayStr.split('-').map(Number);
  const today = new Date(parts[0], parts[1] - 1, parts[2]);

  switch (filter) {
    case 'today':
      return { start: todayStr, end: todayStr };
    case 'this-week': {
      const day = today.getDay();
      const diff = day === 0 ? 0 : 7 - day;
      const end = new Date(today);
      end.setDate(today.getDate() + diff);
      return { start: todayStr, end: formatDate(end) };
    }
    case 'this-month': {
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { start: todayStr, end: formatDate(end) };
    }
    case 'next-7': {
      const end = new Date(today);
      end.setDate(today.getDate() + 7);
      return { start: todayStr, end: formatDate(end) };
    }
    case 'next-30': {
      const end = new Date(today);
      end.setDate(today.getDate() + 30);
      return { start: todayStr, end: formatDate(end) };
    }
    default:
      return null;
  }
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: 'notification-success-soft',
  moderate: 'notification-warning-soft',
};

function DateFilterChip({ label, active, count, onClick }: {
  label: string;
  active: boolean;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: active ? '8px 16px' : '8px 16px',
        border: active ? '2px solid #010205' : '1px solid #D8D8DB',
        borderRadius: '100px',
        background: active ? '#010205' : '#FFF',
        color: active ? '#FFF' : '#010205',
        cursor: 'pointer',
        transition: `all ${motionDurationShort} ${motionEasingBase}`,
        fontFamily: "'Porsche Next','Arial Narrow',Arial,sans-serif",
        fontSize: '14px',
        fontWeight: active ? 600 : 400,
        lineHeight: '1.5',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
      {count > 0 && (
        <span style={{
          background: active ? 'rgba(255,255,255,0.2)' : '#EEEFF2',
          color: active ? '#FFF' : '#535457',
          borderRadius: '100px',
          padding: '1px 8px',
          fontSize: '12px',
          fontWeight: 600,
          minWidth: '20px',
          textAlign: 'center',
        }}>
          {count}
        </span>
      )}
    </button>
  );
}

export function ToursPage({ onSelectTour }: ToursPageProps) {
  const [tours, setTours] = useState<TourWithDates[]>([]);
  const [loading, setLoading] = useState(true);
  const [activityFilter, setActivityFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

  useEffect(() => {
    async function load() {
      setLoading(true);
      const today = getLocalToday();
      const { data } = await supabase
        .from('tours')
        .select('*, dates:tour_dates(*), allowed_bikes:tour_allowed_bikes(bike_id)')
        .eq('is_active', true)
        .order('name');

      if (data) {
        const withNextDate: TourWithDates[] = data.map((t: Tour & { dates?: { date: string; is_cancelled: boolean }[] }) => {
          const upcoming = (t.dates || [])
            .filter((d) => !d.is_cancelled && d.date >= today)
            .sort((a, b) => a.date.localeCompare(b.date));
          return { ...t, next_date: upcoming[0]?.date || '', upcoming_dates: upcoming.map((d) => d.date) };
        });
        setTours(withNextDate);
      }
      setLoading(false);
    }
    load();
  }, []);

  const range = getDateRange(dateFilter);

  const filtered = tours.filter((t) => {
    if (activityFilter !== 'all' && t.activity_type !== activityFilter) return false;
    if (dateFilter !== 'all' && range) {
      const hasDateInRange = t.upcoming_dates.some((d) => d >= range.start && d <= range.end);
      if (!hasDateInRange) return false;
    }
    return true;
  });

  function countForDateFilter(filterValue: string): number {
    const r = getDateRange(filterValue);
    return tours.filter((t) => {
      if (activityFilter !== 'all' && t.activity_type !== activityFilter) return false;
      if (filterValue !== 'all' && r) {
        return t.upcoming_dates.some((d) => d >= r.start && d <= r.end);
      }
      return true;
    }).length;
  }

  return (
    <div>
      <section
        style={{
          position: 'relative',
          minHeight: 'clamp(320px, 40vw, 440px)',
          display: 'flex',
          alignItems: 'flex-end',
          overflow: 'hidden',
          marginTop: '-64px',
          paddingTop: '64px',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'url(/tours-hero.webp)',
            backgroundSize: 'cover',
            backgroundPosition: 'center 40%',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.6) 70%, rgba(0,0,0,0.8) 100%)',
          }}
        />
        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '1200px',
            margin: '0 auto',
            padding: `${spacingFluidLarge} ${spacingFluidMedium}`,
          }}
        >
          <PTag theme="dark" color="background-frosted" icon="map" style={{ marginBottom: spacingFluidSmall }}>
            Guided Experiences
          </PTag>
          <PDisplay size={{ base: 'small', m: 'medium' }} theme="dark" tag="h1" style={{ marginBottom: '8px' }}>
            Guided Tours
          </PDisplay>
          <PText size="medium" theme="dark" style={{ maxWidth: '560px' }}>
            Explore the Faroe Islands with our expert guides. From easy city tours to
            challenging mountain adventures -- there's something for everyone.
          </PText>
        </div>
      </section>

      <section
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: `${spacingFluidLarge} ${spacingFluidMedium}`,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacingFluidSmall, marginBottom: spacingFluidMedium }}>
          <PSegmentedControl
            value={activityFilter}
            onChange={(e) => setActivityFilter(e.detail.value as string)}
            label="Filter by activity"
            hideLabel
          >
            {ACTIVITY_FILTERS.map((f) => (
              <PSegmentedControlItem key={f.value} value={f.value}>
                {f.label}
              </PSegmentedControlItem>
            ))}
          </PSegmentedControl>

          <div style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}>
            <PText size="x-small" color="contrast-medium" style={{ marginRight: '4px' }}>When:</PText>
            {DATE_FILTERS.map((f) => (
              <DateFilterChip
                key={f.value}
                label={f.label}
                active={dateFilter === f.value}
                count={dateFilter !== f.value ? countForDateFilter(f.value) : filtered.length}
                onClick={() => setDateFilter(f.value)}
              />
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: spacingFluidLarge }}>
            <PSpinner size="large" />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: spacingFluidLarge }}>
            <PIcon name="map" size="large" color="contrast-medium" />
            <PText color="contrast-medium" style={{ marginTop: spacingStaticSmall }}>
              No tours match your filters. Try adjusting the activity or date range.
            </PText>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))',
              gap: spacingFluidMedium,
            }}
          >
            {filtered.map((tour, idx) => (
              <TourCard
                key={tour.id}
                tour={tour}
                nextDate={tour.next_date}
                index={idx}
                onClick={() => onSelectTour(tour.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function TourCard({
  tour,
  nextDate,
  index,
  onClick,
}: {
  tour: Tour;
  nextDate?: string;
  index: number;
  onClick: () => void;
}) {
  const icon = ACTIVITY_ICONS[tour.activity_type] || 'map';
  const diffColor = DIFFICULTY_COLORS[tour.difficulty] || 'background-surface';

  return (
    <div
      onClick={onClick}
      style={{
        borderRadius: borderRadiusLarge,
        overflow: 'hidden',
        border: '1px solid var(--p-color-contrast-low)',
        cursor: 'pointer',
        transition: `transform ${motionDurationShort} ${motionEasingBase}, box-shadow ${motionDurationShort} ${motionEasingBase}`,
        animation: `staggerFadeIn ${motionDurationModerate} ${motionEasingIn} ${index * 0.06}s both`,
        ...dropShadowLowStyle,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0px 8px 40px rgba(0,0,0,.16)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '';
      }}
    >
      <div
        style={{
          height: '200px',
          backgroundImage: tour.image_url ? `url(${tour.image_url})` : 'linear-gradient(135deg, #1a1a2e, #16213e)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: `${spacingStaticSmall} ${spacingStaticMedium}`,
            background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)',
            display: 'flex',
            gap: '6px',
            flexWrap: 'wrap',
          }}
        >
          <PTag theme="dark" color="background-frosted" icon={icon as never} compact>
            {tour.activity_type === 'trail-run' ? 'Trail Run' : tour.activity_type === 'combo' ? 'Hike & Bike' : tour.activity_type.charAt(0).toUpperCase() + tour.activity_type.slice(1)}
          </PTag>
          <PTag theme="dark" color={diffColor as never} compact>
            {tour.difficulty}
          </PTag>
        </div>
      </div>

      <div style={{ padding: spacingStaticMedium, display: 'flex', flexDirection: 'column', gap: spacingStaticSmall }}>
        <PHeading size="small" tag="h3">{tour.name}</PHeading>
        {tour.short_description && (
          <PText size="x-small" color="contrast-medium" style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {tour.short_description}
          </PText>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: spacingStaticMedium, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <PIcon name="clock" size="x-small" color="contrast-medium" />
            <PText size="x-small" color="contrast-medium">{tour.duration_hours}h</PText>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <PIcon name="group" size="x-small" color="contrast-medium" />
            <PText size="x-small" color="contrast-medium">Max {tour.max_participants}</PText>
          </div>
          {nextDate && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <PIcon name="calendar" size="x-small" color="contrast-medium" />
              <PText size="x-small" color="contrast-medium">
                Next: {new Date(nextDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </PText>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: spacingStaticSmall }}>
          <PHeading size="small">{Number(tour.price_per_person).toLocaleString()} DKK</PHeading>
          <PText size="x-small" color="contrast-medium">per person</PText>
        </div>
      </div>
    </div>
  );
}
