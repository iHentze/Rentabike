import {
  PTable,
  PTableHead,
  PTableHeadRow,
  PTableHeadCell,
  PTableBody,
  PText,
} from '@porsche-design-system/components-react';
import { BookingRow } from './BookingRow';
import type { Booking } from '../../../types';

interface BookingTableProps {
  bookings: Booking[];
  updateStatus: (bookingId: string, status: string) => void;
  onViewDetails: (booking: Booking) => void;
}

export function BookingTable({ bookings, updateStatus, onViewDetails }: BookingTableProps) {
  if (bookings.length === 0) {
    return (
      <div className="text-center py-fluid-lg">
        <PText color="contrast-medium">No bookings found</PText>
      </div>
    );
  }

  return (
    <PTable caption="All bookings">
      <PTableHead>
        <PTableHeadRow>
          <PTableHeadCell>Code</PTableHeadCell>
          <PTableHeadCell>Customer</PTableHeadCell>
          <PTableHeadCell>Dates</PTableHeadCell>
          <PTableHeadCell>Locations</PTableHeadCell>
          <PTableHeadCell>Items</PTableHeadCell>
          <PTableHeadCell>Total</PTableHeadCell>
          <PTableHeadCell>Payment</PTableHeadCell>
          <PTableHeadCell>Status</PTableHeadCell>
          <PTableHeadCell>Actions</PTableHeadCell>
        </PTableHeadRow>
      </PTableHead>
      <PTableBody>
        {bookings.map((booking) => (
          <BookingRow key={booking.id} booking={booking} updateStatus={updateStatus} onViewDetails={onViewDetails} />
        ))}
      </PTableBody>
    </PTable>
  );
}
