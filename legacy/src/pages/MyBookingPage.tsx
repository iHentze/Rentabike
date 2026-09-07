import { useState } from 'react';
import {
  PHeading,
  PText,
  PButton,
  PInputText,
  PDivider,
  PIcon,
  PInlineNotification,
  PTag,
  PAccordion,
  PSpinner,
} from '@porsche-design-system/components-react';
import {
  spacingFluidSmall,
  spacingFluidMedium,
  spacingFluidLarge,
  spacingStaticSmall,
  spacingStaticMedium,
  borderRadiusLarge,
  borderRadiusMedium,
  motionDurationModerate,
  motionEasingIn,
} from '@porsche-design-system/components-react/styles';
import { supabase } from '../lib/supabase';
import { computeRentalDays, computeRentalDuration, formatDuration, formatTimeRange } from '../utils/rentalDuration';
import type { Booking, BookingPerson, BookingItem, TourBooking, Page } from '../types';

interface MyBookingPageProps {
  onNavigate: (page: Page) => void;
}

const STATUS_MAP: Record<string, { variant: 'success' | 'warning' | 'error'; icon: string; label: string }> = {
  confirmed: { variant: 'success', icon: 'check', label: 'Confirmed' },
  pending: { variant: 'warning', icon: 'clock', label: 'Pending' },
  cancelled: { variant: 'error', icon: 'close', label: 'Cancelled' },
};

export function MyBookingPage({ onNavigate }: MyBookingPageProps) {
  const [code, setCode] = useState('');
  const [booking, setBooking] = useState<Booking | null>(null);
  const [tourBooking, setTourBooking] = useState<TourBooking | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;

    setLoading(true);
    setError('');
    setBooking(null);
    setTourBooking(null);
    setSearched(true);

    const isTourCode = trimmed.startsWith('T');

    if (isTourCode) {
      const { data: tourData } = await supabase
        .from('tour_bookings')
        .select('*, tour_date:tour_dates(*, tour:tours(*)), participants:tour_participants(*, bike:bikes(name, size, category:categories(name)))')
        .eq('confirmation_code', trimmed)
        .maybeSingle();

      if (tourData) {
        setTourBooking(tourData as TourBooking);
        setLoading(false);
        return;
      }
    }

    const { data, error: err } = await supabase
      .from('bookings')
      .select('*, items:booking_items(*, bike:bikes(*, category:categories(*)), person:booking_persons(*)), persons:booking_persons(*)')
      .eq('confirmation_code', trimmed)
      .maybeSingle();

    if (data) {
      setBooking(data as Booking);
    } else if (!isTourCode) {
      const { data: tourData2 } = await supabase
        .from('tour_bookings')
        .select('*, tour_date:tour_dates(*, tour:tours(*)), participants:tour_participants(*, bike:bikes(name, size, category:categories(name)))')
        .eq('confirmation_code', trimmed)
        .maybeSingle();

      if (tourData2) {
        setTourBooking(tourData2 as TourBooking);
      } else if (err) {
        setError('Something went wrong. Please try again.');
      } else {
        setError('No booking found with that confirmation code. Please check and try again.');
      }
    } else {
      setError('No booking found with that confirmation code. Please check and try again.');
    }
    setLoading(false);
  }

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: `${spacingFluidLarge} ${spacingFluidMedium}` }}>
      <div style={{ textAlign: 'center', marginBottom: spacingFluidMedium }}>
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: 'var(--p-color-background-surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto',
            marginBottom: spacingStaticMedium,
          }}
        >
          <PIcon name="online-search" size="medium" />
        </div>
        <PHeading size="x-large" tag="h1" style={{ marginBottom: spacingStaticSmall }}>
          Find Your Booking
        </PHeading>
        <PText color="contrast-medium">
          Enter the confirmation code you received when you booked.
        </PText>
      </div>

      <form
        onSubmit={handleLookup}
        style={{
          display: 'flex',
          gap: spacingStaticSmall,
          alignItems: 'flex-end',
          marginBottom: spacingFluidMedium,
        }}
      >
        <div style={{ flex: 1 }}>
          <PInputText
            label="Confirmation Code"
            name="code"
            placeholder="e.g. AB12CD34"
            value={code}
            onInput={(e) => setCode((e.target as HTMLInputElement).value)}
          />
        </div>
        <PButton type="submit" loading={loading} disabled={loading || !code.trim()} icon="online-search">
          Look Up
        </PButton>
      </form>

      {error && (
        <PInlineNotification
          state="error"
          heading="Not Found"
          description={error}
          dismissButton={false}
          style={{ marginBottom: spacingFluidMedium }}
        />
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: spacingFluidLarge }}>
          <PSpinner size="medium" />
        </div>
      )}

      {booking && <BookingDetails booking={booking} onNavigate={onNavigate} />}

      {tourBooking && <TourBookingDetails tourBooking={tourBooking} onNavigate={onNavigate} />}

      {!booking && !tourBooking && searched && !loading && !error && null}
    </div>
  );
}

function BookingDetails({ booking, onNavigate }: { booking: Booking; onNavigate: (page: Page) => void }) {
  const startTs = booking.start_at || `${booking.start_date}T09:00:00`;
  const endTs = booking.end_at || `${booking.end_date}T09:00:00`;
  const rentalDays = computeRentalDays(startTs, endTs);
  const rentalDur = computeRentalDuration(startTs, endTs);
  const persons: BookingPerson[] = (booking.persons || []).sort((a, b) => a.sort_order - b.sort_order);
  const isGroupBooking = persons.length > 1;
  const status = STATUS_MAP[booking.status] || STATUS_MAP.pending;

  function itemsForPerson(personId: string): BookingItem[] {
    return (booking.items || []).filter((i) => i.person_id === personId);
  }

  const unassignedItems = (booking.items || []).filter((i) => !i.person_id);

  return (
    <div
      style={{
        animation: `staggerFadeIn ${motionDurationModerate} ${motionEasingIn} both`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacingStaticSmall,
          marginBottom: spacingFluidSmall,
          flexWrap: 'wrap',
        }}
      >
        <PTag variant={status.variant} icon={status.icon as never}>
          {status.label}
        </PTag>
        <PTag variant="info" icon="card">
          {booking.confirmation_code}
        </PTag>
        {isGroupBooking && (
          <PTag variant="secondary" icon="group">
            {persons.length} people
          </PTag>
        )}
      </div>

      <div
        style={{
          border: '1px solid var(--p-color-contrast-low)',
          borderRadius: borderRadiusLarge,
          overflow: 'hidden',
          marginBottom: spacingFluidMedium,
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--p-color-background-surface)',
            padding: `${spacingStaticSmall} ${spacingStaticMedium}`,
            display: 'flex',
            alignItems: 'center',
            gap: spacingStaticSmall,
          }}
        >
          <PIcon name="document" size="small" color="primary" />
          <PHeading size="small" tag="h2">Booking Details</PHeading>
        </div>
        <PDivider />

        <div style={{ padding: spacingStaticMedium, display: 'flex', flexDirection: 'column', gap: spacingStaticMedium }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacingStaticMedium }}>
            <div>
              <PText size="x-small" color="contrast-medium">Customer</PText>
              <PText size="small" weight="semi-bold">{booking.customer_name}</PText>
            </div>
            <div>
              <PText size="x-small" color="contrast-medium">Email</PText>
              <PText size="small">{booking.customer_email}</PText>
            </div>
            <div>
              <PText size="x-small" color="contrast-medium">Phone</PText>
              <PText size="small">{booking.customer_phone}</PText>
            </div>
            <div>
              <PText size="x-small" color="contrast-medium">Booked on</PText>
              <PText size="small">
                {new Date(booking.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </PText>
            </div>
          </div>

          <PDivider />

          <div style={{ display: 'flex', gap: spacingStaticSmall, alignItems: 'center' }}>
            <PIcon name="calendar" size="small" />
            <div>
              <PText size="small" weight="semi-bold">
                {new Date(booking.start_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                {booking.pickup_time ? ` at ${booking.pickup_time.slice(0, 5)}` : ''}
                {' -- '}
                {new Date(booking.end_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                {booking.dropoff_time ? ` at ${booking.dropoff_time.slice(0, 5)}` : ''}
              </PText>
              <PText size="x-small" color="contrast-medium">{formatDuration(rentalDur)}</PText>
            </div>
          </div>

          {(booking.pickup_location || booking.dropoff_location) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacingStaticSmall }}>
              {booking.pickup_location && (
                <div style={{ display: 'flex', gap: spacingStaticSmall, alignItems: 'flex-start' }}>
                  <PIcon name="arrow-head-down" size="x-small" color="contrast-medium" style={{ marginTop: '3px', flexShrink: 0 }} />
                  <div>
                    <PText size="x-small" color="contrast-medium">Pick-up</PText>
                    <PText size="small" weight="semi-bold">{booking.pickup_location}</PText>
                  </div>
                </div>
              )}
              {booking.dropoff_location && (
                <div style={{ display: 'flex', gap: spacingStaticSmall, alignItems: 'flex-start' }}>
                  <PIcon name="arrow-head-up" size="x-small" color="contrast-medium" style={{ marginTop: '3px', flexShrink: 0 }} />
                  <div>
                    <PText size="x-small" color="contrast-medium">Drop-off</PText>
                    <PText size="small" weight="semi-bold">{booking.dropoff_location}</PText>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {booking.items && booking.items.length > 0 && (
          <>
            <PDivider />
            <div style={{ padding: spacingStaticMedium, display: 'flex', flexDirection: 'column', gap: spacingStaticSmall }}>
              <PHeading size="small" tag="h3">
                {isGroupBooking ? 'Group Rental Manifest' : 'Rented Items'}
              </PHeading>

              {isGroupBooking ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {persons.map((person) => {
                    const pItems = itemsForPerson(person.id);
                    const subtotal = pItems.reduce((s, i) => s + i.price_per_day * i.quantity * rentalDays, 0);
                    return (
                      <PAccordion key={person.id} heading={person.person_label} tag="h4" open={pItems.length > 0}>
                        {pItems.length === 0 ? (
                          <PText size="x-small" color="contrast-medium">No items assigned</PText>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: spacingStaticSmall }}>
                            {pItems.map((item) => (
                              <ItemRow key={item.id} item={item} rentalDur={rentalDur} rentalDays={rentalDays} />
                            ))}
                            {subtotal > 0 && (
                              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <PText size="x-small" color="contrast-medium">
                                  Subtotal: {subtotal.toLocaleString()} DKK
                                </PText>
                              </div>
                            )}
                          </div>
                        )}
                      </PAccordion>
                    );
                  })}
                  {unassignedItems.length > 0 && (
                    <PAccordion heading="General" tag="h4" open>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: spacingStaticSmall }}>
                        {unassignedItems.map((item) => (
                          <ItemRow key={item.id} item={item} rentalDur={rentalDur} rentalDays={rentalDays} />
                        ))}
                      </div>
                    </PAccordion>
                  )}
                </div>
              ) : (
                booking.items.map((item) => (
                  <ItemRow key={item.id} item={item} rentalDur={rentalDur} rentalDays={rentalDays} />
                ))
              )}

              <PDivider />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: `${spacingStaticSmall} ${spacingStaticSmall}`,
                  borderRadius: borderRadiusMedium,
                  backgroundColor: 'var(--p-color-background-surface)',
                }}
              >
                <PText weight="semi-bold">Total</PText>
                <PHeading size="medium">{booking.total_price.toLocaleString()} DKK</PHeading>
              </div>
            </div>
          </>
        )}
      </div>

      {booking.notes && (
        <div
          style={{
            backgroundColor: 'var(--p-color-background-surface)',
            borderRadius: borderRadiusMedium,
            padding: spacingStaticMedium,
            marginBottom: spacingFluidMedium,
            display: 'flex',
            gap: spacingStaticSmall,
            alignItems: 'flex-start',
          }}
        >
          <PIcon name="chat" size="small" color="contrast-medium" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <PText size="x-small" color="contrast-medium" style={{ marginBottom: '4px' }}>Special Requests</PText>
            <PText size="small">{booking.notes}</PText>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: spacingStaticSmall, flexWrap: 'wrap' }}>
        <PButton variant="secondary" onClick={() => onNavigate('home')}>
          Back to Home
        </PButton>
        <PButton onClick={() => onNavigate('booking-setup')} icon="arrow-right">
          Make Another Booking
        </PButton>
      </div>
    </div>
  );
}

function ItemRow({ item, rentalDur, rentalDays }: { item: BookingItem; rentalDur: ReturnType<typeof computeRentalDuration>; rentalDays: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacingStaticSmall }}>
      <div>
        <PText size="small">{item.bike?.name}</PText>
        {item.bike?.size && (
          <PText size="x-small" color="contrast-medium">Size {item.bike.size}</PText>
        )}
        <PText size="x-small" color="contrast-medium">
          {item.quantity}x {item.price_per_day} DKK/day x {formatDuration(rentalDur)}
        </PText>
      </div>
      <PText size="small" weight="semi-bold" style={{ flexShrink: 0 }}>
        {(item.price_per_day * item.quantity * rentalDays).toLocaleString()} DKK
      </PText>
    </div>
  );
}

function TourBookingDetails({ tourBooking, onNavigate }: { tourBooking: TourBooking; onNavigate: (page: Page) => void }) {
  const status = STATUS_MAP[tourBooking.status] || STATUS_MAP.pending;
  const tourDate = tourBooking.tour_date;
  const tour = tourDate?.tour;
  const participants = (tourBooking.participants || []).sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div style={{ animation: `staggerFadeIn ${motionDurationModerate} ${motionEasingIn} both` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacingStaticSmall, marginBottom: spacingFluidSmall, flexWrap: 'wrap' }}>
        <PTag variant={status.variant} icon={status.icon as never}>{status.label}</PTag>
        <PTag variant="info" icon="card">{tourBooking.confirmation_code}</PTag>
        <PTag variant="secondary" icon="map">Guided Tour</PTag>
      </div>

      <div style={{ border: '1px solid var(--p-color-contrast-low)', borderRadius: borderRadiusLarge, overflow: 'hidden', marginBottom: spacingFluidMedium }}>
        <div style={{ backgroundColor: 'var(--p-color-background-surface)', padding: `${spacingStaticSmall} ${spacingStaticMedium}`, display: 'flex', alignItems: 'center', gap: spacingStaticSmall }}>
          <PIcon name="map" size="small" color="primary" />
          <PHeading size="small" tag="h2">Tour Booking</PHeading>
        </div>
        <PDivider />

        <div style={{ padding: spacingStaticMedium, display: 'flex', flexDirection: 'column', gap: spacingStaticMedium }}>
          {tour && (
            <div>
              <PText size="x-small" color="contrast-medium">Tour</PText>
              <PText size="small" weight="semi-bold">{tour.name}</PText>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacingStaticMedium }}>
            <div>
              <PText size="x-small" color="contrast-medium">Customer</PText>
              <PText size="small" weight="semi-bold">{tourBooking.customer_name}</PText>
            </div>
            <div>
              <PText size="x-small" color="contrast-medium">Email</PText>
              <PText size="small">{tourBooking.customer_email}</PText>
            </div>
          </div>

          {tourDate && (
            <div style={{ display: 'flex', gap: spacingStaticSmall, alignItems: 'center' }}>
              <PIcon name="calendar" size="small" />
              <PText size="small" weight="semi-bold">
                {new Date(tourDate.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })} at {tour ? formatTimeRange(tourDate.start_time, tour.duration_hours) : tourDate.start_time.slice(0, 5)}
              </PText>
            </div>
          )}

          {tour && (
            <div style={{ display: 'flex', gap: spacingStaticSmall, alignItems: 'center' }}>
              <PIcon name="map" size="small" />
              <div>
                <PText size="x-small" color="contrast-medium">Meeting Point</PText>
                <PText size="small" weight="semi-bold">{tour.meeting_point}</PText>
              </div>
            </div>
          )}

          {participants.length > 0 && (
            <>
              <PDivider />
              <PHeading size="small" tag="h3">Participants</PHeading>
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacingStaticSmall }}>
                {participants.map((p) => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: spacingStaticSmall }}>
                    <PTag compact>{p.person_label}</PTag>
                    {p.bike ? (
                      <PText size="small">{p.bike.name} -- {p.bike.size}</PText>
                    ) : (
                      <PText size="small" color="contrast-medium">No bike</PText>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          <PDivider />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `${spacingStaticSmall} ${spacingStaticSmall}`, borderRadius: borderRadiusMedium, backgroundColor: 'var(--p-color-background-surface)' }}>
            <PText weight="semi-bold">Total</PText>
            <PHeading size="medium">{Number(tourBooking.total_price).toLocaleString()} DKK</PHeading>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: spacingStaticSmall, flexWrap: 'wrap' }}>
        <PButton variant="secondary" onClick={() => onNavigate('home')}>Back to Home</PButton>
        <PButton onClick={() => onNavigate('tours')} icon="arrow-right">Browse Tours</PButton>
      </div>
    </div>
  );
}
