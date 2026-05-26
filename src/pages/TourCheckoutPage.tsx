import { useState, useEffect } from 'react';
import {
  PHeading,
  PText,
  PButton,
  PInputText,
  PInputEmail,
  PTextarea,
  PDivider,
  PIcon,
  PTag,
  PInlineNotification,
} from '@porsche-design-system/components-react';
import {
  spacingFluidMedium,
  spacingFluidSmall,
  spacingFluidLarge,
  spacingStaticSmall,
  spacingStaticMedium,
  borderRadiusLarge,
  borderRadiusMedium,
  borderWidthThin,
  dropShadowLowStyle,
  themeLightContrastLow,
} from '@porsche-design-system/components-react/styles';
import { supabase } from '../lib/supabase';
import { formatTimeRange } from '../utils/rentalDuration';
import { PaymentForm } from '../components/PaymentForm';
import { PaymentMethodSelector } from '../components/PaymentMethodSelector';
import type { Page, Bike, PaymentMethod, TourBookingSetup } from '../types';

const EPAY_ENABLED = import.meta.env.VITE_EPAY_ENABLED === 'true';

interface TourCheckoutPageProps {
  bookingSetup: TourBookingSetup | null;
  onNavigate: (page: Page) => void;
  onConfirmation: (bookingId: string) => void;
}

export function TourCheckoutPage({ bookingSetup, onNavigate, onConfirmation }: TourCheckoutPageProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [bikeLookup, setBikeLookup] = useState<Record<string, Bike>>({});
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(EPAY_ENABLED ? 'card_online' : 'at_pickup');
  const [paymentStep, setPaymentStep] = useState(false);
  const [pendingBookingId, setPendingBookingId] = useState<string | null>(null);

  useEffect(() => {
    if (!bookingSetup?.needsBike) return;
    const bikeIds = bookingSetup.attendeeBikes
      .map((a) => a.bikeId)
      .filter(Boolean) as string[];
    if (bikeIds.length === 0) return;

    supabase
      .from('bikes')
      .select('*, category:categories(name)')
      .in('id', bikeIds)
      .then(({ data }) => {
        if (data) {
          const lookup: Record<string, Bike> = {};
          data.forEach((b) => { lookup[b.id] = b as Bike; });
          setBikeLookup(lookup);
        }
      });
  }, [bookingSetup]);

  if (!bookingSetup) {
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: spacingFluidLarge, textAlign: 'center' }}>
        <PInlineNotification state="warning" heading="No booking in progress" description="Please select a tour first." dismissButton={false} />
        <PButton variant="secondary" onClick={() => onNavigate('tours')} style={{ marginTop: spacingFluidSmall }}>Browse Tours</PButton>
      </div>
    );
  }

  const totalPrice = bookingSetup.pricePerPerson * bookingSetup.numAttendees;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError('Name and email are required');
      return;
    }
    if (bookingSetup!.needsBike && bookingSetup!.attendeeBikes.some((a) => !a.bikeId)) {
      setError('Each person must have a bike selected');
      return;
    }
    setSubmitting(true);
    setError('');

    const isCardPayment = paymentMethod === 'card_online';

    try {
      const { data: booking, error: bookingErr } = await supabase
        .from('tour_bookings')
        .insert({
          tour_date_id: bookingSetup!.tourDateId,
          customer_name: name.trim(),
          customer_email: email.trim(),
          customer_phone: phone.trim(),
          num_attendees: bookingSetup!.numAttendees,
          total_price: totalPrice,
          notes: notes.trim(),
          status: isCardPayment ? 'pending' : 'confirmed',
          payment_method: paymentMethod,
          payment_status: 'none',
        })
        .select()
        .maybeSingle();

      if (bookingErr || !booking) throw new Error(bookingErr?.message || 'Failed to create booking');

      const participants = bookingSetup!.attendeeBikes.map((a, i) => ({
        tour_booking_id: booking.id,
        person_label: a.label,
        bike_id: a.bikeId,
        sort_order: i,
      }));

      if (participants.length > 0) {
        const { error: partErr } = await supabase.from('tour_participants').insert(participants);
        if (partErr) throw new Error(partErr.message);
      }

      await supabase
        .from('tour_dates')
        .update({
          available_spots: Math.max(
            0,
            (await supabase.from('tour_dates').select('available_spots').eq('id', bookingSetup!.tourDateId).maybeSingle())
              .data?.available_spots - bookingSetup!.numAttendees
          ),
        })
        .eq('id', bookingSetup!.tourDateId);

      if (isCardPayment) {
        setPendingBookingId(booking.id);
        setPaymentStep(true);
      } else {
        onConfirmation(booking.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  function handlePaymentSuccess() {
    if (pendingBookingId) {
      onConfirmation(pendingBookingId);
    }
  }

  return (
    <div style={{ backgroundColor: 'var(--p-color-background-surface)', minHeight: '100vh' }}>
      <div
        style={{
          maxWidth: '780px',
          margin: '0 auto',
          padding: `${spacingFluidLarge} ${spacingFluidMedium}`,
          display: 'flex',
          flexDirection: 'column',
          gap: spacingFluidMedium,
        }}
      >
        <div>
          <PButton variant="tertiary" icon="arrow-left" onClick={() => onNavigate('tour-detail')} compact>
            Back to Tour
          </PButton>
        </div>

        <PHeading size="x-large" tag="h1">Complete Your Booking</PHeading>

        <div
          style={{
            borderRadius: borderRadiusLarge,
            border: `${borderWidthThin} solid ${themeLightContrastLow}`,
            overflow: 'hidden',
            ...dropShadowLowStyle,
          }}
        >
          <div
            style={{
              padding: spacingStaticMedium,
              backgroundColor: 'var(--p-color-canvas)',
              display: 'flex',
              alignItems: 'center',
              gap: spacingStaticSmall,
            }}
          >
            <PIcon name="map" size="small" color="primary" />
            <PHeading size="small" tag="h2">Booking Summary</PHeading>
          </div>
          <PDivider />
          <div style={{ padding: spacingStaticMedium, display: 'flex', flexDirection: 'column', gap: spacingStaticMedium }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacingStaticMedium }}>
              <div>
                <PText size="x-small" color="contrast-medium">Tour</PText>
                <PText size="small" weight="semi-bold">{bookingSetup.tourName}</PText>
              </div>
              <div>
                <PText size="x-small" color="contrast-medium">Date & Time</PText>
                <PText size="small" weight="semi-bold">
                  {new Date(bookingSetup.tourDate + 'T00:00:00').toLocaleDateString('en-GB', {
                    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
                  })} at {formatTimeRange(bookingSetup.tourTime, bookingSetup.durationHours)}
                </PText>
              </div>
              <div>
                <PText size="x-small" color="contrast-medium">Meeting Point</PText>
                <PText size="small">{bookingSetup.meetingPoint}</PText>
              </div>
              <div>
                <PText size="x-small" color="contrast-medium">Attendees</PText>
                <PText size="small" weight="semi-bold">{bookingSetup.numAttendees} {bookingSetup.numAttendees === 1 ? 'person' : 'people'}</PText>
              </div>
            </div>

            {bookingSetup.needsBike && bookingSetup.attendeeBikes.some((a) => a.bikeId) && (
              <>
                <PDivider />
                <PText size="x-small" weight="semi-bold" color="contrast-medium">Bikes Selected</PText>
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacingStaticSmall }}>
                  {bookingSetup.attendeeBikes.map((a, i) => {
                    const bike = a.bikeId ? bikeLookup[a.bikeId] : null;
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: spacingStaticSmall }}>
                        <PTag compact>{a.label}</PTag>
                        <PText size="small">
                          {bike ? `${bike.name} -- ${bike.size}` : 'No bike selected'}
                        </PText>
                      </div>
                    );
                  })}
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
              <div>
                <PText size="small" color="contrast-medium">
                  {bookingSetup.numAttendees} x {bookingSetup.pricePerPerson.toLocaleString()} DKK
                </PText>
              </div>
              <PHeading size="medium">{totalPrice.toLocaleString()} DKK</PHeading>
            </div>
          </div>
        </div>

        {paymentStep && pendingBookingId ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacingFluidSmall }}>
            <PaymentForm
              bookingId={pendingBookingId}
              bookingType="tour"
              amount={totalPrice}
              customerName={name}
              onSuccess={handlePaymentSuccess}
              onError={(msg) => setError(msg)}
            />
            {error && (
              <PInlineNotification state="error" heading="Payment Error" description={error} dismissButton={false} />
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: spacingFluidSmall }}>
            <PHeading size="medium" tag="h2">Your Details</PHeading>

            <PInputText
              label="Full Name"
              name="name"
              value={name}
              onInput={(e) => setName((e.target as HTMLInputElement).value)}
              required
            />

            <PInputEmail
              label="Email"
              name="email"
              value={email}
              onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
              required
            />

            <PInputText
              label="Phone (optional)"
              name="phone"
              value={phone}
              onInput={(e) => setPhone((e.target as HTMLInputElement).value)}
            />

            <PTextarea
              label="Special Requests (optional)"
              name="notes"
              value={notes}
              onInput={(e) => setNotes((e.target as HTMLTextAreaElement).value)}
            />

            <PDivider />

            {EPAY_ENABLED && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacingStaticSmall, marginBottom: spacingStaticSmall }}>
                  <PIcon name="card" size="small" color="primary" />
                  <PText size="small" weight="semi-bold">Payment Method</PText>
                </div>
                <PaymentMethodSelector value={paymentMethod} onChange={setPaymentMethod} />
              </div>
            )}

            {error && (
              <PInlineNotification state="error" heading="Booking Error" description={error} dismissButton={false} />
            )}

            <div style={{ display: 'flex', gap: spacingFluidSmall, justifyContent: 'flex-end', marginTop: spacingStaticSmall }}>
              <PButton variant="secondary" onClick={() => onNavigate('tour-detail')}>Back</PButton>
              <PButton
                type="submit"
                loading={submitting}
                icon={EPAY_ENABLED && paymentMethod === 'card_online' ? 'lock' : 'check'}
              >
                {EPAY_ENABLED && paymentMethod === 'card_online' ? 'Proceed to Payment' : 'Confirm Booking'}
              </PButton>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
