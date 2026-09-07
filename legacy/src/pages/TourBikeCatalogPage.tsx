import { useState, useMemo } from 'react';
import {
  PHeading,
  PText,
  PButton,
  PTabsBar,
  PIcon,
  PTag,
  PButtonPure,
  PSelect,
  PSelectOption,
  PStepperHorizontal,
  PStepperHorizontalItem,
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
import { FixedBottomBar } from '../components/FixedBottomBar';
import { useToast } from '../hooks/useToast';
import type { Bike, Category, Page } from '../types';

interface TourBikeCatalogPageProps {
  tourName: string;
  bikes: Bike[];
  numAttendees: number;
  attendeeBikes: (string | null)[];
  onUpdateBikes: (bikes: (string | null)[]) => void;
  onBook: () => void;
  onBack: () => void;
  onNavigate: (page: Page) => void;
}

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
      <PIcon name="configurate" size="x-large" color="contrast-medium" />
    </div>
  );
}

export function TourBikeCatalogPage({
  tourName,
  bikes,
  numAttendees,
  attendeeBikes,
  onUpdateBikes,
  onBook,
  onBack,
}: TourBikeCatalogPageProps) {
  const { addMessage } = useToast();
  const [activePerson, setActivePerson] = useState(0);
  const [activeTab, setActiveTab] = useState('all');
  const [sizeFilter, setSizeFilter] = useState('');

  const bikesByCategory = useMemo(() => {
    const grouped = new Map<string, { category: Category; bikes: Bike[] }>();
    for (const bike of bikes) {
      const cat = bike.category;
      if (!cat) continue;
      if (!grouped.has(cat.id)) grouped.set(cat.id, { category: cat, bikes: [] });
      grouped.get(cat.id)!.bikes.push(bike);
    }
    return Array.from(grouped.values()).sort((a, b) => a.category.name.localeCompare(b.category.name));
  }, [bikes]);

  const categories = useMemo(() => bikesByCategory.map((g) => g.category), [bikesByCategory]);

  const tabs = useMemo(() => [
    { slug: 'all', name: 'All Bikes' },
    ...categories.map((c) => ({ slug: c.slug, name: c.name })),
  ], [categories]);

  const activeTabIndex = tabs.findIndex((t) => t.slug === activeTab);

  const availableSizes = useMemo(() =>
    Array.from(new Set(bikes.filter((b) => b.size).map((b) => b.size))).sort((a, b) => {
      const numA = parseFloat(a);
      const numB = parseFloat(b);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    }),
  [bikes]);

  const filteredBikes = bikes.filter((bike) => {
    if (activeTab !== 'all' && bike.category?.slug !== activeTab) return false;
    if (sizeFilter && bike.size !== sizeFilter) return false;
    return true;
  });

  const personName = `Person ${activePerson + 1}`;
  const selectedBikeId = attendeeBikes[activePerson];
  const selectedBike = selectedBikeId ? bikes.find((b) => b.id === selectedBikeId) : null;
  const allBikesSelected = attendeeBikes.slice(0, numAttendees).every((id) => !!id);

  function handleSelectBike(bikeId: string) {
    const next = [...attendeeBikes];
    if (next[activePerson] === bikeId) {
      next[activePerson] = null;
    } else {
      next[activePerson] = bikeId;
      const bike = bikes.find((b) => b.id === bikeId);
      if (bike) {
        addMessage(`${bike.name} assigned to Person ${activePerson + 1}`, 'success');
      }
      if (activePerson < numAttendees - 1 && !next[activePerson + 1]) {
        setTimeout(() => setActivePerson(activePerson + 1), 300);
      }
    }
    onUpdateBikes(next);
  }

  return (
    <div>
      <div
        style={{
          background: 'linear-gradient(135deg, var(--p-color-background-surface) 0%, var(--p-color-background-base) 100%)',
          borderBottom: '1px solid var(--p-color-contrast-low)',
          padding: 'clamp(24px, 4vw, 48px) clamp(16px, 4vw, 48px) 0',
        }}
      >
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <PStepperHorizontal size="small">
            <PStepperHorizontalItem state="complete">
              Tour & Date
            </PStepperHorizontalItem>
            <PStepperHorizontalItem state="current">
              Choose Bikes
            </PStepperHorizontalItem>
            <PStepperHorizontalItem>
              Confirm & Pay
            </PStepperHorizontalItem>
          </PStepperHorizontal>

          <div style={{ marginTop: spacingFluidMedium, paddingBottom: spacingFluidMedium }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <PButtonPure
                icon="arrow-left"
                size="small"
                hideLabel
                onClick={onBack}
                aria={{ 'aria-label': 'Go back' }}
              />
              <PHeading
                size="x-large"
                tag="h1"
                style={{
                  animation: `staggerFadeIn ${motionDurationModerate} ${motionEasingIn} both`,
                }}
              >
                Choose a bike for {personName}
              </PHeading>
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
              {numAttendees > 1
                ? `Pick a bike for each person in your group. You are selecting for ${personName} (${activePerson + 1} of ${numAttendees}).`
                : `Pick the perfect bike for your ${tourName} tour.`}
            </PText>
          </div>
        </div>
      </div>

      <div
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
                setActiveTab(tabs[e.detail.activeTabIndex].slug);
                setSizeFilter('');
              }}
            >
              {tabs.map((tab) => (
                <button key={tab.slug} type="button">
                  {tab.name}
                </button>
              ))}
            </PTabsBar>
          </div>
          {availableSizes.length > 0 && (
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
        </div>

        {bikes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 16px' }}>
            <PIcon name="configurate" size="x-large" color="contrast-low" />
            <PText size="large" color="contrast-medium" style={{ marginTop: '16px' }}>
              No bikes available for this tour
            </PText>
          </div>
        ) : filteredBikes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 16px' }}>
            <PIcon name="configurate" size="x-large" color="contrast-low" />
            <PText size="large" color="contrast-medium" style={{ marginTop: '16px' }}>
              No bikes match the selected filters
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
              const isSelected = attendeeBikes[activePerson] === bike.id;
              const isOtherPersonBike = !isSelected && attendeeBikes.some(
                (id, idx) => id === bike.id && idx !== activePerson && idx < numAttendees
              );

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
                    transition: `border-color ${motionDurationShort} ${motionEasingBase}, box-shadow ${motionDurationShort} ${motionEasingBase}`,
                    boxShadow: isSelected ? '0 0 0 3px rgba(1,2,5,0.08)' : 'none',
                    animation: `staggerFadeIn ${motionDurationModerate} ${motionEasingIn} both`,
                    animationDelay: `${Math.min(cardIdx, 5) * 50}ms`,
                  }}
                >
                  <div style={{ height: '180px', position: 'relative', overflow: 'hidden' }}>
                    <BikeImage bike={bike} />

                    {isSelected && (
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
                      <PTag compact>{bike.category?.name || 'Bike'}</PTag>
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
                        {isOtherPersonBike && (
                          <PText size="x-small" color="contrast-medium">
                            Already picked by another person
                          </PText>
                        )}
                      </div>

                      <PButton
                        icon={isSelected ? 'check' : 'add'}
                        compact
                        variant={isSelected ? 'secondary' : 'primary'}
                        onClick={() => handleSelectBike(bike.id)}
                        aria={{ 'aria-label': isSelected ? `Deselect ${bike.name}` : `Select ${bike.name}` }}
                      >
                        {isSelected ? 'Selected' : 'Select'}
                      </PButton>
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
            {numAttendees > 1 && (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', overflowX: 'auto' }}>
                <PText size="x-small" color="contrast-medium" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {allBikesSelected
                    ? `All ${numAttendees} people ready`
                    : `${attendeeBikes.slice(0, numAttendees).filter(Boolean).length} of ${numAttendees} people ready`}
                </PText>
                <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--p-color-contrast-low)', flexShrink: 0 }} />
                {Array.from({ length: numAttendees }, (_, idx) => {
                  const hasBike = !!attendeeBikes[idx];
                  const isCurrent = idx === activePerson;
                  return (
                    <button
                      key={idx}
                      onClick={() => setActivePerson(idx)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 'var(--p-border-radius-sm)',
                        border: isCurrent
                          ? '2px solid var(--p-color-primary)'
                          : hasBike
                            ? '1px solid var(--p-color-notification-success)'
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
                      {hasBike && !isCurrent && (
                        <PIcon name="check" size="x-small" color="notification-success" />
                      )}
                      {!hasBike && !isCurrent && (
                        <PIcon name="exclamation" size="x-small" color="notification-warning" />
                      )}
                      Person {idx + 1}
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
                    backgroundColor: selectedBike
                      ? 'var(--p-color-notification-success-soft)'
                      : 'var(--p-color-background-surface)',
                    transition: `background-color ${motionDurationShort} ${motionEasingBase}`,
                  }}
                >
                  <PIcon
                    name={selectedBike ? 'check' : 'configurate'}
                    size="x-small"
                    color={selectedBike ? 'notification-success' : 'contrast-medium'}
                  />
                  <PText size="x-small" weight="semi-bold" style={{ whiteSpace: 'nowrap' }}>
                    {selectedBike
                      ? selectedBike.name
                      : `Pick a bike for ${personName}`}
                  </PText>
                </div>
              </div>

              <PButton
                onClick={onBook}
                icon="arrow-right"
                compact
                disabled={!allBikesSelected}
              >
                Book Now
              </PButton>
            </div>
          </div>
        </div>
      </FixedBottomBar>
    </div>
  );
}
