import { useState, useRef, useEffect } from 'react';
import {
  PDisplay,
  PText,
  PButton,
  PInputText,
  PInputNumber,
  PSelect,
  PSelectOption,
  PIcon,
  PTag,
  PInlineNotification,
  PSwitch,
  PDivider,
} from '@porsche-design-system/components-react';
import {
  frostedGlassStyle,
  spacingFluidMedium,
  spacingFluidSmall,
  spacingFluidLarge,
  spacingStaticSmall,
  spacingStaticMedium,
  borderRadiusMedium,
  borderWidthThin,
  dropShadowHighStyle,
  dropShadowLowStyle,
  motionDurationShort,
  motionDurationModerate,
  motionEasingBase,
  motionEasingIn,
  themeLightBackgroundSurface,
  themeLightContrastLow,
  themeLightPrimary,
  themeLightBackgroundBase,
  borderRadiusSmall,
} from '@porsche-design-system/components-react/styles';
import { useCart } from '../store/cartStore';
import { BookingFormCard } from '../components/BookingFormCard';
import { BookingStepper } from '../components/BookingStepper';
import { CalendarPicker } from '../components/CalendarPicker';
import { FixedBottomBar } from '../components/FixedBottomBar';
import { useLocations } from '../hooks/useLocations';
import { buildDatetime, computeRentalDays, computeRentalDuration, formatDuration } from '../utils/rentalDuration';
import type { Page, BookingPersonSetup } from '../types';

interface BookingSetupPageProps {
  onNavigate: (page: Page) => void;
}

const MAX_PERSONS = 10;
const MIN_HOUR = 8;
const MAX_HOUR = 18;

const stepperBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '36px',
  height: '36px',
  border: 'none',
  borderRadius: borderRadiusSmall,
  backgroundColor: 'transparent',
  cursor: 'pointer',
  flexShrink: 0,
  transition: `background-color ${motionDurationShort} ${motionEasingBase}`,
};

const stepperBtnDisabledStyle: React.CSSProperties = {
  ...stepperBtnStyle,
  opacity: 0.3,
  cursor: 'not-allowed',
};

const timeInputStyle: React.CSSProperties = {
  width: '40px',
  border: 'none',
  background: 'transparent',
  textAlign: 'right',
  fontFamily: "'Porsche Next','Arial Narrow',Arial,sans-serif",
  fontWeight: 600,
  fontSize: '16px',
  lineHeight: 'calc(6px + 2.125ex)',
  color: themeLightPrimary,
  outline: 'none',
  MozAppearance: 'textfield',
};

const timeSuffixStyle: React.CSSProperties = {
  fontFamily: "'Porsche Next','Arial Narrow',Arial,sans-serif",
  fontWeight: 600,
  fontSize: '16px',
  lineHeight: 'calc(6px + 2.125ex)',
  color: themeLightPrimary,
  flex: 1,
};

function padHour(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

function parseHour(time: string): number {
  const h = parseInt(time.split(':')[0], 10);
  return isNaN(h) ? 9 : h;
}

function stepHour(current: string, delta: number): string {
  const h = Math.max(MIN_HOUR, Math.min(MAX_HOUR, parseHour(current) + delta));
  return padHour(h);
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

export function BookingSetupPage({ onNavigate }: BookingSetupPageProps) {
  const cart = useCart();
  const { setDates, setTimes, setLocations, setPersons, startDate, endDate, startTime, endTime } = cart;
  const { locations: dbLocations } = useLocations();
  const locationOptions = dbLocations.map((loc) => ({ value: loc.slug, label: loc.name, pickup_fee: loc.pickup_fee, dropoff_fee: loc.dropoff_fee }));

  const [localStart, setLocalStart] = useState(startDate || '');
  const [localEnd, setLocalEnd] = useState(endDate || '');
  const [localStartTime, setLocalStartTime] = useState(padHour(parseHour(startTime || '09:00')));
  const [localEndTime, setLocalEndTime] = useState(padHour(parseHour(endTime || '09:00')));
  const [pickupLocation, setPickupLocation] = useState(cart.pickupLocation || 'torshavn');
  const [dropoffLocation, setDropoffLocation] = useState(cart.dropoffLocation || 'torshavn');
  const [personCount, setPersonCount] = useState(cart.persons.length || 1);
  const [personSetups, setPersonSetups] = useState<BookingPersonSetup[]>(
    cart.persons.length > 0 ? cart.persons : [{ name: '', accessoriesOnly: false }]
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showStickyBar, setShowStickyBar] = useState(false);

  const inlineCtaRef = useRef<HTMLDivElement>(null);

  const today = new Date().toISOString().split('T')[0];

  const localStartAt = localStart && localStartTime ? buildDatetime(localStart, localStartTime) : '';
  const localEndAt = localEnd && localEndTime ? buildDatetime(localEnd, localEndTime) : '';
  const rentalDays = computeRentalDays(localStartAt, localEndAt);
  const rentalDuration = computeRentalDuration(localStartAt, localEndAt);
  const sameDayTimeError = localStart && localEnd && localStart === localEnd && localStartAt && localEndAt && rentalDays <= 0
    ? 'Return time must be after pick-up time for same-day rentals.'
    : '';
  const invalidDateOrder = localStart && localEnd && localStart > localEnd
    ? 'Return date must be after pick-up date.'
    : '';

  useEffect(() => {
    const el = inlineCtaRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyBar(!entry.isIntersecting),
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function setPersonCountTo(count: number) {
    const newCount = Math.max(1, Math.min(MAX_PERSONS, count));
    setPersonCount(newCount);
    setPersonSetups((prev) => {
      if (newCount > prev.length) {
        return [
          ...prev,
          ...Array.from({ length: newCount - prev.length }, () => ({
            name: '',
            accessoriesOnly: false,
          })),
        ];
      }
      return prev.slice(0, newCount);
    });
  }

  function updatePerson(idx: number, updates: Partial<BookingPersonSetup>) {
    setPersonSetups((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, ...updates } : p))
    );
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!localStart) e.startDate = 'Please select a pick-up date.';
    if (!localEnd) e.endDate = 'Please select a return date.';
    if (localStart && localEnd && rentalDays <= 0) {
      if (localStart === localEnd) {
        e.endDate = 'Return time must be after pick-up time for same-day rentals.';
      } else {
        e.endDate = 'Return date must be after pick-up date.';
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleContinue() {
    if (!validate()) return;
    setDates(localStart, localEnd);
    setTimes(localStartTime, localEndTime);
    setLocations(pickupLocation, dropoffLocation);
    setPersons(personSetups.map((p, idx) => ({
      ...p,
      name: p.name.trim() || `Person ${idx + 1}`,
    })));
    onNavigate('person-catalog');
  }

  return (
    <div style={{ backgroundColor: 'var(--p-color-background-surface)', minHeight: '100vh' }}>
      <div
        style={{
          position: 'relative',
          minHeight: 'clamp(260px, 30vw, 340px)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'url(/booking-hero.webp)',
            backgroundSize: 'cover',
            backgroundPosition: 'center 40%',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.55) 60%, rgba(0,0,0,0.75) 100%)',
          }}
        />

        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '780px',
            margin: '0 auto',
            padding: `${spacingFluidLarge} ${spacingFluidMedium} 0`,
          }}
        >
          <PTag
            theme="dark"
            color="background-frosted"
            icon="configurate"
            style={{ marginBottom: spacingFluidSmall }}
          >
            Step 1 of 3
          </PTag>
          <PDisplay
            size={{ base: 'small', m: 'medium' }}
            theme="dark"
            tag="h1"
            style={{ marginBottom: '8px', display: 'block' }}
          >
            Plan Your Rental
          </PDisplay>
          <PText
            size="medium"
            theme="dark"
            style={{ display: 'block', maxWidth: '520px', marginBottom: spacingFluidMedium }}
          >
            Tell us who's riding and when — we'll guide each person through their selection.
          </PText>
        </div>

        <div
          style={{
            position: 'relative',
            ...frostedGlassStyle,
            borderTop: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          <div
            style={{
              maxWidth: '780px',
              margin: '0 auto',
              padding: `${spacingFluidSmall} ${spacingFluidMedium}`,
            }}
          >
            <BookingStepper currentStep={0} onNavigate={onNavigate} theme="dark" />
          </div>
        </div>
      </div>

      <div
        style={{
          maxWidth: '780px',
          margin: '0 auto',
          padding: `${spacingFluidLarge} ${spacingFluidMedium}`,
          display: 'flex',
          flexDirection: 'column',
          gap: spacingFluidMedium,
          paddingBottom: showStickyBar ? '120px' : spacingFluidLarge,
        }}
      >
        <BookingFormCard icon="calendar" title="Rental Period">
          <div style={{ display: 'flex', gap: spacingFluidSmall, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ flex: '1 1 200px' }}>
              <CalendarPicker
                label="Pick-up date"
                value={localStart}
                min={today}
                state={errors.startDate ? 'error' : 'none'}
                message={errors.startDate}
                onChange={(v) => {
                  setLocalStart(v);
                  if (errors.startDate) setErrors((err) => { const n = { ...err }; delete n.startDate; return n; });
                }}
              />
            </div>
            <div style={{ flex: '1 1 200px' }}>
              <CalendarPicker
                label="Return date"
                value={localEnd}
                min={localStart || today}
                state={errors.endDate ? 'error' : 'none'}
                message={errors.endDate}
                onChange={(v) => {
                  setLocalEnd(v);
                  if (errors.endDate) setErrors((err) => { const n = { ...err }; delete n.endDate; return n; });
                }}
              />
            </div>
          </div>

          <PDivider style={{ marginTop: spacingFluidSmall, marginBottom: spacingFluidSmall }} />

          <div style={{ display: 'flex', gap: spacingFluidSmall, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ flex: '1 1 200px' }}>
              <PText size="x-small" weight="semi-bold" style={{ display: 'block', marginBottom: spacingStaticSmall }}>Pick-up time</PText>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacingStaticSmall,
                  border: `${borderWidthThin} solid ${themeLightContrastLow}`,
                  borderRadius: borderRadiusMedium,
                  padding: `${spacingStaticSmall} ${spacingStaticMedium}`,
                  backgroundColor: themeLightBackgroundBase,
                }}
              >
                <button
                  type="button"
                  style={parseHour(localStartTime) <= MIN_HOUR ? stepperBtnDisabledStyle : stepperBtnStyle}
                  disabled={parseHour(localStartTime) <= MIN_HOUR}
                  onClick={() => setLocalStartTime(stepHour(localStartTime, -1))}
                  aria-label="Decrease pick-up time"
                >
                  <PIcon name="minus" size="small" />
                </button>
                <input
                  type="number"
                  min={MIN_HOUR}
                  max={MAX_HOUR}
                  value={parseHour(localStartTime)}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v)) setLocalStartTime(padHour(Math.max(MIN_HOUR, Math.min(MAX_HOUR, v))));
                  }}
                  onBlur={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (isNaN(v)) setLocalStartTime(padHour(9));
                  }}
                  style={timeInputStyle}
                  aria-label="Pick-up hour"
                />
                <span style={timeSuffixStyle}>:00</span>
                <button
                  type="button"
                  style={parseHour(localStartTime) >= MAX_HOUR ? stepperBtnDisabledStyle : stepperBtnStyle}
                  disabled={parseHour(localStartTime) >= MAX_HOUR}
                  onClick={() => setLocalStartTime(stepHour(localStartTime, 1))}
                  aria-label="Increase pick-up time"
                >
                  <PIcon name="add" size="small" />
                </button>
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                alignSelf: 'center',
                paddingTop: '28px',
              }}
            >
              <PIcon name="arrow-right" size="small" color="contrast-medium" />
            </div>
            <div style={{ flex: '1 1 200px' }}>
              <PText size="x-small" weight="semi-bold" style={{ display: 'block', marginBottom: spacingStaticSmall }}>Return time</PText>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacingStaticSmall,
                  border: `${borderWidthThin} solid ${themeLightContrastLow}`,
                  borderRadius: borderRadiusMedium,
                  padding: `${spacingStaticSmall} ${spacingStaticMedium}`,
                  backgroundColor: themeLightBackgroundBase,
                }}
              >
                <button
                  type="button"
                  style={parseHour(localEndTime) <= MIN_HOUR ? stepperBtnDisabledStyle : stepperBtnStyle}
                  disabled={parseHour(localEndTime) <= MIN_HOUR}
                  onClick={() => setLocalEndTime(stepHour(localEndTime, -1))}
                  aria-label="Decrease return time"
                >
                  <PIcon name="minus" size="small" />
                </button>
                <input
                  type="number"
                  min={MIN_HOUR}
                  max={MAX_HOUR}
                  value={parseHour(localEndTime)}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v)) setLocalEndTime(padHour(Math.max(MIN_HOUR, Math.min(MAX_HOUR, v))));
                  }}
                  onBlur={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (isNaN(v)) setLocalEndTime(padHour(9));
                  }}
                  style={timeInputStyle}
                  aria-label="Return hour"
                />
                <span style={timeSuffixStyle}>:00</span>
                <button
                  type="button"
                  style={parseHour(localEndTime) >= MAX_HOUR ? stepperBtnDisabledStyle : stepperBtnStyle}
                  disabled={parseHour(localEndTime) >= MAX_HOUR}
                  onClick={() => setLocalEndTime(stepHour(localEndTime, 1))}
                  aria-label="Increase return time"
                >
                  <PIcon name="add" size="small" />
                </button>
              </div>
            </div>
          </div>

          {(sameDayTimeError || invalidDateOrder) ? (
            <div
              style={{
                overflow: 'hidden',
                maxHeight: '80px',
                opacity: 1,
                transition: `max-height ${motionDurationShort} ${motionEasingIn}, opacity ${motionDurationShort} ${motionEasingBase}`,
                marginTop: spacingFluidSmall,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacingStaticSmall,
                  padding: '12px 16px',
                  borderRadius: borderRadiusMedium,
                  backgroundColor: 'var(--p-color-notification-error-soft)',
                }}
              >
                <PIcon name="exclamation" size="small" color="notification-error" />
                <PText size="small" weight="semi-bold" color="notification-error">
                  {sameDayTimeError || invalidDateOrder}
                </PText>
              </div>
            </div>
          ) : (
            <div
              style={{
                overflow: 'hidden',
                maxHeight: rentalDays > 0 ? '80px' : '0',
                opacity: rentalDays > 0 ? 1 : 0,
                transition: `max-height ${motionDurationShort} ${motionEasingIn}, opacity ${motionDurationShort} ${motionEasingBase}`,
                marginTop: rentalDays > 0 ? spacingFluidSmall : '0',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacingFluidSmall,
                  padding: '12px 16px',
                  borderRadius: borderRadiusMedium,
                  backgroundColor: 'var(--p-color-notification-info-soft)',
                }}
              >
                <PIcon name="clock" size="small" color="primary" />
                <PText size="small" weight="semi-bold">
                  {formatDateShort(localStart)} at {localStartTime} — {formatDateShort(localEnd)} at {localEndTime}
                </PText>
                <PTag color="notification-info-soft" compact>
                  {formatDuration(rentalDuration)}
                </PTag>
              </div>
            </div>
          )}

          <PDivider style={{ marginTop: spacingFluidSmall, marginBottom: spacingFluidSmall }} />

          <div style={{ display: 'flex', gap: spacingFluidSmall, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ flex: '1 1 200px' }}>
              <PSelect
                label="Pick-up location"
                name="pickup"
                value={pickupLocation}
                onChange={(e) => setPickupLocation(e.detail.value)}
              >
                {locationOptions.map((loc) => (
                  <PSelectOption key={loc.value} value={loc.value}>
                    {loc.pickup_fee > 0 ? `${loc.label} (+${loc.pickup_fee} DKK)` : loc.label}
                  </PSelectOption>
                ))}
              </PSelect>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                alignSelf: 'center',
                paddingTop: spacingStaticMedium,
              }}
            >
              <PIcon name="arrow-right" size="small" color="contrast-medium" />
            </div>
            <div style={{ flex: '1 1 200px' }}>
              <PSelect
                label="Drop-off location"
                name="dropoff"
                value={dropoffLocation}
                onChange={(e) => setDropoffLocation(e.detail.value)}
              >
                {locationOptions.map((loc) => (
                  <PSelectOption key={loc.value} value={loc.value}>
                    {loc.dropoff_fee > 0 ? `${loc.label} (+${loc.dropoff_fee} DKK)` : loc.label}
                  </PSelectOption>
                ))}
              </PSelect>
            </div>
          </div>

          {(() => {
            const pickupLoc = locationOptions.find((l) => l.value === pickupLocation);
            const dropoffLoc = locationOptions.find((l) => l.value === dropoffLocation);
            const pickupFee = pickupLoc?.pickup_fee || 0;
            const dropoffFee = dropoffLoc?.dropoff_fee || 0;
            const totalFee = pickupFee + dropoffFee;

            if (totalFee <= 0) return null;

            return (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacingStaticSmall,
                  padding: '10px 16px',
                  borderRadius: borderRadiusMedium,
                  backgroundColor: 'var(--p-color-notification-info-soft)',
                  marginTop: spacingFluidSmall,
                }}
              >
                <PIcon name="information" size="small" color="primary" />
                <PText size="x-small" color="primary">
                  Location fees:{' '}
                  {pickupFee > 0 && `pickup ${pickupFee} DKK`}
                  {pickupFee > 0 && dropoffFee > 0 && ' + '}
                  {dropoffFee > 0 && `drop-off ${dropoffFee} DKK`}
                  {' = '}{totalFee} DKK total
                </PText>
              </div>
            );
          })()}
        </BookingFormCard>

        <BookingFormCard icon="group" title="Who's Coming?">
          <div style={{ maxWidth: '200px' }}>
            <PInputNumber
              label="Number of people"
              name="personCount"
              value={String(personCount)}
              min={1}
              max={MAX_PERSONS}
              controls
              onInput={(e) => {
                const val = parseInt((e.target as HTMLInputElement).value, 10);
                if (!isNaN(val)) setPersonCountTo(val);
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: spacingFluidSmall, marginTop: spacingFluidSmall }}>
            {personSetups.map((person, idx) => (
              <div
                key={idx}
                style={{
                  padding: spacingStaticMedium,
                  border: `${borderWidthThin} solid ${themeLightContrastLow}`,
                  borderRadius: borderRadiusMedium,
                  backgroundColor: themeLightBackgroundBase,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: spacingStaticSmall,
                  transition: `opacity ${motionDurationModerate} ${motionEasingIn}, transform ${motionDurationModerate} ${motionEasingIn}`,
                  animation: `slideInUp ${motionDurationModerate} ${motionEasingIn} both`,
                  ...dropShadowLowStyle,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: spacingStaticSmall }}>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: themeLightBackgroundSurface,
                      color: themeLightPrimary,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      fontFamily: "'Porsche Next','Arial Narrow',Arial,sans-serif",
                      fontWeight: 600,
                      fontSize: '13px',
                    }}
                  >
                    {idx + 1}
                  </div>
                  <PText size="small" weight="semi-bold">
                    {person.name.trim() || `Person ${idx + 1}`}
                  </PText>
                  {person.accessoriesOnly && (
                    <PTag color="notification-info-soft" compact icon="attachment">Accessories only</PTag>
                  )}
                </div>

                <PInputText
                  label="Name (optional)"
                  description={`Defaults to "Person ${idx + 1}"`}
                  name={`person_name_${idx}`}
                  value={person.name}
                  placeholder={`e.g. ${['Emma', 'Liam', 'Sofia', 'Noah', 'Mia'][idx % 5]}`}
                  onInput={(e) => updatePerson(idx, { name: (e.target as HTMLInputElement).value })}
                />

                <PDivider />

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: spacingStaticMedium,
                  }}
                >
                  <div>
                    <PText size="small" weight="semi-bold">Accessories only</PText>
                    <PText size="x-small" color="contrast-medium">
                      Has their own bike — only needs helmet, bag, etc.
                    </PText>
                  </div>
                  <PSwitch
                    checked={person.accessoriesOnly}
                    hideLabel
                    onUpdate={(e) => updatePerson(idx, { accessoriesOnly: e.detail.checked })}
                  />
                </div>
              </div>
            ))}
          </div>
        </BookingFormCard>

        {Object.keys(errors).length > 0 && (
          <PInlineNotification
            state="error"
            heading="Please fix the errors above"
            description="Make sure the rental dates are valid."
            dismissButton={false}
          />
        )}

        <div ref={inlineCtaRef} style={{ display: 'flex', gap: spacingFluidSmall, justifyContent: 'flex-end' }}>
          <PButton variant="secondary" onClick={() => onNavigate('home')}>
            Back
          </PButton>
          <PButton onClick={handleContinue} icon="arrow-right">
            Continue to Equipment
          </PButton>
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
            transform: showStickyBar ? 'translateY(0)' : 'translateY(100%)',
            opacity: showStickyBar ? 1 : 0,
            transition: `transform ${motionDurationShort} ${motionEasingBase}, opacity ${motionDurationShort} ${motionEasingBase}`,
            ...frostedGlassStyle,
            borderTop: '1px solid var(--p-color-contrast-low)',
            ...dropShadowHighStyle,
          }}
        >
          <div
            style={{
              maxWidth: '780px',
              margin: '0 auto',
              padding: `${spacingFluidSmall} ${spacingFluidMedium}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: spacingFluidSmall,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: spacingStaticSmall, flexWrap: 'wrap', flex: '1 1 auto' }}>
              {(() => {
                const datesReady = !!(localStart && localEnd && !invalidDateOrder && !sameDayTimeError && rentalDays > 0);
                const peopleReady = personSetups.length > 0;
                const allReady = datesReady && peopleReady;
                const locationLabel = locationOptions.find(l => l.value === pickupLocation)?.label.split(' — ')[0] || pickupLocation;

                return (
                  <>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: borderRadiusMedium,
                        backgroundColor: datesReady
                          ? 'var(--p-color-notification-success-soft)'
                          : (invalidDateOrder || sameDayTimeError)
                            ? 'var(--p-color-notification-warning-soft)'
                            : themeLightBackgroundSurface,
                        transition: `background-color ${motionDurationShort} ${motionEasingBase}`,
                      }}
                    >
                      <PIcon
                        name={datesReady ? 'check' : 'calendar'}
                        size="x-small"
                        color={datesReady ? 'notification-success' : (invalidDateOrder || sameDayTimeError) ? 'notification-warning' : 'contrast-medium'}
                      />
                      <PText size="x-small" weight="semi-bold" style={{ whiteSpace: 'nowrap' }}>
                        {datesReady
                          ? `${formatDateShort(localStart)} – ${formatDateShort(localEnd)} (${formatDuration(rentalDuration)})`
                          : 'Select dates'}
                      </PText>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: borderRadiusMedium,
                        backgroundColor: peopleReady
                          ? 'var(--p-color-notification-success-soft)'
                          : themeLightBackgroundSurface,
                        transition: `background-color ${motionDurationShort} ${motionEasingBase}`,
                      }}
                    >
                      <PIcon
                        name={peopleReady ? 'check' : 'user-group'}
                        size="x-small"
                        color={peopleReady ? 'notification-success' : 'contrast-medium'}
                      />
                      <PText size="x-small" weight="semi-bold" style={{ whiteSpace: 'nowrap' }}>
                        {personSetups.length === 1 ? '1 person' : `${personSetups.length} people`}
                      </PText>
                    </div>

                    {allReady && (
                      <PText size="x-small" color="contrast-medium" style={{ whiteSpace: 'nowrap' }}>
                        {formatDuration(rentalDuration)}, {personSetups.length === 1 ? '1 person' : `${personSetups.length} people`} — {locationLabel}
                      </PText>
                    )}
                  </>
                );
              })()}
            </div>

            <PButton
              onClick={handleContinue}
              icon="arrow-right"
              compact
              disabled={!localStart || !localEnd || !!invalidDateOrder || !!sameDayTimeError || rentalDays <= 0}
            >
              Continue to Equipment
            </PButton>
          </div>
        </div>
      </FixedBottomBar>
    </div>
  );
}
