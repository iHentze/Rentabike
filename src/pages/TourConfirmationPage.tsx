import { useState, useEffect } from 'react';
import {
  PHeading,
  PText,
  PButton,
  PIcon,
  PTag,
  PDivider,
  PSpinner,
} from '@porsche-design-system/components-react';
import {
  spacingFluidMedium,
  spacingFluidSmall,
  spacingFluidLarge,
  spacingStaticSmall,
  spacingStaticMedium,
  borderRadiusLarge,
  borderRadiusMedium,
  motionDurationModerate,
  motionEasingIn,
} from '@porsche-design-system/components-react/styles';
import { supabase } from '../lib/supabase';
import { formatTimeRange } from '../utils/rentalDuration';
import type { Page, TourBooking } from '../types';

interface TourConfirmationPageProps {
  bookingId: string;
  onNavigate: (page: Page) => void;
}

export function TourConfirmationPage({ bookingId, onNavigate }: TourConfirmationPageProps) {
  const [booking, setBooking] = useState<TourBooking | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from('tour_bookings')
        .select('*, tour_date:tour_dates(*, tour:tours(*)), participants:tour_participants(*, bike:bikes(name, size, category:categories(name)))')
        .eq('id', bookingId)
        .maybeSingle();

      if (data) setBooking(data as TourBooking);
      setLoading(false);
    }
    if (bookingId) load();
  }, [bookingId]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <PSpinner size="large" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: spacingFluidLarge, textAlign: 'center' }}>
        <PText color="contrast-medium">Booking not found.</PText>
        <PButton variant="secondary" onClick={() => onNavigate('home')} style={{ marginTop: spacingFluidSmall }}>Go Home</PButton>
      </div>
    );
  }

  const tourDate = booking.tour_date;
  const tour = tourDate?.tour;
  const participants = (booking.participants || []).sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div
      style={{
        maxWidth: '680px',
        margin: '0 auto',
        padding: `${spacingFluidLarge} ${spacingFluidMedium}`,
        animation: `staggerFadeIn ${motionDurationModerate} ${motionEasingIn} both`,
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: spacingFluidMedium }}>
        <div
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            backgroundColor: 'var(--p-color-notification-success-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto',
            marginBottom: spacingStaticMedium,
          }}
        >
          <PIcon name="check" size="large" color="notification-success" />
        </div>
        <PHeading size="x-large" tag="h1" style={{ marginBottom: spacingStaticSmall }}>
          Booking Confirmed!
        </PHeading>
        <PText color="contrast-medium">
          Your tour has been booked. You'll receive a confirmation email shortly.
        </PText>
        <div style={{ display: 'inline-flex', gap: spacingStaticSmall, marginTop: spacingStaticSmall, flexWrap: 'wrap', justifyContent: 'center' }}>
          {booking.payment_method === 'card_online' && (booking.payment_status === 'authorized' || booking.payment_status === 'captured') && (
            <PTag color="notification-success-soft" compact icon="lock">Card Authorized</PTag>
          )}
          {booking.payment_method === 'at_pickup' && (
            <PTag color="notification-info-soft" compact icon="home">Pay at Pickup</PTag>
          )}
        </div>
      </div>

      <div
        style={{
          borderRadius: borderRadiusLarge,
          border: '1px solid var(--p-color-contrast-low)',
          overflow: 'hidden',
          marginBottom: spacingFluidMedium,
        }}
      >
        <div
          style={{
            padding: spacingStaticMedium,
            backgroundColor: 'var(--p-color-background-surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <PHeading size="small" tag="h2">Tour Booking</PHeading>
          <PTag variant="success" icon="check">{booking.confirmation_code}</PTag>
        </div>
        <PDivider />

        <div style={{ padding: spacingStaticMedium, display: 'flex', flexDirection: 'column', gap: spacingStaticMedium }}>
          {tour && (
            <div>
              <PText size="x-small" color="contrast-medium">Tour</PText>
              <PText weight="semi-bold">{tour.name}</PText>
            </div>
          )}

          {tourDate && (
            <div style={{ display: 'flex', gap: spacingStaticMedium, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacingStaticSmall }}>
                <PIcon name="calendar" size="small" />
                <div>
                  <PText size="x-small" color="contrast-medium">Date</PText>
                  <PText size="small" weight="semi-bold">
                    {new Date(tourDate.date + 'T00:00:00').toLocaleDateString('en-GB', {
                      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </PText>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacingStaticSmall }}>
                <PIcon name="clock" size="small" />
                <div>
                  <PText size="x-small" color="contrast-medium">Time</PText>
                  <PText size="small" weight="semi-bold">{tour ? formatTimeRange(tourDate.start_time, tour.duration_hours) : tourDate.start_time.slice(0, 5)}</PText>
                </div>
              </div>
            </div>
          )}

          {tour && (
            <div style={{ display: 'flex', alignItems: 'center', gap: spacingStaticSmall }}>
              <PIcon name="map" size="small" />
              <div>
                <PText size="x-small" color="contrast-medium">Meeting Point</PText>
                <PText size="small" weight="semi-bold">{tour.meeting_point}</PText>
              </div>
            </div>
          )}

          <div>
            <PText size="x-small" color="contrast-medium">Customer</PText>
            <PText size="small" weight="semi-bold">{booking.customer_name}</PText>
            <PText size="x-small" color="contrast-medium">{booking.customer_email}</PText>
          </div>

          {participants.length > 0 && (
            <>
              <PDivider />
              <PText size="x-small" weight="semi-bold" color="contrast-medium">Participants</PText>
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
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: spacingStaticSmall,
              borderRadius: borderRadiusMedium,
              backgroundColor: 'var(--p-color-background-surface)',
            }}
          >
            <PText weight="semi-bold">Total</PText>
            <PHeading size="medium">{Number(booking.total_price).toLocaleString()} DKK</PHeading>
          </div>
        </div>
      </div>

      <div
        style={{
          backgroundColor: 'var(--p-color-background-surface)',
          borderRadius: borderRadiusMedium,
          padding: spacingStaticMedium,
          marginBottom: spacingFluidSmall,
          display: 'flex',
          flexDirection: 'column',
          gap: spacingStaticMedium,
        }}
      >
        {booking.payment_method === 'card_online' && (booking.payment_status === 'authorized' || booking.payment_status === 'captured') && (
          <div style={{ display: 'flex', gap: spacingStaticSmall, alignItems: 'flex-start' }}>
            <PIcon name="lock" size="small" color="notification-success" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <PText size="small" weight="semi-bold">Card Payment Authorized</PText>
              <PText size="x-small" color="contrast-medium">
                Your card has been authorized. The amount will be charged on the tour day.
              </PText>
            </div>
          </div>
        )}
        {booking.payment_method === 'at_pickup' && (
          <div style={{ display: 'flex', gap: spacingStaticSmall, alignItems: 'flex-start' }}>
            <PIcon name="home" size="small" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <PText size="small" weight="semi-bold">Pay at Meeting Point</PText>
              <PText size="x-small" color="contrast-medium">
                Payment will be collected at the meeting point before the tour starts.
              </PText>
            </div>
          </div>
        )}
        {tour && (
          <div style={{ display: 'flex', gap: spacingStaticSmall, alignItems: 'flex-start' }}>
            <PIcon name="map" size="small" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <PText size="small" weight="semi-bold">Meeting Point</PText>
              <PText size="x-small" color="contrast-medium">{tour.meeting_point}</PText>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: spacingFluidSmall, flexWrap: 'wrap' }}>
        <PButton variant="secondary" onClick={() => onNavigate('my-booking')}>View My Booking</PButton>
        <PButton onClick={() => onNavigate('home')} icon="arrow-right">Back to Home</PButton>
      </div>
    </div>
  );
}
