import {
  PTable,
  PTableHead,
  PTableHeadRow,
  PTableHeadCell,
  PTableBody,
  PText,
} from '@porsche-design-system/components-react';
import { InventoryRow } from './InventoryRow';
import type { Bike } from '../../../types';

interface InventoryTableProps {
  bikes: Bike[];
  onToggleActive: (id: string, active: boolean) => void;
  onEdit: (bike: Bike) => void;
}

export function InventoryTable({ bikes, onToggleActive, onEdit }: InventoryTableProps) {
  if (bikes.length === 0) {
    return (
      <div className="text-center py-fluid-lg">
        <PText color="contrast-medium">No items found</PText>
      </div>
    );
  }

  return (
    <PTable caption="Inventory items">
      <PTableHead>
        <PTableHeadRow>
          <PTableHeadCell style={{ width: '60px' }}></PTableHeadCell>
          <PTableHeadCell>Name</PTableHeadCell>
          <PTableHeadCell>Category</PTableHeadCell>
          <PTableHeadCell>Size</PTableHeadCell>
          <PTableHeadCell>Price/Day</PTableHeadCell>
          <PTableHeadCell>Total</PTableHeadCell>
          <PTableHeadCell>Available</PTableHeadCell>
          <PTableHeadCell>Active</PTableHeadCell>
          <PTableHeadCell>Actions</PTableHeadCell>
        </PTableHeadRow>
      </PTableHead>
      <PTableBody>
        {bikes.map((bike) => (
          <InventoryRow
            key={bike.id}
            bike={bike}
            onToggleActive={onToggleActive}
            onEdit={onEdit}
          />
        ))}
      </PTableBody>
    </PTable>
  );
}
