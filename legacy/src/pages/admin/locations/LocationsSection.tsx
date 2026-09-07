import { useState } from 'react';
import {
  PHeading,
  PButton,
  PSpinner,
  PText,
  PIcon,
  PTag,
} from '@porsche-design-system/components-react';
import { LocationEditFlyout } from './LocationEditFlyout';
import type { Location } from '../../../types';

interface LocationsSectionProps {
  locations: Location[];
  loading: boolean;
  onRefresh: () => void;
  onCreateLocation: (location: Omit<Location, 'id' | 'created_at'>) => void;
  onUpdateLocation: (id: string, updates: Partial<Location>) => void;
  onDeleteLocation: (id: string) => void;
}

export function LocationsSection({
  locations,
  loading,
  onRefresh,
  onCreateLocation,
  onUpdateLocation,
  onDeleteLocation,
}: LocationsSectionProps) {
  const [editLocation, setEditLocation] = useState<Location | null>(null);
  const [creating, setCreating] = useState(false);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <PSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-fluid-md">
      <div className="flex justify-between items-start flex-wrap gap-static-md">
        <div>
          <PHeading size="x-large" tag="h1">Locations</PHeading>
          <PText color="contrast-medium" className="mt-static-xs">
            Manage rental pickup and drop-off points and their fees.
          </PText>
        </div>
        <div className="flex items-center gap-static-sm">
          <PButton variant="secondary" icon="refresh" compact onClick={onRefresh}>
            Refresh
          </PButton>
          <PButton icon="add" compact onClick={() => setCreating(true)}>
            Add Location
          </PButton>
        </div>
      </div>

      {locations.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-static-md py-fluid-xl bg-surface border border-contrast-low rounded-lg">
          <PIcon name="locate" size="large" color="contrast-medium" />
          <PText color="contrast-medium">No locations yet. Add your first one.</PText>
          <PButton icon="add" onClick={() => setCreating(true)}>
            Add Location
          </PButton>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-static-md">
          {locations.map((loc) => (
            <div
              key={loc.id}
              className="flex flex-col gap-static-sm p-static-md bg-surface border border-contrast-low rounded-lg"
            >
              <div className="flex items-start justify-between gap-static-sm">
                <div className="flex flex-col gap-static-xs">
                  <div className="flex items-center gap-static-sm">
                    <PHeading size="small" tag="h3">{loc.name}</PHeading>
                    {!loc.is_active && (
                      <PTag color="background-surface">Inactive</PTag>
                    )}
                  </div>
                  <PText size="x-small" color="contrast-medium">{loc.slug}</PText>
                </div>
                <PButton
                  variant="secondary"
                  icon="edit"
                  hideLabel
                  compact
                  onClick={() => setEditLocation(loc)}
                >
                  Edit
                </PButton>
              </div>

              {loc.address && (
                <div className="flex items-center gap-static-xs">
                  <PIcon name="locate" size="small" color="contrast-medium" />
                  <PText size="small" color="contrast-high">{loc.address}</PText>
                </div>
              )}
              {loc.phone && (
                <div className="flex items-center gap-static-xs">
                  <PIcon name="phone" size="small" color="contrast-medium" />
                  <PText size="small" color="contrast-medium">{loc.phone}</PText>
                </div>
              )}

              <div className="flex flex-wrap gap-static-xs mt-static-xs">
                {loc.pickup_fee > 0 && (
                  <PTag color="notification-info-soft">
                    Pickup fee: {loc.pickup_fee} DKK
                  </PTag>
                )}
                {loc.dropoff_fee > 0 && (
                  <PTag color="notification-info-soft">
                    Dropoff fee: {loc.dropoff_fee} DKK
                  </PTag>
                )}
                {loc.pickup_fee === 0 && loc.dropoff_fee === 0 && (
                  <PTag color="notification-success-soft">
                    No extra fees
                  </PTag>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <LocationEditFlyout
        location={editLocation}
        open={!!editLocation || creating}
        onDismiss={() => { setEditLocation(null); setCreating(false); }}
        onSave={(data) => {
          if (editLocation) {
            onUpdateLocation(editLocation.id, data);
          } else {
            onCreateLocation(data);
          }
          setEditLocation(null);
          setCreating(false);
        }}
        onDelete={editLocation ? () => { onDeleteLocation(editLocation.id); setEditLocation(null); } : undefined}
      />
    </div>
  );
}
