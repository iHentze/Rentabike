import {
  PText,
  PSwitch,
  PButtonPure,
  PIcon,
  PTag,
} from '@porsche-design-system/components-react';
import type { Bike } from '../../../types';

interface InventoryGridProps {
  bikes: Bike[];
  onToggleActive: (id: string, active: boolean) => void;
  onEdit: (bike: Bike) => void;
}

function InventoryGridCard({ bike, onToggleActive, onEdit }: {
  bike: Bike;
  onToggleActive: (id: string, active: boolean) => void;
  onEdit: (bike: Bike) => void;
}) {
  const available = bike.available_quantity ?? bike.total_quantity;
  const percentageAvailable = (available / bike.total_quantity) * 100;

  const getAvailabilityColor = (): 'notification-success' | 'notification-warning' | 'notification-error' => {
    if (percentageAvailable >= 75) return 'notification-success';
    if (percentageAvailable >= 50) return 'notification-warning';
    return 'notification-error';
  };

  return (
    <div className="bg-surface rounded-[var(--p-border-radius-lg)] overflow-hidden flex flex-col">
      <div className="aspect-square bg-canvas flex items-center justify-center p-static-md">
        {bike.image_url ? (
          <img
            src={bike.image_url}
            alt={bike.name}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-contain"
          />
        ) : (
          <PIcon name="image" size="large" color="contrast-low" />
        )}
      </div>

      <div className="p-static-md flex flex-col gap-static-sm flex-1">
        <div className="flex items-start justify-between gap-static-xs">
          <PText size="small" weight="semi-bold" className="line-clamp-2">
            {bike.name}
          </PText>
          <PButtonPure icon="edit" hideLabel size="small" onClick={() => onEdit(bike)}>
            Edit
          </PButtonPure>
        </div>

        <div className="flex items-center gap-static-xs flex-wrap">
          {bike.category?.name && (
            <PTag color="background-surface">{bike.category.name}</PTag>
          )}
          {bike.size && (
            <PTag color="background-surface">{bike.size}</PTag>
          )}
        </div>

        <PText size="medium" weight="semi-bold">{bike.price_per_day} DKK</PText>

        <div className="flex items-center justify-between mt-auto pt-static-sm border-t border-contrast-low">
          <div className="flex items-center gap-static-xs">
            <PIcon name="check" size="small" color={getAvailabilityColor()} />
            <PText size="x-small">
              {available}/{bike.total_quantity}
            </PText>
          </div>
          <PSwitch
            checked={bike.is_active}
            hideLabel
            compact
            onUpdate={(e) => onToggleActive(bike.id, e.detail.checked)}
          >
            Active
          </PSwitch>
        </div>
      </div>
    </div>
  );
}

export function InventoryGrid({ bikes, onToggleActive, onEdit }: InventoryGridProps) {
  if (bikes.length === 0) {
    return (
      <div className="text-center py-fluid-lg">
        <PText color="contrast-medium">No items found</PText>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-static-md">
      {bikes.map((bike) => (
        <InventoryGridCard
          key={bike.id}
          bike={bike}
          onToggleActive={onToggleActive}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
}
