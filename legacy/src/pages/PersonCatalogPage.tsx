import { useState, useEffect, useCallback, useRef } from 'react';
import {
  PHeading,
  PText,
  PButton,
  PTabsBar,
  PIcon,
  PTag,
  PButtonPure,
  PInlineNotification,
  PInputSearch,
  PSelect,
  PSelectOption,
} from '@porsche-design-system/components-react';
import {
  frostedGlassStyle,
  dropShadowHighStyle,
  motionDurationShort,
  motionDurationModerate,
  motionEasingBase,
  motionEasingIn,
  spacingFluidSmall,
  spacingFluidMedium,
  borderRadiusMedium,
} from '@porsche-design-system/components-react/styles';
import { supabase } from '../lib/supabase';
import { useCart } from '../store/cartStore';
import { useToast } from '../hooks/useToast';
import { BookingStepper } from '../components/BookingStepper';
import { FixedBottomBar } from '../components/FixedBottomBar';
import type { Bike, Category, Page } from '../types';

interface PersonCatalogPageProps {
  onNavigate: (page: Page) => void;
}

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

const CATEGORY_COLORS: Record<string, 'primary' | 'success' | 'info' | 'warning' | 'secondary'> = {
  'e-bikes': 'success',
  'mountain-bikes': 'info',
  'gravel-bikes': 'warning',
  'road-bikes': 'primary',
  'children-bikes': 'secondary',
  accessories: 'secondary',
};

function BikeImage({ bike }: { bike: Bike }) {
  if (bike.image_url) {
    return (
      <img
        src={bike.image_url}
        alt={bike.name}
        loading="lazy"
        decoding="async"
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    );
  }
  const slug = bike.category?.slug || '';
  const iconName = CATEGORY_ICONS[slug] || 'car';
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--p-color-background-surface)',
      }}
    >
      <PIcon name={iconName as never} size="x-large" color="contrast-medium" />
    </div>
  );
}

function SkeletonCard() {
  const shimmer = {
    background: 'linear-gradient(90deg, var(--p-color-background-surface) 25%, var(--p-color-contrast-low) 50%, var(--p-color-background-surface) 75%)',
    backgroundSize: '200% 100%',
    animation: 'skeletonShimmer 1.5s infinite',
    borderRadius: borderRadiusMedium,
  };
  return (
    <div
      style={{
        borderRadius: 'var(--p-border-radius-lg)',
        overflow: 'hidden',
        border: '1px solid var(--p-color-contrast-low)',
        backgroundColor: 'var(--p-color-background-base)',
      }}
    >
      <div style={{ height: '180px', ...shimmer }} />
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ height: '20px', width: '70%', ...shimmer }} />
        <div style={{ height: '14px', width: '40%', ...shimmer }} />
        <div style={{ height: '14px', width: '90%', ...shimmer }} />
        <div style={{ height: '36px', width: '100%', marginTop: '10px', ...shimmer }} />
      </div>
    </div>
  );
}

export function PersonCatalogPage({ onNavigate }: PersonCatalogPageProps) {
  const {
    persons,
    currentPersonIndex,
    setCurrentPersonIndex,
    items,
    addItem,
    removeItem,
    startAt,
    endAt,
    rentalDays,
  } = useCart();
  const { addMessage } = useToast();

  const [bikes, setBikes] = useState<Bike[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeTab, setActiveTab] = useState('bikes');
  const [searchQuery, setSearchQuery] = useState('');
  const [sizeFilter, setSizeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [availability, setAvailability] = useState<AvailabilityMap>({});
  const [accessoryNudge, setAccessoryNudge] = useState(false);
  const prevBikeRef = useRef<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const person = persons[currentPersonIndex];
  const isAccessoriesOnly = person?.accessoriesOnly ?? false;
  const personName = person?.name || `Person ${currentPersonIndex + 1}`;
  const isLastPerson = currentPersonIndex === persons.length - 1;

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

  useEffect(() => {
    if (isAccessoriesOnly) {
      setActiveTab('accessories');
    } else {
      setActiveTab('bikes');
    }
  }, [currentPersonIndex, isAccessoriesOnly]);

  function getAvailableQuantity(bike: Bike): number {
    return bike.total_quantity - (availability[bike.id] || 0);
  }

  function getPersonItemQty(bikeId: string): number {
    const item = items.find((i) => i.bike.id === bikeId && i.personIndex === currentPersonIndex);
    return item?.quantity ?? 0;
  }

  function handleAdd(bike: Bike) {
    const isAccessory = bike.category?.slug === 'accessories';
    if (!isAccessory) {
      const existingBike = items.find(
        (i) => i.personIndex === currentPersonIndex && i.bike.category?.slug !== 'accessories'
      );
      if (existingBike) {
        removeItem(existingBike.bike.id, currentPersonIndex);
      }
      prevBikeRef.current = bike.id;
      addMessage(`${bike.name} assigned to ${personName}`, 'success');
      setTimeout(() => {
        setActiveTab('accessories');
        setAccessoryNudge(true);
        setTimeout(() => setAccessoryNudge(false), 4000);
      }, 400);
    }
    addItem(bike, 1, currentPersonIndex);
  }

  function handleRemove(bike: Bike) {
    removeItem(bike.id, currentPersonIndex);
  }

  function handleNext() {
    if (isLastPerson) {
      onNavigate('checkout');
    } else {
      setCurrentPersonIndex(currentPersonIndex + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function handleBack() {
    if (currentPersonIndex === 0) {
      onNavigate('booking-setup');
    } else {
      setCurrentPersonIndex(currentPersonIndex - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  const personItems = items.filter((i) => i.personIndex === currentPersonIndex);
  const personBike = personItems.find((i) => i.bike.category?.slug !== 'accessories');
  const personAccessories = personItems.filter((i) => i.bike.category?.slug === 'accessories');
  const personSubtotal = personItems.reduce(
    (s, i) => s + i.bike.price_per_day * i.quantity * rentalDays,
    0
  );

  const nonAccessoryCategories = categories.filter((c) => c.slug !== 'accessories');

  const bikeTabs: { slug: string; name: string }[] = isAccessoriesOnly
    ? [{ slug: 'accessories', name: 'Accessories' }]
    : [
        { slug: 'bikes', name: 'All Bikes' },
        ...nonAccessoryCategories.map((c) => ({ slug: c.slug, name: c.name })),
        { slug: 'accessories', name: 'Accessories' },
      ];

  const activeTabIndex = bikeTabs.findIndex((t) => t.slug === activeTab);

  const searchLower = searchQuery.toLowerCase().trim();

  const availableSizes = Array.from(
    new Set(
      bikes
        .filter((b) => b.size && b.category?.slug !== 'accessories')
        .map((b) => b.size)
    )
  ).sort((a, b) => {
    const numA = parseFloat(a);
    const numB = parseFloat(b);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.localeCompare(b);
  });

  const filteredBikes = bikes
    .filter((bike) => {
      const isAccessory = bike.category?.slug === 'accessories';
      if (activeTab === 'bikes') { if (isAccessory) return false; }
      else if (activeTab === 'accessories') { if (!isAccessory) return false; }
      else if (bike.category?.slug !== activeTab) return false;

      if (sizeFilter && !isAccessory && bike.size !== sizeFilter) return false;

      if (searchLower) {
        const nameMatch = bike.name.toLowerCase().includes(searchLower);
        const descMatch = bike.description?.toLowerCase().includes(searchLower);
        if (!nameMatch && !descMatch) return false;
      }
      return true;
    })
    .map((bike) => ({
      ...bike,
      available_quantity: getAvailableQuantity(bike),
    }));

  if (persons.length === 0) {
    return (
      <div style={{ maxWidth: '500px', margin: '80px auto', textAlign: 'center', padding: '0 16px' }}>
        <PInlineNotification
          state="warning"
          heading="No booking setup found"
          description="Please start from the beginning to set up your booking."
          dismissButton={false}
        />
        <PButton style={{ marginTop: '24px' }} onClick={() => onNavigate('booking-setup')}>
          Start Booking
        </PButton>
      </div>
    );
  }

  const heroHeading = isAccessoriesOnly
    ? `Add accessories for ${personName}`
    : `Choose a bike for ${personName}`;

  const heroDescription = isAccessoriesOnly
    ? 'Browse helmets, locks, and other gear below.'
    : persons.length > 1
      ? `Pick a bike and optional accessories for each person in your group. You are selecting for ${personName} (${currentPersonIndex + 1} of ${persons.length}).`
      : 'Browse our selection below and pick the perfect bike. You can also add accessories like helmets and locks.';

  return (
    <div>
      <div
        style={{
          background: 'linear-gradient(135deg, var(--p-color-background-surface) 0%, var(--p-color-background-base) 100%)',
          borderBottom: '1px solid var(--p-color-contrast-low)',
          padding: `clamp(24px, 4vw, 48px) clamp(16px, 4vw, 48px) 0`,
        }}
      >
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <BookingStepper currentStep={1} onNavigate={onNavigate} />

          <div style={{ marginTop: spacingFluidMedium, paddingBottom: spacingFluidMedium }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <PButtonPure
                icon="arrow-left"
                size="small"
                hideLabel
                onClick={handleBack}
                aria={{ 'aria-label': 'Go back' }}
              />
              <PHeading
                size="x-large"
                tag="h1"
                style={{
                  animation: `staggerFadeIn ${motionDurationModerate} ${motionEasingIn} both`,
                }}
              >
                {heroHeading}
              </PHeading>
              {isAccessoriesOnly && (
                <PTag color="notification-info-soft" compact>Accessories only</PTag>
              )}
            </div>
            <PText
              color="contrast-medium"
              style={{
                display: 'block',
                maxWidth: '600px',
                animation: `staggerFadeIn ${motionDurationModerate} ${motionEasingIn} both`,
                animationDelay: '60ms',
              }}
            >
              {heroDescription}
            </PText>
          </div>
        </div>
      </div>

      <div
        ref={gridRef}
        style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: `${spacingFluidMedium} clamp(16px, 4vw, 48px)`,
          paddingBottom: '120px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: spacingFluidSmall,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            <PTabsBar
              activeTabIndex={activeTabIndex >= 0 ? activeTabIndex : 0}
              onUpdate={(e) => {
                setActiveTab(bikeTabs[e.detail.activeTabIndex].slug);
                setSearchQuery('');
                setSizeFilter('');
              }}
            >
              {bikeTabs.map((tab) => (
                <button key={tab.slug} type="button">
                  {tab.name}
                </button>
              ))}
            </PTabsBar>
          </div>
          {activeTab !== 'accessories' && availableSizes.length > 0 && (
            <div style={{ width: '140px', flexShrink: 0 }}>
              <PSelect
                name="size-filter"
                hideLabel
                compact
                value={sizeFilter}
                onChange={(e) => setSizeFilter((e as CustomEvent).detail.value)}
              >
                <PSelectOption value="">All sizes</PSelectOption>
                {availableSizes.map((size) => (
                  <PSelectOption key={size} value={size}>{size}</PSelectOption>
                ))}
              </PSelect>
            </div>
          )}
          <div style={{ width: '200px', flexShrink: 0 }}>
            <PInputSearch
              name="bike-search"
              hideLabel
              compact
              placeholder="Search..."
              value={searchQuery}
              onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
              onChange={(e) => {
                if (!(e as CustomEvent).detail?.value) setSearchQuery('');
              }}
            />
          </div>
        </div>

        {accessoryNudge && activeTab === 'accessories' && (
          <div
            style={{
              padding: '10px 16px',
              marginBottom: '16px',
              borderRadius: borderRadiusMedium,
              backgroundColor: 'var(--p-color-notification-success-soft)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              animation: `fadeIn 0.3s ${motionEasingBase}`,
            }}
          >
            <PIcon name="check" size="small" color="notification-success" />
            <PText size="small" weight="semi-bold">Bike selected! Add some accessories?</PText>
          </div>
        )}

        {loading ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))',
              gap: '20px',
            }}
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filteredBikes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 16px' }}>
            <PIcon name="car" size="x-large" color="contrast-low" />
            <PText size="large" color="contrast-medium" style={{ marginTop: '16px' }}>
              No items in this category
            </PText>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))',
              gap: '20px',
            }}
          >
            {filteredBikes.map((bike, cardIdx) => {
              const isAccessory = bike.category?.slug === 'accessories';
              const isUnavailable = bike.available_quantity !== undefined && bike.available_quantity <= 0;
              const qty = getPersonItemQty(bike.id);
              const isSelected = qty > 0;
              const tagVariant = CATEGORY_COLORS[bike.category?.slug || ''] || 'secondary';
              const isBikeSelected = !isAccessory && personBike !== undefined && personBike.bike.id !== bike.id;

              return (
                <div
                  key={bike.id}
                  style={{
                    borderRadius: 'var(--p-border-radius-lg)',
                    overflow: 'hidden',
                    border: isSelected
                      ? '2px solid var(--p-color-primary)'
                      : '1px solid var(--p-color-contrast-low)',
                    backgroundColor: 'var(--p-color-background-base)',
                    display: 'flex',
                    flexDirection: 'column',
                    opacity: isUnavailable ? 0.6 : 1,
                    transition: `border-color ${motionDurationShort} ${motionEasingBase}, box-shadow ${motionDurationShort} ${motionEasingBase}`,
                    boxShadow: isSelected ? '0 0 0 3px rgba(1,2,5,0.08)' : 'none',
                    animation: `staggerFadeIn ${motionDurationModerate} ${motionEasingIn} both`,
                    animationDelay: `${Math.min(cardIdx, 5) * 50}ms`,
                  }}
                >
                  <div style={{ height: '180px', position: 'relative', overflow: 'hidden' }}>
                    <BikeImage bike={bike} />

                    {isSelected && !isUnavailable && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          right: 0,
                          bottom: 0,
                          left: 0,
                          background: 'rgba(1,2,5,0.25)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          animation: `fadeIn ${motionDurationShort} ${motionEasingBase}`,
                        }}
                      >
                        <div
                          style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--p-color-background-base)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <PIcon name="check" size="medium" color="notification-success" />
                        </div>
                      </div>
                    )}

                    <div style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <PTag variant={tagVariant} compact>{bike.category?.name || 'Bike'}</PTag>
                      {isUnavailable && <PTag variant="error" compact>Unavailable</PTag>}
                    </div>
                  </div>

                  <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                    <PHeading size="small" tag="h3" style={{ margin: 0 }}>{bike.name}</PHeading>

                    {bike.size && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <PIcon name="arrows" size="x-small" color="contrast-medium" />
                        <PText size="x-small" color="contrast-medium">Size {bike.size}</PText>
                      </div>
                    )}

                    <PText
                      size="x-small"
                      color="contrast-medium"
                      style={{
                        flex: 1,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      } as React.CSSProperties}
                    >
                      {bike.description}
                    </PText>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: '10px',
                        borderTop: '1px solid var(--p-color-contrast-low)',
                        gap: '8px',
                        marginTop: 'auto',
                      }}
                    >
                      <div>
                        <PText size="medium" weight="bold">{bike.price_per_day} DKK</PText>
                        <PText size="x-small" color="contrast-medium">
                          per day{rentalDays > 0 ? ` · ${(bike.price_per_day * rentalDays).toLocaleString()} DKK` : ''}
                        </PText>
                      </div>

                      {isAccessory ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {qty > 0 && (
                            <>
                              <PButton
                                icon="minus"
                                compact
                                variant="secondary"
                                disabled={isUnavailable}
                                onClick={() => handleRemove(bike)}
                                aria={{ 'aria-label': `Remove ${bike.name}` }}
                              />
                              <div
                                style={{
                                  minWidth: '24px',
                                  textAlign: 'center',
                                  fontFamily: "'Porsche Next','Arial Narrow',Arial,sans-serif",
                                  fontWeight: 600,
                                  fontSize: '14px',
                                }}
                              >
                                {qty}
                              </div>
                            </>
                          )}
                          <PButton
                            icon="add"
                            compact
                            disabled={isUnavailable}
                            onClick={() => handleAdd(bike)}
                            aria={{ 'aria-label': `Add ${bike.name}` }}
                          />
                        </div>
                      ) : (
                        <PButton
                          icon={isSelected ? 'check' : 'add'}
                          compact
                          variant={isSelected ? 'secondary' : 'primary'}
                          disabled={isUnavailable}
                          onClick={() => isSelected ? handleRemove(bike) : handleAdd(bike)}
                          aria={{ 'aria-label': isSelected ? `Remove ${bike.name}` : `Select ${bike.name}` }}
                        >
                          {isSelected ? 'Selected' : isBikeSelected ? 'Switch' : 'Select'}
                        </PButton>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <FixedBottomBar>
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 50,
            ...frostedGlassStyle,
            borderTop: '1px solid var(--p-color-contrast-low)',
            ...dropShadowHighStyle,
          }}
        >
          <div
            style={{
              maxWidth: '1400px',
              margin: '0 auto',
              padding: `${spacingFluidSmall} ${spacingFluidMedium}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            {persons.length > 1 && (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', overflowX: 'auto' }}>
                {(() => {
                  const readyCount = persons.filter((p, idx) => {
                    const pItems = items.filter((i) => i.personIndex === idx);
                    if (p.accessoriesOnly) return pItems.length > 0;
                    return pItems.some((i) => i.bike.category?.slug !== 'accessories');
                  }).length;
                  const allReady = readyCount === persons.length;
                  return (
                    <PText size="x-small" color="contrast-medium" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {allReady
                        ? `All ${persons.length} people ready`
                        : `${readyCount} of ${persons.length} people ready`}
                    </PText>
                  );
                })()}
                <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--p-color-contrast-low)', flexShrink: 0 }} />
                {persons.map((p, idx) => {
                  const pItems = items.filter((i) => i.personIndex === idx);
                  const hasBike = pItems.some((i) => i.bike.category?.slug !== 'accessories');
                  const hasAnyItem = pItems.length > 0;
                  const isReady = p.accessoriesOnly ? hasAnyItem : hasBike;
                  const needsBike = !p.accessoriesOnly && !hasBike;
                  const isCurrent = idx === currentPersonIndex;
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        setCurrentPersonIndex(idx);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 'var(--p-border-radius-sm)',
                        border: isCurrent
                          ? '2px solid var(--p-color-primary)'
                          : needsBike
                            ? '1px solid var(--p-color-notification-warning)'
                            : '1px solid var(--p-color-contrast-low)',
                        background: isCurrent
                          ? 'var(--p-color-primary)'
                          : 'var(--p-color-background-base)',
                        color: isCurrent
                          ? 'var(--p-color-background-base)'
                          : 'var(--p-color-primary)',
                        cursor: 'pointer',
                        fontFamily: "'Porsche Next','Arial Narrow',Arial,sans-serif",
                        fontSize: '13px',
                        fontWeight: isCurrent ? 600 : 400,
                        transition: `all ${motionDurationShort} ${motionEasingBase}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        lineHeight: 1.4,
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      {isReady && (
                        <PIcon name="check" size="x-small" color={isCurrent ? 'inherit' : 'notification-success'} />
                      )}
                      {needsBike && !isCurrent && (
                        <PIcon name="exclamation" size="x-small" color="notification-warning" />
                      )}
                      {p.name}
                    </button>
                  );
                })}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 auto', minWidth: 0, flexWrap: 'wrap' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: borderRadiusMedium,
                    backgroundColor: personBike
                      ? 'var(--p-color-notification-success-soft)'
                      : (isAccessoriesOnly && personAccessories.length > 0)
                        ? 'var(--p-color-notification-success-soft)'
                        : 'var(--p-color-background-surface)',
                    transition: `background-color ${motionDurationShort} ${motionEasingBase}`,
                  }}
                >
                  <PIcon
                    name={personBike || (isAccessoriesOnly && personAccessories.length > 0) ? 'check' : 'car'}
                    size="x-small"
                    color={personBike || (isAccessoriesOnly && personAccessories.length > 0) ? 'notification-success' : 'contrast-medium'}
                  />
                  <PText size="x-small" weight="semi-bold" style={{ whiteSpace: 'nowrap' }}>
                    {personBike
                      ? personBike.bike.name
                      : isAccessoriesOnly
                        ? (personAccessories.length > 0 ? `${personAccessories.length} accessor${personAccessories.length === 1 ? 'y' : 'ies'}` : 'No accessories yet')
                        : `Pick a bike for ${personName}`}
                  </PText>
                </div>

                {personBike && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 10px',
                      borderRadius: borderRadiusMedium,
                      backgroundColor: personAccessories.length > 0
                        ? 'var(--p-color-notification-success-soft)'
                        : 'var(--p-color-background-surface)',
                      transition: `background-color ${motionDurationShort} ${motionEasingBase}`,
                    }}
                  >
                    <PIcon
                      name={personAccessories.length > 0 ? 'check' : 'attachment'}
                      size="x-small"
                      color={personAccessories.length > 0 ? 'notification-success' : 'contrast-medium'}
                    />
                    <PText size="x-small" weight="semi-bold" color={personAccessories.length > 0 ? 'primary' : 'contrast-medium'} style={{ whiteSpace: 'nowrap' }}>
                      {personAccessories.length > 0
                        ? `${personAccessories.length} accessor${personAccessories.length === 1 ? 'y' : 'ies'}`
                        : 'Add accessories (optional)'}
                    </PText>
                  </div>
                )}

                {rentalDays > 0 && personSubtotal > 0 && (
                  <PText size="x-small" weight="semi-bold" style={{ whiteSpace: 'nowrap' }}>
                    {personSubtotal.toLocaleString()} DKK
                  </PText>
                )}
              </div>

              {(() => {
                const currentPersonReady = isAccessoriesOnly
                  ? personItems.length > 0
                  : !!personBike;
                const allPersonsReady = persons.every((p, idx) => {
                  const pItems = items.filter((i) => i.personIndex === idx);
                  if (p.accessoriesOnly) return pItems.length > 0;
                  return pItems.some((i) => i.bike.category?.slug !== 'accessories');
                });
                const nextDisabled = !currentPersonReady || (isLastPerson && !allPersonsReady);

                return (
                  <PButton
                    onClick={handleNext}
                    icon="arrow-right"
                    compact
                    disabled={nextDisabled}
                  >
                    {isLastPerson ? 'Review Order' : `Next: ${persons[currentPersonIndex + 1]?.name}`}
                  </PButton>
                );
              })()}
            </div>
          </div>
        </div>
      </FixedBottomBar>
    </div>
  );
}
