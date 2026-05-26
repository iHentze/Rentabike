import {
  PTableRow,
  PTableCell,
  PText,
  PIcon,
  PButton,
  PTag,
} from '@porsche-design-system/components-react';
import { computeRentalDuration, formatDuration } from '../../../utils/rentalDuration';
import { StatusTag } from '../shared/StatusTag';
import { GroupItemsCell } from '../shared/GroupItemsCell';
import type { Booking } from '../../../types';

interface BookingRowProps {
  booking: Booking;
  updateStatus: (bookingId: string, status: string) => void;
  onViewDetails: (booking: Booking) => void;
}

export function BookingRow({ booking, updateStatus, onViewDetails }: BookingRowProps) {
  const dur = computeRentalDuration(
    booking.start_at || `${booking.start_date}T09:00:00`,
    booking.end_at || `${booking.end_date}T09:00:00`,
  );

  return (
    <PTableRow>
      <PTableCell>
        <PText size="x-small" weight="semi-bold">{booking.confirmation_code}</PText>
      </PTableCell>
      <PTableCell multiline>
        <PText size="small" weight="semi-bold">{booking.customer_name}</PText>
        <PText size="x-small" color="contrast-medium">{booking.customer_email}</PText>
        <PText size="x-small" color="contrast-medium">{booking.customer_phone}</PText>
      </PTableCell>
      <PTableCell multiline>
        <PText size="x-small">
          {new Date(booking.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          {booking.pickup_time ? `, ${booking.pickup_time.slice(0, 5)}` : ''}
          {' – '}
          {new Date(booking.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          {booking.dropoff_time ? `, ${booking.dropoff_time.slice(0, 5)}` : ''}
        </PText>
        <PText size="x-small" color="contrast-medium">{formatDuration(dur)}</PText>
      </PTableCell>
      <PTableCell multiline>
        {booking.pickup_location && (
          <div className="flex gap-static-xs items-start">
            <PIcon name="arrow-head-down" size="x-small" color="contrast-medium" />
            <PText size="x-small">{booking.pickup_location}</PText>
          </div>
        )}
        {booking.dropoff_location && (
          <div className="flex gap-static-xs items-start">
            <PIcon name="arrow-head-up" size="x-small" color="contrast-medium" />
            <PText size="x-small">{booking.dropoff_location}</PText>
          </div>
        )}
      </PTableCell>
      <PTableCell multiline>
        <GroupItemsCell booking={booking} />
      </PTableCell>
      <PTableCell>
        <PText size="small" weight="semi-bold">{booking.total_price.toLocaleString()} DKK</PText>
      </PTableCell>
      <PTableCell>
        {booking.payment_method === 'card_online' ? (
          <PTag
            compact
            icon="card"
            color={
              booking.payment_status === 'authorized' || booking.payment_status === 'captured'
                ? 'notification-success-soft'
                : booking.payment_status === 'failed'
                  ? 'notification-error-soft'
                  : 'notification-warning-soft'
            }
          >
            {booking.payment_status === 'authorized' ? 'Authorized' : booking.payment_status === 'captured' ? 'Captured' : booking.payment_status === 'failed' ? 'Failed' : 'Pending'}
          </PTag>
        ) : (
          <PTag compact icon="home" color="notification-info-soft">At pickup</PTag>
        )}
      </PTableCell>
      <PTableCell>
        <StatusTag status={booking.status} />
      </PTableCell>
      <PTableCell>
        <div className="flex gap-static-xs flex-wrap">
          <PButton compact variant="secondary" onClick={() => onViewDetails(booking)}>
            View
          </PButton>
          {booking.status === 'pending' && (
            <PButton compact variant="secondary" onClick={() => updateStatus(booking.id, 'confirmed')}>
              Confirm
            </PButton>
          )}
          {(booking.status === 'confirmed' || booking.status === 'picked_up') && (
            <PButton compact variant="secondary" onClick={() => onViewDetails(booking)}>
              Equipment
            </PButton>
          )}
        </div>
      </PTableCell>
    </PTableRow>
  );
}
