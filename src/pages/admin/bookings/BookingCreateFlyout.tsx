import { useState, useEffect } from 'react';
import {
  PFlyout,
  PHeading,
  PButton,
  PTextFieldWrapper,
  PSelect,
  PSelectOption,
} from '@porsche-design-system/components-react';
import { supabase } from '../../../lib/supabase';
import type { Bike } from '../../../types';

interface BookingCreateFlyoutProps {
  open: boolean;
  onDismiss: () => void;
  onBookingCreated: () => void;
}

interface FormData {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  pickupLocation: string;
  dropoffLocation: string;
  selectedBikes: { bikeId: string; quantity: number }[];
}

const EMPTY_FORM: FormData = {
  customerName: '',
  customerEmail: '',
  customerPhone: '',
  startDate: '',
  endDate: '',
  startTime: '09:00',
  endTime: '09:00',
  pickupLocation: '',
  dropoffLocation: '',
  selectedBikes: [],
};

export function BookingCreateFlyout({ open, onDismiss, onBookingCreated }: BookingCreateFlyoutProps) {
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [bikes, setBikes] = useState<Bike[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedBikeId, setSelectedBikeId] = useState('');
  const [selectedBikeQuantity, setSelectedBikeQuantity] = useState('1');

  useEffect(() => {
    if (open) {
      fetchData();
      setForm(EMPTY_FORM);
      setError('');
    }
  }, [open]);

  async function fetchData() {
    try {
      const bikeRes = await supabase.from('bikes').select('*').eq('is_active', true);

      if (bikeRes.data) setBikes(bikeRes.data);
    } catch {
    }
  }

  function updateForm(field: keyof FormData, value: unknown) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function addBike() {
    if (!selectedBikeId) return;

    const bike = bikes.find((b) => b.id === selectedBikeId);
    if (!bike) return;

    const qty = parseInt(selectedBikeQuantity) || 1;
    const existing = form.selectedBikes.find((sb) => sb.bikeId === selectedBikeId);

    if (existing) {
      updateForm(
        'selectedBikes',
        form.selectedBikes.map((sb) =>
          sb.bikeId === selectedBikeId ? { ...sb, quantity: sb.quantity + qty } : sb,
        ),
      );
    } else {
      updateForm('selectedBikes', [...form.selectedBikes, { bikeId: selectedBikeId, quantity: qty }]);
    }

    setSelectedBikeId('');
    setSelectedBikeQuantity('1');
  }

  function removeBike(bikeId: string) {
    updateForm(
      'selectedBikes',
      form.selectedBikes.filter((sb) => sb.bikeId !== bikeId),
    );
  }

  async function handleSubmit() {
    if (!form.customerName || !form.customerEmail || !form.startDate || !form.endDate || form.selectedBikes.length === 0) {
      setError('Please fill in all required fields and add at least one bike');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const startAt = `${form.startDate}T${form.startTime}:00`;
      const endAt = `${form.endDate}T${form.endTime}:00`;

      const calculatePrice = () => {
        const start = new Date(startAt).getTime();
        const end = new Date(endAt).getTime();
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

        return form.selectedBikes.reduce((total, sb) => {
          const bike = bikes.find((b) => b.id === sb.bikeId);
          return total + (bike?.price_per_day || 0) * sb.quantity * days;
        }, 0);
      };

      const totalPrice = calculatePrice();

      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          customer_name: form.customerName,
          customer_email: form.customerEmail,
          customer_phone: form.customerPhone,
          start_date: form.startDate,
          end_date: form.endDate,
          start_at: startAt,
          end_at: endAt,
          pickup_location: form.pickupLocation,
          dropoff_location: form.dropoffLocation,
          pickup_time: form.startTime,
          dropoff_time: form.endTime,
          total_price: totalPrice,
          status: 'pending',
          notes: '',
        })
        .select()
        .maybeSingle();

      if (bookingError) throw bookingError;
      if (!booking) throw new Error('Failed to create booking');

      for (const sb of form.selectedBikes) {
        const bike = bikes.find((b) => b.id === sb.bikeId);
        if (bike) {
          const { error: itemError } = await supabase.from('booking_items').insert({
            booking_id: booking.id,
            bike_id: sb.bikeId,
            quantity: sb.quantity,
            price_per_day: bike.price_per_day,
          });

          if (itemError) throw itemError;
        }
      }

      onBookingCreated();
      onDismiss();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create booking');
    } finally {
      setLoading(false);
    }
  }

  const selectedBikesData = form.selectedBikes
    .map((sb) => {
      const bike = bikes.find((b) => b.id === sb.bikeId);
      return bike ? { ...sb, bike } : null;
    })
    .filter((x) => x !== null);

  return (
    <PFlyout open={open} onDismiss={onDismiss}>
      <div slot="header">
        <PHeading size="medium" tag="h2">Create Manual Booking</PHeading>
      </div>

      <div className="flex flex-col gap-fluid-md">
        <section>
          <PHeading size="small" tag="h3" className="mb-static-md">
            Customer Information
          </PHeading>
          <div className="flex flex-col gap-static-md">
            <PTextFieldWrapper label="Name *">
              <input
                type="text"
                value={form.customerName}
                onChange={(e) => updateForm('customerName', e.target.value)}
                placeholder="Full name"
              />
            </PTextFieldWrapper>

            <PTextFieldWrapper label="Email *">
              <input
                type="email"
                value={form.customerEmail}
                onChange={(e) => updateForm('customerEmail', e.target.value)}
                placeholder="customer@example.com"
              />
            </PTextFieldWrapper>

            <PTextFieldWrapper label="Phone">
              <input
                type="tel"
                value={form.customerPhone}
                onChange={(e) => updateForm('customerPhone', e.target.value)}
                placeholder="+298 123456"
              />
            </PTextFieldWrapper>
          </div>
        </section>

        <section>
          <PHeading size="small" tag="h3" className="mb-static-md">
            Rental Dates & Times
          </PHeading>
          <div className="flex flex-col gap-static-md">
            <div className="grid grid-cols-2 gap-static-sm">
              <PTextFieldWrapper label="Start Date *">
                <input
                  type="date"
                  name="startDate"
                  value={form.startDate}
                  onChange={(e) => updateForm('startDate', e.target.value)}
                />
              </PTextFieldWrapper>

              <PTextFieldWrapper label="Start Time *">
                <input
                  type="time"
                  name="startTime"
                  value={form.startTime}
                  onChange={(e) => updateForm('startTime', e.target.value)}
                />
              </PTextFieldWrapper>
            </div>

            <div className="grid grid-cols-2 gap-static-sm">
              <PTextFieldWrapper label="End Date *">
                <input
                  type="date"
                  name="endDate"
                  value={form.endDate}
                  onChange={(e) => updateForm('endDate', e.target.value)}
                />
              </PTextFieldWrapper>

              <PTextFieldWrapper label="End Time *">
                <input
                  type="time"
                  name="endTime"
                  value={form.endTime}
                  onChange={(e) => updateForm('endTime', e.target.value)}
                />
              </PTextFieldWrapper>
            </div>
          </div>
        </section>

        <section>
          <PHeading size="small" tag="h3" className="mb-static-md">
            Pickup & Dropoff
          </PHeading>
          <div className="flex flex-col gap-static-md">
            <PTextFieldWrapper label="Pickup Location">
              <input
                type="text"
                value={form.pickupLocation}
                onChange={(e) => updateForm('pickupLocation', e.target.value)}
                placeholder="e.g., Main Office, Tórshavn"
              />
            </PTextFieldWrapper>

            <PTextFieldWrapper label="Dropoff Location">
              <input
                type="text"
                value={form.dropoffLocation}
                onChange={(e) => updateForm('dropoffLocation', e.target.value)}
                placeholder="e.g., Airport, Vágar"
              />
            </PTextFieldWrapper>
          </div>
        </section>

        <section>
          <PHeading size="small" tag="h3" className="mb-static-md">
            Bikes *
          </PHeading>
          <div className="flex flex-col gap-static-md">
            <div className="flex gap-static-sm">
              <div className="flex-1">
                <PSelect name="bike" value={selectedBikeId} onChange={(e) => setSelectedBikeId(e.detail.value)} label="Select Bike">
                  <PSelectOption value="">Choose a bike...</PSelectOption>
                  {bikes.map((bike) => (
                    <PSelectOption key={bike.id} value={bike.id}>
                      {bike.name} ({bike.size})
                    </PSelectOption>
                  ))}
                </PSelect>
              </div>

              <div className="w-24">
                <PTextFieldWrapper label="Qty">
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={selectedBikeQuantity}
                    onChange={(e) => setSelectedBikeQuantity(e.target.value)}
                  />
                </PTextFieldWrapper>
              </div>

              <div className="flex items-end">
                <PButton compact variant="secondary" onClick={addBike} disabled={!selectedBikeId}>
                  Add
                </PButton>
              </div>
            </div>

            {selectedBikesData.length > 0 && (
              <div className="flex flex-wrap gap-static-sm">
                {selectedBikesData.map((sb) =>
                  sb ? (
                    <div key={sb.bikeId} className="flex items-center gap-static-xs bg-surface border border-contrast-low rounded px-static-sm py-static-xs">
                      <span className="text-small">{sb.bike.name} (×{sb.quantity})</span>
                      <button
                        type="button"
                        onClick={() => removeBike(sb.bikeId)}
                        className="text-contrast-medium hover:text-primary ml-static-xs"
                        aria-label="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  ) : null,
                )}
              </div>
            )}
          </div>
        </section>

        {error && (
          <div className="p-static-md bg-notification-error-soft rounded text-notification-error">{error}</div>
        )}
      </div>

      <div slot="footer" className="flex gap-static-sm">
        <PButton onClick={handleSubmit} loading={loading} disabled={loading}>
          Create Booking
        </PButton>
        <PButton variant="secondary" onClick={onDismiss} disabled={loading}>
          Cancel
        </PButton>
      </div>
    </PFlyout>
  );
}
