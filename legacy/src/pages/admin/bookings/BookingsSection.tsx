import { useState, useMemo } from 'react';
import { PHeading, PButton, PSpinner } from '@porsche-design-system/components-react';
import { BookingFilters } from './BookingFilters';
import { BookingTable } from './BookingTable';
import { BookingDetailFlyout } from './BookingDetailFlyout';
import { BookingCreateFlyout } from './BookingCreateFlyout';
import type { Booking } from '../../../types';

interface BookingsSectionProps {
  bookings: Booking[];
  loading: boolean;
  onRefresh: () => void;
  updateStatus: (bookingId: string, status: string) => void;
}

export function BookingsSection({ bookings, loading, onRefresh, updateStatus }: BookingsSectionProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const handleViewDetails = (booking: Booking) => {
    setSelectedBooking(booking);
    setDetailOpen(true);
  };

  const filtered = useMemo(() => {
    let result = bookings;
    if (statusFilter) {
      result = result.filter((b) => b.status === statusFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (b) =>
          b.customer_name.toLowerCase().includes(q) ||
          b.customer_email.toLowerCase().includes(q) ||
          b.confirmation_code.toLowerCase().includes(q),
      );
    }
    return result;
  }, [bookings, search, statusFilter]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <PSpinner size="large" />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-fluid-md">
        <div className="flex justify-between items-start flex-wrap gap-static-md">
          <PHeading size="x-large" tag="h1">Bookings</PHeading>
          <div className="flex gap-static-sm">
            <PButton icon="add" onClick={() => setCreateOpen(true)}>
              New Booking
            </PButton>
            <PButton variant="secondary" icon="refresh" compact onClick={onRefresh}>
              Refresh
            </PButton>
          </div>
        </div>

        <BookingFilters
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
        />

        <BookingTable bookings={filtered} updateStatus={updateStatus} onViewDetails={handleViewDetails} />
      </div>

      <BookingDetailFlyout
        booking={selectedBooking}
        open={detailOpen}
        onDismiss={() => {
          setDetailOpen(false);
          setSelectedBooking(null);
        }}
        onStatusUpdated={() => {
          onRefresh();
          setDetailOpen(false);
          setSelectedBooking(null);
        }}
        onRefresh={onRefresh}
      />

      <BookingCreateFlyout
        open={createOpen}
        onDismiss={() => setCreateOpen(false)}
        onBookingCreated={() => {
          onRefresh();
          setCreateOpen(false);
        }}
      />
    </>
  );
}
