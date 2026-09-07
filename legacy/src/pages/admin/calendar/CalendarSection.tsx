import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventInput, EventClickArg, EventContentArg } from '@fullcalendar/core';
import type { DateClickArg } from '@fullcalendar/interaction';
import {
  PHeading,
  PText,
  PButton,
  PSpinner,
  PSegmentedControl,
  PSegmentedControlItem,
  PIcon,
} from '@porsche-design-system/components-react';
import {
  themeLightPrimary,
  themeLightNotificationSuccess,
  themeLightNotificationSuccessSoft,
  themeLightNotificationWarning,
  themeLightNotificationWarningSoft,
  themeLightNotificationError,
  themeLightNotificationErrorSoft,
} from '@porsche-design-system/components-react/styles';
import { BookingDetailFlyout } from '../bookings/BookingDetailFlyout';
import { TodaySummaryBar } from './TodaySummaryBar';
import { DayDetail } from './DayDetail';
import type { Booking } from '../../../types';

interface CalendarSectionProps {
  bookings: Booking[];
  loading: boolean;
  onRefresh: () => void;
  onStatusUpdated: () => void;
}

const STATUS_COLORS: Record<string, { bg: string; border: string }> = {
  confirmed: { bg: themeLightNotificationSuccessSoft, border: themeLightNotificationSuccess },
  pending: { bg: themeLightNotificationWarningSoft, border: themeLightNotificationWarning },
  cancelled: { bg: themeLightNotificationErrorSoft, border: themeLightNotificationError },
};

type CalendarView = 'dayGridMonth' | 'dayGridWeek' | 'timeGridDay' | 'listWeek';

const VIEW_LABELS: Record<CalendarView, string> = {
  dayGridMonth: 'Month',
  dayGridWeek: 'Week',
  timeGridDay: 'Day',
  listWeek: 'List',
};

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return toYMD(d);
}

function renderEventContent(arg: EventContentArg) {
  const booking = arg.event.extendedProps.booking as Booking;
  const isTimeGrid = arg.view.type === 'timeGridDay';
  const isList = arg.view.type === 'listWeek';

  if (isList) {
    return (
      <div className="flex items-center gap-static-sm">
        <span style={{ fontWeight: 600 }}>{booking.customer_name}</span>
        <span style={{ color: '#6B6D70', fontSize: '11px' }}>{booking.confirmation_code}</span>
        {booking.items && booking.items.length > 0 && (
          <span style={{ color: '#6B6D70', fontSize: '11px' }}>
            {booking.items.map(i => `${i.quantity}x ${i.bike?.name || 'Bike'}`).join(', ')}
          </span>
        )}
      </div>
    );
  }

  if (isTimeGrid) {
    return (
      <div style={{ padding: '1px 2px', overflow: 'hidden' }}>
        <div style={{ fontWeight: 600, fontSize: '11px', lineHeight: '1.3' }}>
          {booking.customer_name}
        </div>
        <div style={{ fontSize: '10px', color: '#6B6D70', lineHeight: '1.3' }}>
          {booking.confirmation_code}
          {booking.items && booking.items.length > 0 && (
            <> &middot; {booking.items.map(i => `${i.quantity}x ${i.bike?.name || 'Bike'}`).join(', ')}</>
          )}
        </div>
      </div>
    );
  }

  const pickupTime = booking.pickup_time?.slice(0, 5) || '';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
      {pickupTime && (
        <span style={{ fontSize: '9px', fontWeight: 700, opacity: 0.7, flexShrink: 0 }}>
          {pickupTime}
        </span>
      )}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {booking.customer_name} ({booking.confirmation_code})
      </span>
    </div>
  );
}

export function CalendarSection({ bookings, loading, onRefresh, onStatusUpdated }: CalendarSectionProps) {
  const calendarRef = useRef<FullCalendar>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(toYMD(new Date()));
  const [detailBooking, setDetailBooking] = useState<Booking | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [currentView, setCurrentView] = useState<CalendarView>('dayGridMonth');

  useEffect(() => {
    setSelectedDate(toYMD(new Date()));
  }, []);

  const events: EventInput[] = useMemo(() => {
    return bookings
      .filter(b => b.status !== 'cancelled')
      .map(b => {
        const colors = STATUS_COLORS[b.status] || STATUS_COLORS.pending;

        const useTimedEvent = currentView === 'timeGridDay' || currentView === 'listWeek';
        let start: string = b.start_date;
        let end: string = addDays(b.end_date, 1);

        if (useTimedEvent && b.start_at && b.end_at) {
          start = b.start_at;
          end = b.end_at;
        } else if (useTimedEvent && b.pickup_time) {
          start = `${b.start_date}T${b.pickup_time}`;
          end = b.dropoff_time ? `${b.end_date}T${b.dropoff_time}` : addDays(b.end_date, 1);
        }

        return {
          id: b.id,
          title: `${b.customer_name} (${b.confirmation_code})`,
          start,
          end,
          backgroundColor: colors.bg,
          borderColor: colors.border,
          textColor: themeLightPrimary,
          extendedProps: { booking: b },
        };
      });
  }, [bookings, currentView]);

  const selectedBookings = useMemo(() => {
    if (!selectedDate) return [];
    return bookings.filter(b => selectedDate >= b.start_date && selectedDate <= b.end_date);
  }, [bookings, selectedDate]);

  const handleDateClick = useCallback((arg: DateClickArg) => {
    setSelectedDate(arg.dateStr);
  }, []);

  const handleEventClick = useCallback((arg: EventClickArg) => {
    const booking = arg.event.extendedProps.booking as Booking;
    setDetailBooking(booking);
    setDetailOpen(true);
  }, []);

  function handleViewChange(e: CustomEvent<{ value: string | number }>) {
    const view = e.detail.value as CalendarView;
    setCurrentView(view);
    calendarRef.current?.getApi().changeView(view);
  }

  function goToToday() {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    api.today();
    if (currentView !== 'timeGridDay') {
      setCurrentView('timeGridDay');
      api.changeView('timeGridDay');
    }
    setSelectedDate(toYMD(new Date()));
  }

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
          <div>
            <PHeading size="x-large" tag="h1">Calendar</PHeading>
            <PText color="contrast-medium">Visual overview of all bookings</PText>
          </div>
          <div className="flex gap-static-sm">
            <PButton variant="tertiary" compact icon="clock" onClick={goToToday}>
              Today
            </PButton>
            <PButton variant="secondary" icon="refresh" compact onClick={onRefresh}>
              Refresh
            </PButton>
          </div>
        </div>

        <TodaySummaryBar bookings={bookings} />

        <div className="flex items-center justify-between gap-static-md">
          <div className="flex items-center gap-static-sm">
            <PButton
              variant="tertiary"
              compact
              icon="arrow-left"
              hideLabel
              onClick={() => calendarRef.current?.getApi().prev()}
            >
              Previous
            </PButton>
            <PButton
              variant="tertiary"
              compact
              icon="arrow-right"
              hideLabel
              onClick={() => calendarRef.current?.getApi().next()}
            >
              Next
            </PButton>
          </div>

          <PSegmentedControl
            value={currentView}
            onChange={handleViewChange}
            compact
            hideLabel
            label="Calendar view"
            columns={4}
          >
            {(Object.keys(VIEW_LABELS) as CalendarView[]).map(view => (
              <PSegmentedControlItem key={view} value={view}>
                {VIEW_LABELS[view]}
              </PSegmentedControlItem>
            ))}
          </PSegmentedControl>
        </div>

        <div className="pds-fullcalendar border border-contrast-low rounded-[var(--p-border-radius-lg)] bg-surface overflow-hidden p-static-md">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            firstDay={1}
            height="auto"
            events={events}
            dateClick={handleDateClick}
            eventClick={handleEventClick}
            eventContent={renderEventContent}
            headerToolbar={{
              left: '',
              center: 'title',
              right: '',
            }}
            dayMaxEventRows={3}
            moreLinkClick="popover"
            eventDisplay="block"
            fixedWeekCount={false}
            nowIndicator={true}
            slotMinTime="06:00:00"
            slotMaxTime="22:00:00"
            slotDuration="00:30:00"
            allDaySlot={true}
            listDayFormat={{ weekday: 'long', day: 'numeric', month: 'long' }}
            noEventsContent={() => (
              <div className="p-static-md text-center">
                <PIcon name="calendar" size="medium" color="contrast-medium" />
                <PText color="contrast-medium" className="mt-static-xs">No bookings in this period</PText>
              </div>
            )}
          />
        </div>

        {selectedDate && currentView !== 'timeGridDay' && currentView !== 'listWeek' && (
          <DayDetail
            dateStr={selectedDate}
            bookings={selectedBookings}
            onViewBooking={(b) => { setDetailBooking(b); setDetailOpen(true); }}
            onClose={() => setSelectedDate(null)}
          />
        )}
      </div>

      <BookingDetailFlyout
        booking={detailBooking}
        open={detailOpen}
        onDismiss={() => { setDetailOpen(false); setDetailBooking(null); }}
        onStatusUpdated={() => {
          onStatusUpdated();
          setDetailOpen(false);
          setDetailBooking(null);
        }}
        onRefresh={onStatusUpdated}
      />
    </>
  );
}
