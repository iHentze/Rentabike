import { useState, useEffect } from 'react';
import {
  PFlyout,
  PHeading,
  PButton,
  PText,
  PDivider,
  PTextarea,
  PIcon,
  PModal,
  PSelect,
  PSelectOption,
  PInlineNotification,
  PTag,
} from '@porsche-design-system/components-react';
import { supabase } from '../../../lib/supabase';
import { computeRentalDuration, formatDuration } from '../../../utils/rentalDuration';
import { GroupItemsCell } from '../shared/GroupItemsCell';
import { EquipmentTracker } from './EquipmentTracker';
import { StatusTag } from '../shared/StatusTag';
import { sendBookingConfirmationEmail, sendBookingReminderEmail } from '../../../lib/bookingEmail';
import type { Booking } from '../../../types';

interface BookingDetailFlyoutProps {
  booking: Booking | null;
  open: boolean;
  onDismiss: () => void;
  onStatusUpdated?: () => void;
  onRefresh?: () => void;
}

const CANCELLATION_REASONS = [
  'Customer requested',
  'Weather conditions',
  'Equipment unavailable',
  'Customer no-show',
  'Administrative error',
  'Other',
];

const STATUS_TRANSITIONS: Record<string, { label: string; icon: string; next: string }[]> = {
  pending: [
    { label: 'Confirm', icon: 'check', next: 'confirmed' },
  ],
  confirmed: [],
  picked_up: [],
  returned: [],
  cancelled: [],
};

export function BookingDetailFlyout({
  booking: initialBooking,
  open,
  onDismiss,
  onStatusUpdated,
  onRefresh,
}: BookingDetailFlyoutProps) {
  const [liveBooking, setLiveBooking] = useState<Booking | null>(null);
  const [internalNotes, setInternalNotes] = useState('');
  const [notesChanged, setNotesChanged] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [sendingConfirmation, setSendingConfirmation] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    if (initialBooking) {
      setLiveBooking(initialBooking);
      setInternalNotes(initialBooking.internal_notes || '');
      setNotesChanged(false);
      setFeedback(null);
    } else {
      setLiveBooking(null);
    }
  }, [initialBooking, open]);

  const reloadBooking = async () => {
    if (!liveBooking) return;
    const { data } = await supabase
      .from('bookings')
      .select('*, items:booking_items(*, bike:bikes(name, size, price_per_day)), persons:booking_persons(*)')
      .eq('id', liveBooking.id)
      .maybeSingle();
    if (data) setLiveBooking(data as Booking);
    onRefresh?.();
  };

  if (!liveBooking) return null;

  const booking = liveBooking;

  const dur = computeRentalDuration(
    booking.start_at || `${booking.start_date}T09:00:00`,
    booking.end_at || `${booking.end_date}T09:00:00`,
  );

  function showFeedback(type: 'success' | 'error', msg: string) {
    setFeedback({ type, msg });
    if (type === 'success') {
      setTimeout(() => setFeedback(null), 4000);
    }
  }

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ internal_notes: internalNotes })
        .eq('id', booking.id);
      if (error) throw error;
      setNotesChanged(false);
      showFeedback('success', 'Notes saved');
      onStatusUpdated?.();
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Failed to save notes');
    } finally {
      setSavingNotes(false);
    }
  };

  const handleStatusChange = async (nextStatus: string) => {
    setUpdatingStatus(true);
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: nextStatus })
        .eq('id', booking.id);
      if (error) throw error;

      const statusLabels: Record<string, string> = {
        confirmed: 'Booking confirmed',
        picked_up: 'Marked as picked up',
        returned: 'Marked as returned',
      };
      showFeedback('success', statusLabels[nextStatus] || 'Status updated');
      onStatusUpdated?.();
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleCancelBooking = async () => {
    if (!cancelReason) return;
    setCancelling(true);
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'cancelled', cancellation_reason: cancelReason })
        .eq('id', booking.id);
      if (error) throw error;
      setShowCancelModal(false);
      setCancelReason('');
      showFeedback('success', 'Booking cancelled');
      onStatusUpdated?.();
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Failed to cancel booking');
    } finally {
      setCancelling(false);
    }
  };

  const handleSendConfirmation = async () => {
    setSendingConfirmation(true);
    try {
      await sendBookingConfirmationEmail(booking);
      showFeedback('success', 'Confirmation email sent');
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Failed to send email');
    } finally {
      setSendingConfirmation(false);
    }
  };

  const handleSendReminder = async () => {
    setSendingReminder(true);
    try {
      await sendBookingReminderEmail(booking);
      showFeedback('success', 'Reminder email sent');
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Failed to send email');
    } finally {
      setSendingReminder(false);
    }
  };

  const transitions = STATUS_TRANSITIONS[booking.status] || [];
  const isBusy = savingNotes || sendingConfirmation || sendingReminder || updatingStatus;

  return (
    <>
      <PFlyout open={open} onDismiss={onDismiss} aria={{ 'aria-label': 'Booking Details' }}>
        <div slot="header">
          <div className="flex items-center gap-static-sm">
            <PHeading size="medium" tag="h2">{booking.confirmation_code}</PHeading>
            <StatusTag status={booking.status} />
          </div>
        </div>

        <div className="flex flex-col gap-fluid-md">
          {feedback && (
            <PInlineNotification
              state={feedback.type === 'success' ? 'success' : 'error'}
              dismissButton
              onDismiss={() => setFeedback(null)}
            >
              {feedback.msg}
            </PInlineNotification>
          )}

          {(transitions.length > 0 || (booking.status !== 'cancelled' && booking.status !== 'returned')) && (
            <section className="flex gap-static-sm flex-wrap">
              {transitions.map((t) => (
                <PButton
                  key={t.next}
                  icon={t.icon as never}
                  onClick={() => handleStatusChange(t.next)}
                  loading={updatingStatus}
                  disabled={isBusy}
                >
                  {t.label}
                </PButton>
              ))}

              {booking.status !== 'cancelled' && booking.status !== 'returned' && (
                <PButton
                  variant="tertiary"
                  icon="close"
                  disabled={isBusy}
                  onClick={() => setShowCancelModal(true)}
                >
                  Cancel
                </PButton>
              )}
            </section>
          )}

          {booking.status === 'cancelled' && booking.cancellation_reason && (
            <section className="bg-error-soft rounded-[var(--p-border-radius-md)] p-static-sm">
              <PText size="small" weight="semi-bold" color="notification-error">
                Cancellation reason
              </PText>
              <PText size="small">{booking.cancellation_reason}</PText>
            </section>
          )}

          <PDivider />

          <section>
            <PHeading size="small" tag="h3" className="mb-static-sm">Customer</PHeading>
            <div className="grid grid-cols-2 gap-static-md">
              <div>
                <PText size="x-small" color="contrast-medium">Name</PText>
                <PText weight="semi-bold">{booking.customer_name}</PText>
              </div>
              <div>
                <PText size="x-small" color="contrast-medium">Email</PText>
                <PText weight="semi-bold">{booking.customer_email}</PText>
              </div>
              <div>
                <PText size="x-small" color="contrast-medium">Phone</PText>
                <PText weight="semi-bold">{booking.customer_phone || '--'}</PText>
              </div>
            </div>
          </section>

          <PDivider />

          <section>
            <PHeading size="small" tag="h3" className="mb-static-sm">Rental Period</PHeading>
            <div className="grid grid-cols-2 gap-static-md">
              <div>
                <PText size="x-small" color="contrast-medium">
                  <PIcon name="arrow-head-up" size="x-small" className="inline mr-static-xs" />
                  Pickup
                </PText>
                <PText weight="semi-bold">
                  {new Date(booking.start_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                  {booking.pickup_time ? ` at ${booking.pickup_time.slice(0, 5)}` : ''}
                </PText>
                {booking.pickup_location && (
                  <PText size="x-small" color="contrast-medium">{booking.pickup_location}</PText>
                )}
              </div>
              <div>
                <PText size="x-small" color="contrast-medium">
                  <PIcon name="arrow-head-down" size="x-small" className="inline mr-static-xs" />
                  Return
                </PText>
                <PText weight="semi-bold">
                  {new Date(booking.end_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                  {booking.dropoff_time ? ` at ${booking.dropoff_time.slice(0, 5)}` : ''}
                </PText>
                {booking.dropoff_location && (
                  <PText size="x-small" color="contrast-medium">{booking.dropoff_location}</PText>
                )}
              </div>
            </div>
            <PText size="x-small" color="contrast-medium" className="mt-static-sm">
              Duration: {formatDuration(dur)}
            </PText>
          </section>

          <PDivider />

          <section>
            <PHeading size="small" tag="h3" className="mb-static-sm">Equipment</PHeading>
            {(booking.status === 'confirmed' || booking.status === 'picked_up') ? (
              <EquipmentTracker
                booking={booking}
                onUpdated={reloadBooking}
                onFeedback={showFeedback}
                disabled={isBusy}
              />
            ) : (
              <GroupItemsCell booking={booking} />
            )}
          </section>

          <PDivider />

          <section>
            <div className="flex justify-between items-center">
              <PHeading size="small" tag="h3">Total</PHeading>
              <PText size="large" weight="semi-bold">{booking.total_price.toLocaleString()} DKK</PText>
            </div>
          </section>

          <PDivider />

          <section>
            <PHeading size="small" tag="h3" className="mb-static-sm">Payment</PHeading>
            <div className="flex gap-static-sm items-center flex-wrap">
              {booking.payment_method === 'card_online' ? (
                <PTag
                  icon="card"
                  color={
                    booking.payment_status === 'authorized' || booking.payment_status === 'captured'
                      ? 'notification-success-soft'
                      : booking.payment_status === 'failed'
                        ? 'notification-error-soft'
                        : 'notification-warning-soft'
                  }
                >
                  {booking.payment_status === 'authorized' ? 'Card Authorized' : booking.payment_status === 'captured' ? 'Card Captured' : booking.payment_status === 'failed' ? 'Card Failed' : 'Card Pending'}
                </PTag>
              ) : (
                <PTag icon="home" color="notification-info-soft">Pay at Pickup</PTag>
              )}
              {booking.payment_transaction_id && (
                <PText size="x-small" color="contrast-medium">
                  Txn: {booking.payment_transaction_id}
                </PText>
              )}
            </div>
          </section>

          <PDivider />

          <section>
            <div className="flex justify-between items-center mb-static-sm">
              <PHeading size="small" tag="h3">Internal Notes</PHeading>
              {notesChanged && (
                <PTag compact>unsaved</PTag>
              )}
            </div>
            <PTextarea
              name="internal-notes"
              label="Notes visible only to staff"
              value={internalNotes}
              onInput={(e) => {
                setInternalNotes((e.target as HTMLTextAreaElement).value);
                setNotesChanged(true);
              }}
            />
            <div className="mt-static-sm">
              <PButton
                variant="secondary"
                icon="save"
                compact
                disabled={!notesChanged || savingNotes}
                loading={savingNotes}
                onClick={handleSaveNotes}
              >
                Save Notes
              </PButton>
            </div>
          </section>

          {booking.status_history && booking.status_history.length > 0 && (
            <>
              <PDivider />
              <section>
                <PHeading size="small" tag="h3" className="mb-static-sm">History</PHeading>
                <div className="flex flex-col gap-static-xs">
                  {booking.status_history.map((entry, i) => (
                    <div key={i} className="flex items-center gap-static-sm">
                      <PText size="x-small" color="contrast-medium">
                        {new Date(entry.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </PText>
                      <StatusTag status={entry.status} />
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          <PDivider />

          <section className="flex items-center gap-static-sm text-contrast-medium">
            <PText size="x-small" color="contrast-medium">
              Created {new Date(booking.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </PText>
            {booking.modified_at && booking.modified_at !== booking.created_at && (
              <PText size="x-small" color="contrast-medium">
                | Modified {new Date(booking.modified_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </PText>
            )}
          </section>
        </div>

        <div slot="footer" className="flex gap-static-sm flex-wrap items-center">
          <PButton
            variant="tertiary"
            icon="email"
            disabled={isBusy}
            loading={sendingConfirmation}
            onClick={handleSendConfirmation}
            compact
          >
            Send Confirmation
          </PButton>
          <PButton
            variant="tertiary"
            icon="bell"
            disabled={isBusy || booking.status !== 'confirmed'}
            loading={sendingReminder}
            onClick={handleSendReminder}
            compact
          >
            Send Reminder
          </PButton>
        </div>

        <PModal open={showCancelModal} onDismiss={() => setShowCancelModal(false)}>
          <PHeading size="medium" tag="h2" className="mb-static-md">Cancel Booking</PHeading>
          <PText color="contrast-medium" className="mb-static-lg">
            Select a reason for cancellation. This will be recorded for reference.
          </PText>

          <PSelect
            name="cancelReason"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.detail.value)}
            label="Cancellation Reason"
            className="mb-static-lg"
          >
            <PSelectOption value="">Choose a reason...</PSelectOption>
            {CANCELLATION_REASONS.map((reason) => (
              <PSelectOption key={reason} value={reason}>
                {reason}
              </PSelectOption>
            ))}
          </PSelect>

          <div slot="footer" className="flex gap-static-sm">
            <PButton
              onClick={handleCancelBooking}
              loading={cancelling}
              disabled={!cancelReason || cancelling}
            >
              Confirm Cancellation
            </PButton>
            <PButton
              variant="secondary"
              onClick={() => setShowCancelModal(false)}
              disabled={cancelling}
            >
              Keep Booking
            </PButton>
          </div>
        </PModal>
      </PFlyout>
    </>
  );
}
