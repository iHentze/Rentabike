import {
  PTableRow,
  PTableCell,
  PText,
  PTag,
  PButton,
} from '@porsche-design-system/components-react';
import type { Tour } from '../../../types';

interface TourRowProps {
  tour: Tour;
  onEdit: (tour: Tour) => void;
}

const ACTIVITY_LABELS: Record<string, { label: string; icon: string }> = {
  bike: { label: 'Biking', icon: 'country-road' },
  combo: { label: 'Hike & Bike', icon: 'arrows' },
  hike: { label: 'Hiking', icon: 'map' },
  'trail-run': { label: 'Trail Run', icon: 'flash' },
};

export function TourRow({ tour, onEdit }: TourRowProps) {
  const activity = ACTIVITY_LABELS[tour.activity_type] || ACTIVITY_LABELS.bike;
  const upcomingDates = (tour.dates || []).filter(
    (d) => !d.is_cancelled && d.date >= new Date().toISOString().split('T')[0],
  );
  const allowedBikeCount = (tour.allowed_bikes || []).length;

  return (
    <PTableRow>
      <PTableCell multiline>
        <PText size="small" weight="semi-bold">{tour.name}</PText>
        <PText size="x-small" color="contrast-medium">{tour.short_description || tour.slug}</PText>
      </PTableCell>
      <PTableCell>
        <PTag icon={activity.icon as never} compact>{activity.label}</PTag>
      </PTableCell>
      <PTableCell>
        <PTag compact>{tour.difficulty}</PTag>
      </PTableCell>
      <PTableCell>
        <PText size="small">{tour.duration_hours}h</PText>
      </PTableCell>
      <PTableCell>
        <PText size="small" weight="semi-bold">{Number(tour.price_per_person).toLocaleString()} DKK</PText>
      </PTableCell>
      <PTableCell>
        {tour.needs_bike ? (
          <PTag compact icon="configurate" color={allowedBikeCount > 0 ? 'notification-success-soft' : 'notification-warning-soft'}>
            {allowedBikeCount} bike{allowedBikeCount !== 1 ? 's' : ''}
          </PTag>
        ) : (
          <PTag compact color="background-surface">No bike needed</PTag>
        )}
      </PTableCell>
      <PTableCell>
        <PText size="small">{upcomingDates.length} upcoming</PText>
      </PTableCell>
      <PTableCell>
        <PTag
          compact
          color={tour.is_active ? 'notification-success-soft' : 'notification-error-soft'}
        >
          {tour.is_active ? 'Active' : 'Inactive'}
        </PTag>
      </PTableCell>
      <PTableCell>
        <PButton compact variant="secondary" onClick={() => onEdit(tour)}>
          Edit
        </PButton>
      </PTableCell>
    </PTableRow>
  );
}
