import {
  PTableRow,
  PTableCell,
  PText,
  PSwitch,
  PButtonPure,
  PIcon,
} from '@porsche-design-system/components-react';
import type { Bike } from '../../../types';

interface InventoryRowProps {
  bike: Bike;
  onToggleActive: (id: string, active: boolean) => void;
  onEdit: (bike: Bike) => void;
}

export function InventoryRow({ bike, onToggleActive, onEdit }: InventoryRowProps) {
  const available = bike.available_quantity ?? bike.total_quantity;
  const percentageAvailable = (available / bike.total_quantity) * 100;

  const getAvailabilityColor = () => {
    if (percentageAvailable >= 75) return 'notification-success';
    if (percentageAvailable >= 50) return 'notification-warning';
    return 'notification-error';
  };

  return (
    <PTableRow>
      <PTableCell>
        {bike.image_url ? (
          <img
            src={bike.image_url}
            alt={bike.name}
            className="w-[48px] h-[48px] object-contain rounded-[var(--p-border-radius-sm)]"
          />
        ) : (
          <div className="w-[48px] h-[48px] bg-surface rounded-[var(--p-border-radius-sm)] flex items-center justify-center">
            <PIcon name="image" size="small" color="contrast-low" />
          </div>
        )}
      </PTableCell>
      <PTableCell>
        <PText size="small" weight="semi-bold">{bike.name}</PText>
      </PTableCell>
      <PTableCell>
        <PText size="x-small">{bike.category?.name || '-'}</PText>
      </PTableCell>
      <PTableCell>
        <PText size="x-small">{bike.size || '-'}</PText>
      </PTableCell>
      <PTableCell>
        <PText size="small">{bike.price_per_day} DKK</PText>
      </PTableCell>
      <PTableCell>
        <PText size="small">{bike.total_quantity}</PText>
      </PTableCell>
      <PTableCell>
        <div className="flex items-center gap-static-xs">
          <PIcon
            name="check"
            size="small"
            color={getAvailabilityColor()}
          />
          <PText size="small" weight="semi-bold">
            {available}/{bike.total_quantity}
          </PText>
        </div>
      </PTableCell>
      <PTableCell>
        <PSwitch
          checked={bike.is_active}
          hideLabel
          onUpdate={(e) => onToggleActive(bike.id, e.detail.checked)}
        >
          Active
        </PSwitch>
      </PTableCell>
      <PTableCell>
        <PButtonPure icon="edit" hideLabel onClick={() => onEdit(bike)}>
          Edit
        </PButtonPure>
      </PTableCell>
    </PTableRow>
  );
}
