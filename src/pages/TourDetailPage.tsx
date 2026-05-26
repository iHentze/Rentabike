import { useState, useEffect, useMemo } from 'react';
import {
  PDisplay,
  PText,
  PHeading,
  PTag,
  PButton,
  PIcon,
  PSpinner,
  PDivider,
  PSelect,
  PSelectOption,
  PInputNumber,
  PInlineNotification,
  PStepperHorizontal,
  PStepperHorizontalItem,
  PCarousel,
} from '@porsche-design-system/components-react';
import {
  spacingFluidMedium,
  spacingFluidSmall,
  spacingFluidLarge,
  spacingStaticSmall,
  spacingStaticMedium,
  borderRadiusLarge,
  borderRadiusMedium,
  borderRadiusSmall,
  borderWidthThin,
  borderWidthBase,
  dropShadowMediumStyle,
  dropShadowLowStyle,
  motionDurationShort,
  motionEasingBase,
  themeLightContrastLow,
  themeLightBackgroundBase,
  themeLightBackgroundSurface,
  themeLightPrimary,
} from '@porsche-design-system/components-react/styles';
import { supabase } from '../lib/supabase';
import { formatTimeRange } from '../utils/rentalDuration';
import type { Page, Tour, TourDate, Bike, Category, TourBookingSetup, TourBikeSelection } from '../types';

interface TourDetailPageProps {
  tourId: string;
  onNavigate: (page: Page) => void;
  onBook: (data: TourBookingSetup) => void;
  onContinueToBikes?: (data: TourBikeSelection) => void;
}

const ACTIVITY_ICONS: Record<string, string> = {
  bike: 'country-road',
  combo: 'arrows',
  hike: 'map',
  'trail-run': 'flash',
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: 'notification-success-soft',
  moderate: 'notification-warning-soft',
};

export function TourDetailPage({ tourId, onNavigate, onBook, onContinueToBikes }: TourDetailPageProps) {
  const [tour, setTour] = useState<Tour | null>(null);
  const [dates, setDates] = useState<TourDate[]>([]);
  const [bikes, setBikes] = useState<Bike[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedDateId, setSelectedDateId] = useState('');
  const [numAttendees, setNumAttendees] = useState('1');
  const [attendeeBikes, setAttendeeBikes] = useState<(string | null)[]>([null]);
  const [error, setError] = useState('');
  const [bookingStep, setBookingStep] = useState(0);
  const [activePerson, setActivePerson] = useState(0);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      const [tourRes, datesRes] = await Promise.all([
        supabase
          .from('tours')
          .select('*, allowed_bikes:tour_allowed_bikes(bike_id, bike:bikes(*, category:categories(*)))')
          .eq('id', tourId)
          .maybeSingle(),
        supabase
          .from('tour_dates')
          .select('*')
          .eq('tour_id', tourId)
          .eq('is_cancelled', false)
          .gte('date', today)
          .gt('available_spots', 0)
          .order('date'),
      ]);

      if (tourRes.data) {
        setTour(tourRes.data as Tour);
        const allowedBikes = (tourRes.data.allowed_bikes || [])
          .map((ab: { bike?: Bike }) => ab.bike)
          .filter(Boolean) as Bike[];
        setBikes(allowedBikes);
      }
      if (datesRes.data) setDates(datesRes.data as TourDate[]);
      setLoading(false);
    }
    load();
  }, [tourId]);

  const selectedDate = dates.find((d) => d.id === selectedDateId);
  const maxAttendees = selectedDate
    ? Math.min(tour?.max_participants || 8, selectedDate.available_spots)
    : tour?.max_participants || 8;
  const attendeeCount = parseInt(numAttendees) || 1;
  const needsBikeStep = tour?.needs_bike && bikes.length > 0;

  useEffect(() => {
    setAttendeeBikes((prev) => {
      const count = parseInt(numAttendees) || 1;
      if (count > prev.length) {
        return [...prev, ...Array.from({ length: count - prev.length }, () => null)];
      }
      return prev.slice(0, count);
    });
  }, [numAttendees]);

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

  function handleContinueToBikes() {
    if (!selectedDateId) {
      setError('Please select a date');
      return;
    }
    setError('');

    if (onContinueToBikes) {
      const sd = dates.find((d) => d.id === selectedDateId);
      onContinueToBikes({
        tourId: tour!.id,
        tourName: tour!.name,
        tourDateId: selectedDateId,
        tourDate: sd?.date || '',
        tourTime: sd?.start_time || '',
        durationHours: tour!.duration_hours,
        meetingPoint: tour!.meeting_point,
        pricePerPerson: Number(tour!.price_per_person),
        numAttendees: attendeeCount,
        attendeeBikes: attendeeBikes.slice(0, attendeeCount),
        bikes,
      });
      onNavigate('tour-bike-catalog');
    } else {
      setBookingStep(1);
      setActivePerson(0);
    }
  }

  function handleBookNow() {
    if (!selectedDateId) {
      setError('Please select a date');
      return;
    }
    if (needsBikeStep) {
      const missing = attendeeBikes.slice(0, attendeeCount).some((id) => !id);
      if (missing) {
        setError('Please select a bike for each person');
        return;
      }
    }
    setError('');

    const sd = dates.find((d) => d.id === selectedDateId);
    onBook({
      tourId: tour!.id,
      tourDateId: selectedDateId,
      numAttendees: attendeeCount,
      attendeeBikes: attendeeBikes.slice(0, attendeeCount).map((bikeId, i) => ({
        label: `Person ${i + 1}`,
        bikeId,
      })),
      tourName: tour!.name,
      tourDate: sd?.date || '',
      tourTime: sd?.start_time || '',
      durationHours: tour!.duration_hours,
      meetingPoint: tour!.meeting_point,
      pricePerPerson: Number(tour!.price_per_person),
      needsBike: tour!.needs_bike,
    });
    onNavigate('tour-checkout');
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <PSpinner size="large" />
      </div>
    );
  }

  if (!tour) {
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: spacingFluidLarge, textAlign: 'center' }}>
        <PInlineNotification state="error" heading="Tour not found" description="This tour does not exist or has been removed." dismissButton={false} />
        <PButton variant="secondary" onClick={() => onNavigate('tours')} style={{ marginTop: spacingFluidSmall }}>Back to Tours</PButton>
      </div>
    );
  }

  const actIcon = ACTIVITY_ICONS[tour.activity_type] || 'map';
  const allBikesSelected = attendeeBikes.slice(0, attendeeCount).every((id) => !!id);

  return (
    <div>
      <section
        style={{
          position: 'relative',
          minHeight: 'clamp(280px, 35vw, 400px)',
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
            backgroundImage: tour.image_url ? `url(${tour.image_url})` : 'linear-gradient(135deg, #1a1a2e, #16213e)',
            backgroundSize: 'cover',
            backgroundPosition: 'center 40%',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.6) 70%, rgba(0,0,0,0.85) 100%)',
          }}
        />
        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '1100px',
            margin: '0 auto',
            padding: `${spacingFluidLarge} ${spacingFluidMedium}`,
          }}
        >
          <div style={{ display: 'flex', gap: '6px', marginBottom: spacingFluidSmall, flexWrap: 'wrap' }}>
            <PTag theme="dark" color="background-frosted" icon={actIcon as never} compact>
              {tour.activity_type === 'trail-run' ? 'Trail Run' : tour.activity_type === 'combo' ? 'Hike & Bike' : tour.activity_type.charAt(0).toUpperCase() + tour.activity_type.slice(1)}
            </PTag>
            <PTag theme="dark" color={(DIFFICULTY_COLORS[tour.difficulty] || 'background-frosted') as never} compact>{tour.difficulty}</PTag>
            <PTag theme="dark" color="background-frosted" icon="clock" compact>{tour.duration_hours}h</PTag>
            {tour.needs_bike && <PTag theme="dark" color="background-frosted" icon="configurate" compact>Bike included</PTag>}
          </div>
          <PDisplay size={{ base: 'small', m: 'medium' }} theme="dark" tag="h1">{tour.name}</PDisplay>
        </div>
      </section>

      <section
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
          padding: `${spacingFluidLarge} ${spacingFluidMedium}`,
          display: 'grid',
          gap: spacingFluidMedium,
          alignItems: 'start',
        }}
        className="tour-detail-grid"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacingFluidMedium }}>
          {tour.description && (
            <div>
              <PHeading size="medium" tag="h2" style={{ marginBottom: spacingStaticSmall }}>About This Tour</PHeading>
              <PText style={{ whiteSpace: 'pre-line' }}>{tour.description}</PText>
            </div>
          )}

          <div
            style={{
              display: 'flex',
              gap: spacingStaticMedium,
              flexWrap: 'wrap',
              padding: spacingStaticMedium,
              borderRadius: borderRadiusMedium,
              backgroundColor: 'var(--p-color-background-surface)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: spacingStaticSmall }}>
              <PIcon name="map" size="small" color="primary" />
              <div>
                <PText size="x-small" color="contrast-medium">Meeting Point</PText>
                <PText size="small" weight="semi-bold">{tour.meeting_point}</PText>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacingStaticSmall }}>
              <PIcon name="clock" size="small" color="primary" />
              <div>
                <PText size="x-small" color="contrast-medium">Duration</PText>
                <PText size="small" weight="semi-bold">{tour.duration_hours} hours</PText>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacingStaticSmall }}>
              <PIcon name="group" size="small" color="primary" />
              <div>
                <PText size="x-small" color="contrast-medium">Group Size</PText>
                <PText size="small" weight="semi-bold">Max {tour.max_participants}</PText>
              </div>
            </div>
          </div>

          {needsBikeStep && bikes.length > 0 && (
            <div>
              <PHeading size="medium" tag="h2" style={{ marginBottom: spacingStaticSmall }}>Available Bikes</PHeading>
              <PText size="small" color="contrast-medium" style={{ marginBottom: spacingStaticMedium }}>
                Each person in your group will choose one of these bikes when booking.
              </PText>
              <PCarousel
                slidesPerPage={{ base: 1, s: 2, l: 3 }}
                rewind={true}
                width="basic"
              >
                {bikes.map((bike) => (
                  <div
                    key={bike.id}
                    style={{
                      borderRadius: borderRadiusLarge,
                      overflow: 'hidden',
                      border: `${borderWidthThin} solid ${themeLightContrastLow}`,
                      backgroundColor: themeLightBackgroundBase,
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <div
                      style={{
                        height: '180px',
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                    >
                      {bike.image_url ? (
                        <img
                          src={bike.image_url}
                          alt={bike.name}
                          loading="lazy"
                          decoding="async"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: themeLightBackgroundSurface,
                          }}
                        >
                          <PIcon name="configurate" size="x-large" color="contrast-low" />
                        </div>
                      )}
                      <div style={{ position: 'absolute', top: spacingStaticSmall, left: spacingStaticSmall }}>
                        <PTag compact>{bike.category?.name || 'Bike'}</PTag>
                      </div>
                    </div>
                    <div style={{ padding: spacingStaticMedium, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <PHeading size="small" tag="h3">{bike.name}</PHeading>
                      {bike.size && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <PIcon name="arrows" size="x-small" color="contrast-medium" />
                          <PText size="x-small" color="contrast-medium">Size {bike.size}</PText>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </PCarousel>
            </div>
          )}
        </div>

        <div
          className="tour-booking-card"
          style={{
            borderRadius: borderRadiusLarge,
            border: `${borderWidthThin} solid ${themeLightContrastLow}`,
            overflow: 'hidden',
            ...dropShadowMediumStyle,
          }}
        >
          <div
            style={{
              padding: spacingStaticMedium,
              backgroundColor: 'var(--p-color-background-surface)',
              display: 'flex',
              alignItems: 'baseline',
              gap: spacingStaticSmall,
            }}
          >
            <PHeading size="large">{Number(tour.price_per_person).toLocaleString()} DKK</PHeading>
            <PText size="small" color="contrast-medium">per person</PText>
          </div>

          {needsBikeStep && (
            <div style={{ padding: `0 ${spacingStaticMedium}`, paddingTop: spacingStaticSmall, paddingBottom: spacingStaticSmall }}>
              <PStepperHorizontal
                size="small"
                onUpdate={(e) => {
                  const idx = (e as CustomEvent).detail.activeStepIndex;
                  if (idx === 0) setBookingStep(0);
                  if (idx === 1 && selectedDateId) setBookingStep(1);
                }}
              >
                <PStepperHorizontalItem state={bookingStep === 0 ? 'current' : bookingStep > 0 ? 'complete' : undefined}>
                  Date & Group
                </PStepperHorizontalItem>
                <PStepperHorizontalItem
                  state={bookingStep === 1 ? 'current' : undefined}
                  disabled={!selectedDateId}
                >
                  Choose Bikes
                </PStepperHorizontalItem>
              </PStepperHorizontal>
            </div>
          )}

          <PDivider />

          {bookingStep === 0 && (
            <div style={{ padding: spacingStaticMedium, display: 'flex', flexDirection: 'column', gap: spacingStaticMedium }}>
              <PSelect
                label="Select Date"
                name="tourDate"
                value={selectedDateId}
                onChange={(e) => setSelectedDateId(e.detail.value)}
              >
                <PSelectOption value="" disabled>Choose a date...</PSelectOption>
                {dates.map((d) => (
                  <PSelectOption key={d.id} value={d.id}>
                    {new Date(d.date + 'T00:00:00').toLocaleDateString('en-GB', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'long',
                    })} at {tour ? formatTimeRange(d.start_time, tour.duration_hours) : d.start_time.slice(0, 5)} ({d.available_spots} spot{d.available_spots !== 1 ? 's' : ''})
                  </PSelectOption>
                ))}
              </PSelect>

              {dates.length === 0 && (
                <PInlineNotification state="warning" heading="No dates available" description="No upcoming dates are scheduled for this tour." dismissButton={false} />
              )}

              <PInputNumber
                label="Number of People"
                name="attendees"
                value={numAttendees}
                min={1}
                max={maxAttendees}
                controls
                onInput={(e) => setNumAttendees((e.target as HTMLInputElement).value)}
              />

              {selectedDateId && selectedDate && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacingStaticSmall,
                    padding: `${spacingStaticSmall} ${spacingStaticMedium}`,
                    borderRadius: borderRadiusMedium,
                    backgroundColor: 'var(--p-color-notification-info-soft)',
                  }}
                >
                  <PIcon name="calendar" size="x-small" color="primary" />
                  <PText size="x-small" weight="semi-bold">
                    {new Date(selectedDate.date + 'T00:00:00').toLocaleDateString('en-GB', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })} at {tour ? formatTimeRange(selectedDate.start_time, tour.duration_hours) : selectedDate.start_time.slice(0, 5)}
                  </PText>
                  <PTag color="notification-info-soft" compact>{attendeeCount} {attendeeCount === 1 ? 'person' : 'people'}</PTag>
                </div>
              )}

              {error && bookingStep === 0 && (
                <PInlineNotification state="error" heading="Missing info" description={error} dismissButton={false} />
              )}

              <PDivider />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <PText color="contrast-medium">Total</PText>
                <PHeading size="medium">
                  {(Number(tour.price_per_person) * attendeeCount).toLocaleString()} DKK
                </PHeading>
              </div>

              {needsBikeStep ? (
                <PButton
                  onClick={handleContinueToBikes}
                  icon="arrow-right"
                  disabled={dates.length === 0}
                  style={{ width: '100%' }}
                >
                  Continue to Bikes
                </PButton>
              ) : (
                <PButton
                  onClick={handleBookNow}
                  icon="arrow-right"
                  disabled={dates.length === 0}
                  style={{ width: '100%' }}
                >
                  Book Now
                </PButton>
              )}
            </div>
          )}

          {bookingStep === 1 && needsBikeStep && (
            <div style={{ padding: spacingStaticMedium, display: 'flex', flexDirection: 'column', gap: spacingStaticMedium }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacingStaticSmall,
                  padding: `${spacingStaticSmall} ${spacingStaticMedium}`,
                  borderRadius: borderRadiusMedium,
                  backgroundColor: 'var(--p-color-notification-success-soft)',
                }}
              >
                <PIcon name="check" size="x-small" color="notification-success" />
                <PText size="x-small" weight="semi-bold">
                  {new Date(selectedDate!.date + 'T00:00:00').toLocaleDateString('en-GB', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })} at {tour ? formatTimeRange(selectedDate!.start_time, tour.duration_hours) : selectedDate!.start_time.slice(0, 5)} -- {attendeeCount} {attendeeCount === 1 ? 'person' : 'people'}
                </PText>
              </div>

              <div>
                <PHeading size="small" tag="h3" style={{ marginBottom: '4px' }}>
                  Choose a bike for each person
                </PHeading>
                <PText size="x-small" color="contrast-medium">
                  Tap a person, then select their bike below.
                </PText>
              </div>

              <div style={{ display: 'flex', gap: spacingStaticSmall, flexWrap: 'wrap' }}>
                {Array.from({ length: attendeeCount }, (_, i) => {
                  const bikeId = attendeeBikes[i];
                  const selectedBike = bikeId ? bikes.find((b) => b.id === bikeId) : null;
                  const isActive = activePerson === i;

                  return (
                    <button
                      key={i}
                      onClick={() => setActivePerson(i)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '100px',
                        border: isActive
                          ? `${borderWidthBase} solid ${themeLightPrimary}`
                          : `${borderWidthThin} solid ${selectedBike ? 'var(--p-color-notification-success)' : themeLightContrastLow}`,
                        background: isActive ? themeLightPrimary : selectedBike ? 'var(--p-color-notification-success-soft)' : themeLightBackgroundBase,
                        color: isActive ? themeLightBackgroundBase : themeLightPrimary,
                        cursor: 'pointer',
                        fontFamily: "'Porsche Next','Arial Narrow',Arial,sans-serif",
                        fontSize: '13px',
                        fontWeight: 600,
                        transition: `all ${motionDurationShort} ${motionEasingBase}`,
                      }}
                    >
                      {selectedBike && !isActive && <PIcon name="check" size="x-small" color="notification-success" />}
                      Person {i + 1}
                    </button>
                  );
                })}
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: spacingStaticSmall,
                  maxHeight: '280px',
                  overflowY: 'auto',
                  paddingRight: '4px',
                }}
              >
                {bikesByCategory.map(({ category, bikes: catBikes }) => (
                  <div key={category.id}>
                    <PText size="xx-small" weight="semi-bold" color="contrast-medium" style={{ marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {category.name}
                    </PText>
                    {catBikes.map((bike) => {
                      const isSelected = attendeeBikes[activePerson] === bike.id;
                      return (
                        <button
                          key={bike.id}
                          onClick={() => {
                            setAttendeeBikes((prev) => {
                              const next = [...prev];
                              next[activePerson] = bike.id;
                              return next;
                            });
                            if (activePerson < attendeeCount - 1 && !attendeeBikes[activePerson + 1]) {
                              setTimeout(() => setActivePerson(activePerson + 1), 200);
                            }
                          }}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: spacingStaticSmall,
                            padding: spacingStaticSmall,
                            borderRadius: borderRadiusMedium,
                            border: isSelected
                              ? `${borderWidthBase} solid ${themeLightPrimary}`
                              : `${borderWidthThin} solid ${themeLightContrastLow}`,
                            background: isSelected ? 'var(--p-color-background-surface)' : themeLightBackgroundBase,
                            cursor: 'pointer',
                            textAlign: 'left',
                            marginBottom: spacingStaticSmall,
                            transition: `all ${motionDurationShort} ${motionEasingBase}`,
                            ...(isSelected ? dropShadowLowStyle : {}),
                          }}
                        >
                          {bike.image_url ? (
                            <div
                              style={{
                                width: '56px',
                                height: '56px',
                                borderRadius: borderRadiusSmall,
                                backgroundImage: `url(${bike.image_url})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                flexShrink: 0,
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: '56px',
                                height: '56px',
                                borderRadius: borderRadiusSmall,
                                backgroundColor: themeLightBackgroundSurface,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <PIcon name="configurate" size="small" color="contrast-medium" />
                            </div>
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontFamily: "'Porsche Next','Arial Narrow',Arial,sans-serif", fontWeight: 600, fontSize: '14px', lineHeight: '1.4' }}>
                              {bike.name}
                            </div>
                            <div style={{ fontFamily: "'Porsche Next','Arial Narrow',Arial,sans-serif", fontSize: '12px', color: '#6B6D70' }}>
                              Size {bike.size} -- {category.name}
                            </div>
                          </div>
                          {isSelected && (
                            <div
                              style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                backgroundColor: themeLightPrimary,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <PIcon name="check" size="x-small" color="contrast-high" theme="dark" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>

              {error && bookingStep === 1 && (
                <PInlineNotification state="error" heading="Missing info" description={error} dismissButton={false} />
              )}

              <PDivider />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <PText color="contrast-medium">Total</PText>
                <PHeading size="medium">
                  {(Number(tour.price_per_person) * attendeeCount).toLocaleString()} DKK
                </PHeading>
              </div>

              <div style={{ display: 'flex', gap: spacingStaticSmall }}>
                <PButton
                  variant="secondary"
                  onClick={() => setBookingStep(0)}
                  icon="arrow-left"
                  style={{ flex: '0 0 auto' }}
                  compact
                >
                  Back
                </PButton>
                <PButton
                  onClick={handleBookNow}
                  icon="arrow-right"
                  disabled={!allBikesSelected}
                  style={{ flex: 1 }}
                >
                  Book Now
                </PButton>
              </div>
            </div>
          )}
        </div>
      </section>

      <style>{`
        .tour-detail-grid {
          grid-template-columns: minmax(0, 1fr);
        }
        @media (min-width: 760px) {
          .tour-detail-grid {
            grid-template-columns: minmax(0, 1fr) 380px;
          }
          .tour-booking-card {
            position: sticky;
            top: 80px;
          }
        }
      `}</style>
    </div>
  );
}
