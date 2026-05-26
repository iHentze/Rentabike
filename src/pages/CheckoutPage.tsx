import { useState } from 'react';
import {
  PHeading,
  PText,
  PButton,
  PButtonPure,
  PDivider,
  PInlineNotification,
  PIcon,
  PInputText,
  PInputEmail,
  PInputTel,
  PTextarea,
  PTag,
  PFieldset,
  PAccordion,
  PPopover,
} from '@porsche-design-system/components-react';
import type { AccordionUpdateEventDetail } from '@porsche-design-system/components-react';
import {
  frostedGlassStyle,
  dropShadowHighStyle,
  spacingFluidSmall,
  spacingFluidMedium,
  spacingStaticSmall,
  spacingStaticMedium,
  borderRadiusMedium,
  borderRadiusLarge,
  motionDurationModerate,
  motionEasingIn,
  getMediaQueryMin,
} from '@porsche-design-system/components-react/styles';
import { supabase } from '../lib/supabase';
import { useCart } from '../store/cartStore';
import { useLocations } from '../hooks/useLocations';
import { BookingStepper } from '../components/BookingStepper';
import { FixedBottomBar } from '../components/FixedBottomBar';
import { PaymentForm } from '../components/PaymentForm';
import { PaymentMethodSelector } from '../components/PaymentMethodSelector';
import { computeRentalDuration, formatDuration } from '../utils/rentalDuration';
import type { Page, PaymentMethod } from '../types';
import type { IconName } from '@porsche-design-system/components-react';

const EPAY_ENABLED = import.meta.env.VITE_EPAY_ENABLED === 'true';

interface CheckoutPageProps {
  onNavigate: (page: Page) => void;
  onConfirmation: (bookingId: string) => void;
}

interface FormData {
  name: string;
  email: string;
  phone: string;
  notes: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
}

const CATEGORY_ICONS: Record<string, string> = {
  'e-bikes': 'flash',
  'mountain-bikes': 'country-road',
  'road-bikes': 'highway',
  'gravel-bikes': 'country-road',
  'children-bikes': 'user',
  'accessories': 'attachment',
};

const responsiveStyles = `
  ${getMediaQueryMin('s')} {
    .checkout-two-col { grid-template-columns: 1fr 380px !important; }
  }
`;

export function CheckoutPage({ onNavigate, onConfirmation }: CheckoutPageProps) {
  const {
    items,
    startDate,
    endDate,
    startTime,
    endTime,
    startAt,
    endAt,
    pickupLocation,
    dropoffLocation,
    persons,
    rentalDays,
    totalPrice,
    clearCart,
    removeItem,
    updateQuantity,
    setCurrentPersonIndex,
  } = useCart();

  const { locations: dbLocations } = useLocations();
  const locationNameBySlug = Object.fromEntries(dbLocations.map((l) => [l.slug, l.name]));

  const [form, setForm] = useState<FormData>({ name: '', email: '', phone: '', notes: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(EPAY_ENABLED ? 'card_online' : 'at_pickup');
  const [paymentStep, setPaymentStep] = useState(false);
  const [pendingBookingId, setPendingBookingId] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);

  function validate(): boolean {
    const e: FormErrors = {};
    if (!form.name.trim()) e.name = 'Please enter your full name.';
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = 'Please enter a valid email address.';
    if (!form.phone.trim()) e.phone = 'Please enter a phone number.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleEditPerson(personIndex: number) {
    setCurrentPersonIndex(personIndex);
    onNavigate('person-catalog');
  }

  function handleRemoveItem(bikeId: string, personIndex?: number) {
    removeItem(bikeId, personIndex);
  }

  function handleAccessoryQty(bikeId: string, currentQty: number, delta: number, personIndex?: number) {
    const newQty = currentQty + delta;
    updateQuantity(bikeId, newQty, personIndex);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const missingBike = persons.some((p, idx) => {
      if (p.accessoriesOnly) return false;
      return !items.some((i) => i.personIndex === idx && i.bike.category?.slug !== 'accessories');
    });
    if (missingBike) {
      setSubmitError('Each person must have a bike selected before confirming.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      const pickupLabel = locationNameBySlug[pickupLocation] || pickupLocation;
      const dropoffLabel = locationNameBySlug[dropoffLocation] || dropoffLocation;
      const isCardPayment = paymentMethod === 'card_online';

      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          customer_name: form.name,
          customer_email: form.email,
          customer_phone: form.phone,
          start_date: startDate,
          end_date: endDate,
          pickup_time: startTime,
          dropoff_time: endTime,
          start_at: startAt,
          end_at: endAt,
          total_price: totalPrice,
          status: isCardPayment ? 'pending' : 'confirmed',
          notes: form.notes,
          pickup_location: pickupLabel,
          dropoff_location: dropoffLabel,
          payment_method: paymentMethod,
          payment_status: 'none',
        })
        .select()
        .single();

      if (bookingError || !booking) throw new Error(bookingError?.message || 'Failed to create booking');

      let personIdMap: Record<number, string> = {};

      if (persons.length > 0) {
        const personRows = persons.map((p, idx) => ({
          booking_id: booking.id,
          person_label: p.name,
          sort_order: idx,
        }));

        const { data: savedPersons, error: personsError } = await supabase
          .from('booking_persons')
          .insert(personRows)
          .select();

        if (personsError || !savedPersons)
          throw new Error(personsError?.message || 'Failed to save persons');

        savedPersons.forEach((p: { id: string; sort_order: number }) => {
          personIdMap[p.sort_order] = p.id;
        });
      }

      const bookingItems = items.map((item) => ({
        booking_id: booking.id,
        bike_id: item.bike.id,
        quantity: item.quantity,
        price_per_day: item.bike.price_per_day,
        person_id:
          item.personIndex !== undefined && personIdMap[item.personIndex]
            ? personIdMap[item.personIndex]
            : null,
      }));

      const { error: itemsError } = await supabase.from('booking_items').insert(bookingItems);
      if (itemsError) throw new Error(itemsError.message);

      if (isCardPayment) {
        setPendingBookingId(booking.id);
        setPaymentStep(true);
      } else {
        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-confirmation`;
        fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ booking_id: booking.id }),
        }).catch(() => {});

        clearCart();
        onConfirmation(booking.id);
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'An error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function handlePaymentSuccess() {
    if (pendingBookingId) {
      clearCart();
      onConfirmation(pendingBookingId);
    }
  }

  function handlePaymentError(msg: string) {
    setSubmitError(msg);
  }

  if (items.length === 0 && !submitting) {
    return (
      <div style={{ maxWidth: '600px', margin: '80px auto', textAlign: 'center', padding: `0 ${spacingFluidMedium}` }}>
        <PIcon name="heart" size="x-large" color="contrast-low" />
        <PHeading size="large" tag="h1" style={{ marginTop: spacingStaticMedium, marginBottom: spacingStaticSmall }}>
          Your cart is empty
        </PHeading>
        <PText color="contrast-medium" style={{ marginBottom: spacingFluidSmall }}>
          Start a new booking to select bikes and accessories.
        </PText>
        <PButton onClick={() => onNavigate('booking-setup')}>Start Booking</PButton>
      </div>
    );
  }

  const itemCount = items.reduce((s, i) => s + i.quantity, 0);
  const formValid = form.name.trim() && form.email.trim() && form.phone.trim();

  return (
    <div>
      <style>{responsiveStyles}</style>

      <div
        style={{
          backgroundColor: 'var(--p-color-background-surface)',
          borderBottom: '1px solid var(--p-color-contrast-low)',
        }}
      >
        <div
          style={{
            maxWidth: '1100px',
            margin: '0 auto',
            padding: `${spacingFluidSmall} ${spacingFluidMedium}`,
          }}
        >
          <BookingStepper currentStep={2} onNavigate={onNavigate} />
        </div>
      </div>

      <div
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
          padding: `${spacingFluidMedium} ${spacingFluidMedium}`,
          paddingBottom: '120px',
        }}
      >
        <PHeading size="large" tag="h1" style={{ marginBottom: spacingStaticSmall }}>
          Review & Confirm
        </PHeading>
        <PText size="small" color="contrast-medium" style={{ marginBottom: spacingFluidMedium }}>
          Check your order, fill in your details, then confirm.
        </PText>

        <div
          className="checkout-two-col"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: spacingFluidMedium,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacingFluidMedium }}>
            <OrderSummarySection
              items={items}
              persons={persons}
              startDate={startDate}
              endDate={endDate}
              startTime={startTime}
              endTime={endTime}
              startAt={startAt}
              endAt={endAt}
              pickupLocation={pickupLocation}
              dropoffLocation={dropoffLocation}
              locationNameBySlug={locationNameBySlug}
              rentalDays={rentalDays}
              totalPrice={totalPrice}
              onNavigate={onNavigate}
              onEditPerson={handleEditPerson}
              onRemoveItem={handleRemoveItem}
              onAccessoryQty={handleAccessoryQty}
            />

            {paymentStep && pendingBookingId ? (
              <div
                style={{
                  animation: `slideIn ${motionDurationModerate} ${motionEasingIn} both`,
                }}
              >
                <ContactSummaryStrip name={form.name} email={form.email} />
                <div style={{ marginTop: spacingStaticSmall }}>
                  <PaymentForm
                    bookingId={pendingBookingId}
                    bookingType="rental"
                    amount={totalPrice}
                    customerName={form.name}
                    onSuccess={handlePaymentSuccess}
                    onError={handlePaymentError}
                  />
                </div>
                {submitError && (
                  <PInlineNotification
                    state="error"
                    heading="Payment Error"
                    description={submitError}
                    dismissButton={false}
                    style={{ marginTop: spacingStaticSmall }}
                  />
                )}
              </div>
            ) : (
              <ContactFormSection
                form={form}
                errors={errors}
                submitError={submitError}
                paymentMethod={paymentMethod}
                notesOpen={notesOpen}
                onNotesToggle={setNotesOpen}
                onPaymentMethodChange={setPaymentMethod}
                onFormChange={setForm}
                onSubmit={handleSubmit}
              />
            )}
          </div>

          <PriceSidebar
            persons={persons}
            items={items}
            rentalDays={rentalDays}
            totalPrice={totalPrice}
            paymentMethod={paymentMethod}
          />
        </div>
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
              maxWidth: '1100px',
              margin: '0 auto',
              padding: `${spacingFluidSmall} ${spacingFluidMedium}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: spacingStaticMedium,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: spacingStaticSmall }}>
              <PText size="medium" weight="semi-bold" style={{ whiteSpace: 'nowrap' }}>
                {totalPrice.toLocaleString()} DKK
              </PText>
              <PText size="x-small" color="contrast-medium" style={{ whiteSpace: 'nowrap' }}>
                {itemCount} {itemCount === 1 ? 'item' : 'items'}
                {persons.length > 1 ? ` · ${persons.length} people` : ''}
              </PText>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: spacingStaticSmall, flexShrink: 0 }}>
              {paymentStep ? (
                <PButtonPure
                  icon="arrow-left"
                  size="small"
                  onClick={() => setPaymentStep(false)}
                >
                  Back to details
                </PButtonPure>
              ) : (
                <>
                  <PButton variant="secondary" compact onClick={() => onNavigate('person-catalog')}>
                    Back
                  </PButton>
                  <PButton
                    compact
                    loading={submitting}
                    disabled={submitting || !formValid}
                    icon={EPAY_ENABLED && paymentMethod === 'card_online' ? 'lock' : 'check'}
                    onClick={() => {
                      const formEl = document.getElementById('checkout-form') as HTMLFormElement | null;
                      if (formEl) formEl.requestSubmit();
                    }}
                  >
                    {submitting
                      ? 'Processing...'
                      : EPAY_ENABLED && paymentMethod === 'card_online'
                        ? 'Proceed to Payment'
                        : 'Confirm Booking'}
                  </PButton>
                </>
              )}
            </div>
          </div>
        </div>
      </FixedBottomBar>
    </div>
  );
}

function ContactSummaryStrip({ name, email }: { name: string; email: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacingStaticSmall,
        padding: `${spacingStaticSmall} ${spacingStaticMedium}`,
        borderRadius: borderRadiusMedium,
        backgroundColor: 'var(--p-color-background-surface)',
        border: '1px solid var(--p-color-contrast-low)',
      }}
    >
      <PIcon name="user" size="small" color="contrast-medium" />
      <PText size="small" weight="semi-bold">{name}</PText>
      <PText size="x-small" color="contrast-medium">{email}</PText>
    </div>
  );
}

interface OrderSummarySectionProps {
  items: ReturnType<typeof useCart>['items'];
  persons: ReturnType<typeof useCart>['persons'];
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  startAt: string;
  endAt: string;
  pickupLocation: string;
  dropoffLocation: string;
  locationNameBySlug: Record<string, string>;
  rentalDays: number;
  totalPrice: number;
  onNavigate: (page: Page) => void;
  onEditPerson: (idx: number) => void;
  onRemoveItem: (bikeId: string, personIndex?: number) => void;
  onAccessoryQty: (bikeId: string, qty: number, delta: number, personIndex?: number) => void;
}

function OrderSummarySection({
  items, persons, startDate, endDate, startTime, endTime, startAt, endAt,
  pickupLocation, dropoffLocation, locationNameBySlug, rentalDays, totalPrice,
  onNavigate, onEditPerson, onRemoveItem, onAccessoryQty,
}: OrderSummarySectionProps) {
  return (
    <div
      style={{
        border: '1px solid var(--p-color-contrast-low)',
        borderRadius: borderRadiusLarge,
        overflow: 'hidden',
        animation: `staggerFadeIn ${motionDurationModerate} ${motionEasingIn} both`,
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--p-color-background-surface)',
          padding: `${spacingStaticSmall} ${spacingStaticMedium}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: spacingStaticSmall,
        }}
      >
        <PHeading size="small" tag="h2">Order Summary</PHeading>
        <PButtonPure icon="edit" size="small" onClick={() => onNavigate('booking-setup')}>
          Change Dates
        </PButtonPure>
      </div>
      <PDivider />

      <div style={{ padding: spacingStaticMedium }}>
        <div style={{ display: 'flex', gap: spacingStaticSmall, flexWrap: 'wrap', marginBottom: spacingStaticMedium }}>
          <PTag compact color="notification-info-soft" icon="calendar">
            {startDate && new Date(startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            {startTime ? ` ${startTime}` : ''}
            {' - '}
            {endDate && new Date(endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            {endTime ? ` ${endTime}` : ''}
          </PTag>
          <PTag compact color="notification-info-soft" icon="clock">
            {formatDuration(computeRentalDuration(startAt, endAt))}
          </PTag>
          <PTag compact icon="arrow-head-down">
            {locationNameBySlug[pickupLocation] || pickupLocation}
          </PTag>
          {dropoffLocation !== pickupLocation && (
            <PTag compact icon="arrow-head-up">
              {locationNameBySlug[dropoffLocation] || dropoffLocation}
            </PTag>
          )}
        </div>

        <PDivider />

        <div style={{ display: 'flex', flexDirection: 'column', gap: spacingStaticSmall, marginTop: spacingStaticMedium }}>
          {persons.length > 0 ? (
            persons.map((person, idx) => (
              <PersonItemGroup
                key={idx}
                person={person}
                personIndex={idx}
                items={items}
                rentalDays={rentalDays}
                onEdit={() => onEditPerson(idx)}
                onRemoveItem={onRemoveItem}
                onAccessoryQty={onAccessoryQty}
              />
            ))
          ) : (
            items.map((item) => (
              <ItemRow
                key={item.bike.id}
                item={item}
                rentalDays={rentalDays}
                onRemove={() => onRemoveItem(item.bike.id, item.personIndex)}
              />
            ))
          )}
        </div>

        <PDivider style={{ marginTop: spacingStaticMedium }} />

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: spacingStaticMedium,
          }}
        >
          <PText weight="semi-bold">Total</PText>
          <PHeading size="medium">{totalPrice.toLocaleString()} DKK</PHeading>
        </div>
      </div>
    </div>
  );
}

interface PersonItemGroupProps {
  person: { name: string; accessoriesOnly: boolean };
  personIndex: number;
  items: ReturnType<typeof useCart>['items'];
  rentalDays: number;
  onEdit: () => void;
  onRemoveItem: (bikeId: string, personIndex?: number) => void;
  onAccessoryQty: (bikeId: string, qty: number, delta: number, personIndex?: number) => void;
}

function PersonItemGroup({
  person, personIndex, items, rentalDays,
  onEdit, onRemoveItem, onAccessoryQty,
}: PersonItemGroupProps) {
  const pItems = items.filter((i) => i.personIndex === personIndex);
  const subtotal = pItems.reduce((s, i) => s + i.bike.price_per_day * i.quantity * rentalDays, 0);
  const personBike = pItems.find((i) => i.bike.category?.slug !== 'accessories');
  const accessories = pItems.filter((i) => i.bike.category?.slug === 'accessories');
  const hasItems = pItems.length > 0;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: spacingStaticSmall,
          marginBottom: '4px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: spacingStaticSmall }}>
          <PIcon
            name={hasItems ? 'check' : 'exclamation'}
            size="x-small"
            color={hasItems ? 'notification-success' : 'notification-warning'}
          />
          <PText size="small" weight="semi-bold">{person.name}</PText>
          {person.accessoriesOnly && (
            <PTag color="notification-info-soft" compact icon="attachment">Accessories only</PTag>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacingStaticSmall }}>
          {rentalDays > 0 && subtotal > 0 && (
            <PText size="small" weight="semi-bold">{subtotal.toLocaleString()} DKK</PText>
          )}
          <PButtonPure icon="edit" size="small" onClick={onEdit}>Edit</PButtonPure>
        </div>
      </div>

      {pItems.length === 0 ? (
        <div style={{ paddingLeft: '20px' }}>
          <PText size="x-small" color="contrast-medium">No items selected</PText>
        </div>
      ) : (
        <div style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {personBike && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: spacingStaticSmall }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacingStaticSmall }}>
                <PIcon
                  name={(CATEGORY_ICONS[personBike.bike.category?.slug || ''] || 'configurate') as IconName}
                  size="x-small"
                  color="contrast-medium"
                />
                <PText size="small">{personBike.bike.name}</PText>
                {personBike.bike.size && (
                  <PText size="x-small" color="contrast-medium">({personBike.bike.size})</PText>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacingStaticSmall }}>
                {rentalDays > 0 && (
                  <PText size="x-small" color="contrast-medium">
                    {(personBike.bike.price_per_day * rentalDays).toLocaleString()} DKK
                  </PText>
                )}
                <PButtonPure
                  icon="close"
                  size="small"
                  aria={{ 'aria-label': `Remove ${personBike.bike.name}` }}
                  onClick={() => onRemoveItem(personBike.bike.id, personIndex)}
                />
              </div>
            </div>
          )}

          {accessories.map((item) => (
            <div
              key={item.bike.id}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: spacingStaticSmall }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: spacingStaticSmall }}>
                <PIcon name="attachment" size="x-small" color="contrast-medium" />
                <PText size="x-small">{item.bike.name}</PText>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                <PButton
                  icon="minus"
                  compact
                  variant="secondary"
                  onClick={() => onAccessoryQty(item.bike.id, item.quantity, -1, personIndex)}
                  aria={{ 'aria-label': `Decrease ${item.bike.name}` }}
                />
                <div
                  style={{
                    minWidth: '24px',
                    textAlign: 'center',
                    fontFamily: "'Porsche Next','Arial Narrow',Arial,sans-serif",
                    fontWeight: 600,
                    fontSize: '13px',
                  }}
                >
                  {item.quantity}
                </div>
                <PButton
                  icon="add"
                  compact
                  variant="secondary"
                  onClick={() => onAccessoryQty(item.bike.id, item.quantity, 1, personIndex)}
                  aria={{ 'aria-label': `Increase ${item.bike.name}` }}
                />
                {rentalDays > 0 && (
                  <PText size="x-small" weight="semi-bold" style={{ minWidth: '60px', textAlign: 'right' }}>
                    {(item.bike.price_per_day * item.quantity * rentalDays).toLocaleString()} DKK
                  </PText>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {personIndex < items.filter((i) => i.personIndex !== undefined).length && (
        <PDivider style={{ marginTop: spacingStaticSmall }} />
      )}
    </div>
  );
}

function ItemRow({
  item,
  rentalDays,
  onRemove,
}: {
  item: ReturnType<typeof useCart>['items'][0];
  rentalDays: number;
  onRemove: () => void;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: spacingStaticSmall }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacingStaticSmall }}>
        <PIcon
          name={(CATEGORY_ICONS[item.bike.category?.slug || ''] || 'configurate') as IconName}
          size="x-small"
          color="contrast-medium"
        />
        <div>
          <PText size="small" weight="semi-bold">{item.bike.name}</PText>
          <PText size="x-small" color="contrast-medium">
            {item.quantity}x {item.bike.price_per_day} DKK/day
          </PText>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacingStaticSmall }}>
        <PText size="small" weight="semi-bold">
          {(item.bike.price_per_day * item.quantity * rentalDays).toLocaleString()} DKK
        </PText>
        <PButtonPure
          icon="close"
          size="small"
          aria={{ 'aria-label': `Remove ${item.bike.name}` }}
          onClick={onRemove}
        />
      </div>
    </div>
  );
}

interface ContactFormSectionProps {
  form: FormData;
  errors: FormErrors;
  submitError: string;
  paymentMethod: PaymentMethod;
  notesOpen: boolean;
  onNotesToggle: (open: boolean) => void;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  onFormChange: React.Dispatch<React.SetStateAction<FormData>>;
  onSubmit: (e: React.FormEvent) => void;
}

function ContactFormSection({
  form, errors, submitError, paymentMethod,
  notesOpen, onNotesToggle,
  onPaymentMethodChange, onFormChange, onSubmit,
}: ContactFormSectionProps) {
  return (
    <div
      style={{
        border: '1px solid var(--p-color-contrast-low)',
        borderRadius: borderRadiusLarge,
        overflow: 'hidden',
        animation: `staggerFadeIn ${motionDurationModerate} ${motionEasingIn} both`,
        animationDelay: '80ms',
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
        <PIcon name="user" size="small" color="primary" />
        <PHeading size="small" tag="h2">Your Details</PHeading>
      </div>
      <PDivider />

      <form
        id="checkout-form"
        onSubmit={onSubmit}
        style={{ padding: spacingStaticMedium, display: 'flex', flexDirection: 'column', gap: spacingStaticMedium }}
      >
        <PFieldset label="Contact Information" labelSize="small">
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacingStaticSmall }}>
            <PInputText
              label="Full Name"
              name="name"
              value={form.name}
              required
              state={errors.name ? 'error' : 'none'}
              message={errors.name}
              onInput={(e) => onFormChange((f) => ({ ...f, name: (e.target as HTMLInputElement).value }))}
            />
            <PInputEmail
              label="Email Address"
              name="email"
              value={form.email}
              required
              state={errors.email ? 'error' : 'none'}
              message={errors.email}
              onInput={(e) => onFormChange((f) => ({ ...f, email: (e.target as HTMLInputElement).value }))}
            />
            <PInputTel
              label="Phone Number"
              name="phone"
              value={form.phone}
              required
              state={errors.phone ? 'error' : 'none'}
              message={errors.phone}
              onInput={(e) => onFormChange((f) => ({ ...f, phone: (e.target as HTMLInputElement).value }))}
            />
          </div>
        </PFieldset>

        <PAccordion
          heading="Add special requests (optional)"
          headingTag="h3"
          size="small"
          compact
          open={notesOpen}
          onUpdate={(e: CustomEvent<AccordionUpdateEventDetail>) => onNotesToggle(e.detail.open)}
        >
          <PTextarea
            label="Special Requests"
            name="notes"
            value={form.notes}
            onInput={(e) => onFormChange((f) => ({ ...f, notes: (e.target as HTMLTextAreaElement).value }))}
          />
        </PAccordion>

        <PDivider />

        {EPAY_ENABLED && (
          <PaymentMethodSelector value={paymentMethod} onChange={onPaymentMethodChange} />
        )}

        {submitError && (
          <PInlineNotification
            state="error"
            heading="Booking Failed"
            description={submitError}
            dismissButton={false}
          />
        )}
      </form>
    </div>
  );
}

interface PriceSidebarProps {
  persons: ReturnType<typeof useCart>['persons'];
  items: ReturnType<typeof useCart>['items'];
  rentalDays: number;
  totalPrice: number;
  paymentMethod: PaymentMethod;
}

function PriceSidebar({ persons, items, rentalDays, totalPrice, paymentMethod }: PriceSidebarProps) {
  const infoItems = [
    EPAY_ENABLED && paymentMethod === 'card_online'
      ? 'Secure online payment or pay at pick-up.'
      : 'No online payment required -- pay at pick-up.',
    'Free cancellation up to 24 hours before pick-up.',
    'Helmets and locks included with every bike.',
    'Confirmation sent to your email instantly.',
  ];

  return (
    <div
      style={{
        alignSelf: 'start',
        position: 'sticky',
        top: spacingFluidMedium,
        display: 'flex',
        flexDirection: 'column',
        gap: spacingStaticMedium,
      }}
    >
      <div
        style={{
          border: '1px solid var(--p-color-contrast-low)',
          borderRadius: borderRadiusLarge,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--p-color-background-surface)',
            padding: `${spacingStaticSmall} ${spacingStaticMedium}`,
          }}
        >
          <PHeading size="small" tag="h3">Price Breakdown</PHeading>
        </div>
        <PDivider />

        <div style={{ padding: spacingStaticMedium, display: 'flex', flexDirection: 'column', gap: spacingStaticSmall }}>
          {persons.length > 0 ? (
            persons.map((person, idx) => {
              const pItems = items.filter((i) => i.personIndex === idx);
              const subtotal = pItems.reduce((s, i) => s + i.bike.price_per_day * i.quantity * rentalDays, 0);
              return (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <PText size="x-small">{person.name}</PText>
                  <PText size="x-small" weight="semi-bold">{subtotal.toLocaleString()} DKK</PText>
                </div>
              );
            })
          ) : (
            items.map((item) => (
              <div key={item.bike.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <PText size="x-small">{item.bike.name} x{item.quantity}</PText>
                <PText size="x-small" weight="semi-bold">
                  {(item.bike.price_per_day * item.quantity * rentalDays).toLocaleString()} DKK
                </PText>
              </div>
            ))
          )}

          <PDivider />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <PText weight="semi-bold">Total</PText>
            <PHeading size="medium">{totalPrice.toLocaleString()} DKK</PHeading>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {infoItems.map((text, i) => (
          <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
            <PIcon name="check" size="x-small" color="notification-success" style={{ marginTop: '1px', flexShrink: 0 }} />
            <PText size="xx-small" color="contrast-medium">{text}</PText>
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacingStaticSmall,
          padding: `${spacingStaticSmall} ${spacingStaticMedium}`,
          borderRadius: borderRadiusMedium,
          backgroundColor: 'var(--p-color-background-surface)',
        }}
      >
        <PIcon name="lock" size="x-small" color="contrast-medium" />
        <PText size="xx-small" color="contrast-medium">Secure checkout</PText>
        <PPopover description="Your payment details are encrypted and secure. We never store card information on our servers." />
      </div>
    </div>
  );
}
