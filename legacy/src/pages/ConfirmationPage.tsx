import { useEffect, useState } from 'react';
import {
  PHeading,
  PText,
  PButton,
  PDivider,
  PIcon,
  PInlineNotification,
  PTag,
  PAccordion,
} from '@porsche-design-system/components-react';
import {
  motionDurationModerate,
  motionDurationLong,
  motionEasingIn,
  borderRadiusMedium,
} from '@porsche-design-system/components-react/styles';
import { supabase } from '../lib/supabase';
import { computeRentalDays, computeRentalDuration, formatDuration } from '../utils/rentalDuration';
import type { Booking, BookingPerson, BookingItem, Page } from '../types';

interface ConfirmationPageProps {
  bookingId: string;
  onNavigate: (page: Page) => void;
}

function ConfirmationSkeleton() {
  const shimmer = {
    background: 'linear-gradient(90deg, var(--p-color-background-surface) 25%, var(--p-color-contrast-low) 50%, var(--p-color-background-surface) 75%)',
    backgroundSize: '200% 100%',
    animation: 'skeletonShimmer 1.5s infinite',
    borderRadius: borderRadiusMedium,
  };

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: 'clamp(24px, 4vw, 64px) clamp(16px, 4vw, 48px)' }}>
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <div style={{ ...shimmer, width: '72px', height: '72px', borderRadius: '50%', margin: '0 auto 20px' }} />
        <div style={{ height: '32px', width: '280px', margin: '0 auto 12px', ...shimmer }} />
        <div style={{ height: '18px', width: '200px', margin: '0 auto 16px', ...shimmer }} />
        <div style={{ height: '28px', width: '160px', margin: '0 auto', ...shimmer }} />
      </div>

      <div
        style={{
          border: '1px solid var(--p-color-contrast-low)',
          borderRadius: 'var(--p-border-radius-lg)',
          overflow: 'hidden',
          marginBottom: '32px',
        }}
      >
        <div style={{ backgroundColor: 'var(--p-color-background-surface)', padding: '20px' }}>
          <div style={{ height: '20px', width: '140px', ...shimmer }} />
        </div>
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ height: '40px', ...shimmer }} />
            <div style={{ height: '40px', ...shimmer }} />
            <div style={{ height: '40px', ...shimmer }} />
            <div style={{ height: '40px', ...shimmer }} />
          </div>
          <div style={{ height: '1px', backgroundColor: 'var(--p-color-contrast-low)' }} />
          <div style={{ height: '48px', ...shimmer }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <div style={{ height: '44px', width: '140px', ...shimmer }} />
        <div style={{ height: '44px', width: '180px', ...shimmer }} />
      </div>
    </div>
  );
}

export function ConfirmationPage({ bookingId, onNavigate }: ConfirmationPageProps) {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadBooking() {
      const { data, error: err } = await supabase
        .from('bookings')
        .select('*, items:booking_items(*, bike:bikes(*), person:booking_persons(*)), persons:booking_persons(*)')
        .eq('id', bookingId)
        .maybeSingle();

      if (err || !data) {
        setError('Could not load booking details. Please contact us directly.');
      } else {
        setBooking(data as Booking);
      }
      setLoading(false);
    }
    loadBooking();
  }, [bookingId]);

  if (loading) {
    return <ConfirmationSkeleton />;
  }

  if (error || !booking) {
    return (
      <div style={{ maxWidth: '600px', margin: '80px auto', padding: '0 16px' }}>
        <PInlineNotification state="error" heading="Error" description={error} dismissButton={false} />
        <PButton style={{ marginTop: '24px' }} onClick={() => onNavigate('home')}>Back to Home</PButton>
      </div>
    );
  }

  const startTs = booking.start_at || `${booking.start_date}T09:00:00`;
  const endTs = booking.end_at || `${booking.end_date}T09:00:00`;
  const rentalDays = computeRentalDays(startTs, endTs);
  const rentalDur = computeRentalDuration(startTs, endTs);

  const persons: BookingPerson[] = (booking.persons || []).sort((a, b) => a.sort_order - b.sort_order);
  const isGroupBooking = persons.length > 1;

  function itemsForPerson(personId: string): BookingItem[] {
    return (booking!.items || []).filter((i) => i.person_id === personId);
  }

  const unassignedItems = (booking.items || []).filter((i) => !i.person_id);

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: 'clamp(24px, 4vw, 64px) clamp(16px, 4vw, 48px)' }}>
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <div style={{ position: 'relative', width: '72px', height: '72px', margin: '0 auto 20px' }}>
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              backgroundColor: 'var(--p-color-notification-success-soft)',
              transform: 'translate(-50%, -50%)',
              animation: 'radialPulse 1.2s ease-out',
              opacity: 0,
            }}
          />
          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              backgroundColor: 'var(--p-color-notification-success-soft)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              animation: `successPulse ${motionDurationLong} ${motionEasingIn} both`,
            }}
          >
            <div style={{ animation: `checkReveal 0.3s ${motionEasingIn} 0.3s both` }}>
              <PIcon name="check" size="large" color="notification-success" />
            </div>
          </div>
        </div>

        <PHeading
          size="x-large"
          tag="h1"
          style={{
            marginBottom: '12px',
            animation: `staggerFadeIn ${motionDurationModerate} ${motionEasingIn} both`,
            animationDelay: '200ms',
          }}
        >
          Booking Confirmed!
        </PHeading>
        <PText
          size="medium"
          color="contrast-medium"
          style={{
            marginBottom: '16px',
            animation: `staggerFadeIn ${motionDurationModerate} ${motionEasingIn} both`,
            animationDelay: '300ms',
          }}
        >
          Thank you, {booking.customer_name}. Your bikes are reserved.
        </PText>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
            justifyContent: 'center',
            animation: `staggerFadeIn ${motionDurationModerate} ${motionEasingIn} both`,
            animationDelay: '400ms',
          }}
        >
          <PText size="small" color="contrast-medium">Confirmation code:</PText>
          <PTag variant="info" icon="card">
            {booking.confirmation_code}
          </PTag>
          {booking.payment_method === 'card_online' && (booking.payment_status === 'authorized' || booking.payment_status === 'captured') && (
            <PTag color="notification-success-soft" compact icon="lock">Card Authorized</PTag>
          )}
          {booking.payment_method === 'at_pickup' && (
            <PTag color="notification-info-soft" compact icon="home">Pay at Pickup</PTag>
          )}
          {isGroupBooking && (
            <PTag variant="secondary" icon="group">
              {persons.length} people
            </PTag>
          )}
        </div>
      </div>

      <div
        style={{
          border: '1px solid var(--p-color-contrast-low)',
          borderRadius: 'var(--p-border-radius-lg)',
          overflow: 'hidden',
          marginBottom: '32px',
          animation: `staggerFadeIn ${motionDurationModerate} ${motionEasingIn} both`,
          animationDelay: '500ms',
        }}
      >
        <div style={{ backgroundColor: 'var(--p-color-background-surface)', padding: '20px' }}>
          <PHeading size="small" tag="h2">Booking Details</PHeading>
        </div>
        <PDivider />
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
              <PText size="x-small" color="contrast-medium">Status</PText>
              <PTag variant="success" icon="check" compact>Confirmed</PTag>
            </div>
          </div>

          <PDivider />

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <PIcon name="calendar" size="small" />
            <div>
              <PText size="small" weight="semi-bold">
                {new Date(booking.start_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                {booking.pickup_time ? ` at ${booking.pickup_time.slice(0, 5)}` : ''}
                {' – '}
                {new Date(booking.end_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                {booking.dropoff_time ? ` at ${booking.dropoff_time.slice(0, 5)}` : ''}
              </PText>
              <PText size="x-small" color="contrast-medium">{formatDuration(rentalDur)}</PText>
            </div>
          </div>

          {(booking.pickup_location || booking.dropoff_location) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {booking.pickup_location && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                  <PIcon name="arrow-head-down" size="x-small" color="contrast-medium" style={{ marginTop: '3px', flexShrink: 0 }} />
                  <div>
                    <PText size="x-small" color="contrast-medium">Pick-up</PText>
                    <PText size="small" weight="semi-bold">{booking.pickup_location}</PText>
                  </div>
                </div>
              )}
              {booking.dropoff_location && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
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
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                        <div slot="header-end" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          {pItems.some((i) => i.bike?.category?.slug !== 'accessories') ? (
                            <PTag variant="success" compact icon="check">Bike</PTag>
                          ) : (
                            <PTag variant="secondary" compact>Accessories only</PTag>
                          )}
                        </div>

                        {pItems.length === 0 ? (
                          <PText size="x-small" color="contrast-medium">No items assigned</PText>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {pItems.map((item) => (
                              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                <div>
                                  <PText size="small">{item.bike?.name}</PText>
                                  {item.bike?.size && (
                                    <PText size="x-small" color="contrast-medium">Size {item.bike.size}</PText>
                                  )}
                                  <PText size="x-small" color="contrast-medium">
                                    {item.quantity}x {item.price_per_day} DKK/day x {formatDuration(rentalDur)}
                                  </PText>
                                </div>
                                <PText size="small" weight="semi-bold">
                                  {(item.price_per_day * item.quantity * rentalDays).toLocaleString()} DKK
                                </PText>
                              </div>
                            ))}
                            {subtotal > 0 && (
                              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
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
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {unassignedItems.map((item) => (
                          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                            <div>
                              <PText size="small">{item.bike?.name}</PText>
                              <PText size="x-small" color="contrast-medium">
                                {item.quantity}x {item.price_per_day} DKK/day x {formatDuration(rentalDur)}
                              </PText>
                            </div>
                            <PText size="small" weight="semi-bold">
                              {(item.price_per_day * item.quantity * rentalDays).toLocaleString()} DKK
                            </PText>
                          </div>
                        ))}
                      </div>
                    </PAccordion>
                  )}
                </div>
              ) : (
                booking.items.map((item) => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <div>
                      <PText size="small">{item.bike?.name}</PText>
                      {item.bike?.size && (
                        <PText size="x-small" color="contrast-medium">Size {item.bike.size}</PText>
                      )}
                      <PText size="x-small" color="contrast-medium">
                        {item.quantity}x {item.price_per_day} DKK/day x {formatDuration(rentalDur)}
                      </PText>
                    </div>
                    <PText size="small" weight="semi-bold">
                      {(item.price_per_day * item.quantity * rentalDays).toLocaleString()} DKK
                    </PText>
                  </div>
                ))
              )}

              <PDivider />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <PText weight="semi-bold">Total</PText>
                <PHeading size="small">{booking.total_price.toLocaleString()} DKK</PHeading>
              </div>
            </div>
          </>
        )}
      </div>

      <div
        style={{
          backgroundColor: 'var(--p-color-background-surface)',
          borderRadius: 'var(--p-border-radius-md)',
          padding: '20px',
          marginBottom: '32px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          animation: `staggerFadeIn ${motionDurationModerate} ${motionEasingIn} both`,
          animationDelay: '600ms',
        }}
      >
        {booking.payment_method === 'card_online' && (booking.payment_status === 'authorized' || booking.payment_status === 'captured') && (
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <PIcon name="lock" size="small" color="notification-success" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <PText size="small" weight="semi-bold" style={{ marginBottom: '4px' }}>Card Payment Authorized</PText>
              <PText size="small" color="contrast-medium">
                Your card has been authorized. The amount will be charged when you pick up your equipment.
              </PText>
            </div>
          </div>
        )}
        {booking.payment_method === 'at_pickup' && (
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <PIcon name="home" size="small" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <PText size="small" weight="semi-bold" style={{ marginBottom: '4px' }}>Pay at Pickup</PText>
              <PText size="small" color="contrast-medium">
                Payment will be collected at the shop when you pick up your equipment.
              </PText>
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <PIcon name="geo-localization" size="small" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <PText size="small" weight="semi-bold" style={{ marginBottom: '4px' }}>Pick-up Location</PText>
            <PText size="small" color="contrast-medium">
              RentABike — Sverrisgota 20, FO-100 Torshavn
              <br />
              (+298) 270600 -- rentabike@rentabike.fo
            </PText>
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          animation: `staggerFadeIn ${motionDurationModerate} ${motionEasingIn} both`,
          animationDelay: '700ms',
        }}
      >
        <PButton variant="secondary" onClick={() => onNavigate('home')}>Back to Home</PButton>
        <PButton onClick={() => onNavigate('booking-setup')} icon="arrow-right">Make Another Booking</PButton>
      </div>
    </div>
  );
}
