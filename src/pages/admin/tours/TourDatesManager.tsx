import { useState } from 'react';
import {
  PHeading,
  PText,
  PButton,
  PTag,
  PIcon,
} from '@porsche-design-system/components-react';
import type { Tour, TourDate } from '../../../types';

interface TourDatesManagerProps {
  tour: Tour;
  onCreateDate: (td: { tour_id: string; date: string; start_time: string; available_spots: number }) => Promise<void>;
  onUpdateDate: (id: string, updates: Record<string, unknown>) => Promise<void>;
  onDeleteDate: (id: string) => Promise<void>;
  onRefresh: () => void;
}

export function TourDatesManager({ tour, onCreateDate, onUpdateDate, onDeleteDate, onRefresh }: TourDatesManagerProps) {
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('09:00');
  const [newSpots, setNewSpots] = useState(String(tour.max_participants));
  const [adding, setAdding] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const dates = (tour.dates || [])
    .filter((d) => d.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));

  async function handleAddDate() {
    if (!newDate) return;
    setAdding(true);
    try {
      await onCreateDate({
        tour_id: tour.id,
        date: newDate,
        start_time: newTime,
        available_spots: parseInt(newSpots) || tour.max_participants,
      });
      setNewDate('');
      await onRefresh();
    } finally {
      setAdding(false);
    }
  }

  async function toggleCancel(td: TourDate) {
    await onUpdateDate(td.id, { is_cancelled: !td.is_cancelled });
    await onRefresh();
  }

  return (
    <div className="flex flex-col gap-static-sm">
      <PHeading size="small" tag="h3">Tour Dates</PHeading>

      <div className="flex gap-static-xs items-end flex-wrap">
        <div className="flex-1 min-w-[140px]">
          <PText size="x-small" weight="semi-bold" className="mb-static-xs">Date</PText>
          <input
            type="date"
            min={today}
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="w-full px-static-sm py-static-xs border border-contrast-low rounded-[var(--p-border-radius-sm)] bg-canvas text-primary"
            style={{ fontFamily: "'Porsche Next','Arial Narrow',Arial,sans-serif", fontSize: '14px' }}
          />
        </div>
        <div className="w-[100px]">
          <PText size="x-small" weight="semi-bold" className="mb-static-xs">Time</PText>
          <input
            type="time"
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
            className="w-full px-static-sm py-static-xs border border-contrast-low rounded-[var(--p-border-radius-sm)] bg-canvas text-primary"
            style={{ fontFamily: "'Porsche Next','Arial Narrow',Arial,sans-serif", fontSize: '14px' }}
          />
        </div>
        <div className="w-[80px]">
          <PText size="x-small" weight="semi-bold" className="mb-static-xs">Spots</PText>
          <input
            type="number"
            min={1}
            value={newSpots}
            onChange={(e) => setNewSpots(e.target.value)}
            className="w-full px-static-sm py-static-xs border border-contrast-low rounded-[var(--p-border-radius-sm)] bg-canvas text-primary"
            style={{ fontFamily: "'Porsche Next','Arial Narrow',Arial,sans-serif", fontSize: '14px' }}
          />
        </div>
        <PButton compact icon="add" onClick={handleAddDate} loading={adding} disabled={!newDate}>
          Add
        </PButton>
      </div>

      {dates.length === 0 ? (
        <PText size="x-small" color="contrast-medium">No upcoming dates</PText>
      ) : (
        <div className="flex flex-col gap-static-xs">
          {dates.map((td) => (
            <div
              key={td.id}
              className={`flex items-center justify-between gap-static-sm px-static-sm py-static-xs border rounded-[var(--p-border-radius-sm)] ${
                td.is_cancelled ? 'border-contrast-low opacity-50' : 'border-contrast-low'
              }`}
            >
              <div className="flex items-center gap-static-sm">
                <PIcon name="calendar" size="x-small" color="contrast-medium" />
                <PText size="small">
                  {new Date(td.date + 'T00:00:00').toLocaleDateString('en-GB', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </PText>
                <PText size="x-small" color="contrast-medium">{td.start_time.slice(0, 5)}</PText>
                <PTag compact color={td.is_cancelled ? 'notification-error-soft' : td.available_spots <= 0 ? 'notification-warning-soft' : 'notification-success-soft'}>
                  {td.is_cancelled ? 'Cancelled' : `${td.available_spots} spots`}
                </PTag>
              </div>
              <div className="flex gap-static-xs">
                <PButton
                  compact
                  variant="tertiary"
                  icon={td.is_cancelled ? 'refresh' : 'close'}
                  hideLabel
                  onClick={() => toggleCancel(td)}
                >
                  {td.is_cancelled ? 'Restore' : 'Cancel'}
                </PButton>
                <PButton
                  compact
                  variant="tertiary"
                  icon="delete"
                  hideLabel
                  onClick={async () => {
                    await onDeleteDate(td.id);
                    await onRefresh();
                  }}
                >
                  Delete
                </PButton>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
