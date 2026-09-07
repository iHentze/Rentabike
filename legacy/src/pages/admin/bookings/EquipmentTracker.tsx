import { useState } from 'react';
import {
  PButton,
  PButtonGroup,
  PText,
  PTag,
  PIcon,
} from '@porsche-design-system/components-react';
import { supabase } from '../../../lib/supabase';
import type { Booking, BookingItem, ItemStatus } from '../../../types';

interface EquipmentTrackerProps {
  booking: Booking;
  onUpdated: () => void;
  onFeedback: (type: 'success' | 'error', msg: string) => void;
  disabled?: boolean;
}

const ITEM_STATUS_CONFIG: Record<ItemStatus, { label: string; variant: 'success' | 'warning' | 'error' | 'primary' | undefined }> = {
  pending: { label: 'Pending', variant: 'warning' },
  picked_up: { label: 'Picked up', variant: 'primary' },
  returned: { label: 'Returned', variant: 'success' },
  released: { label: 'Released', variant: 'error' },
};

function ItemStatusTag({ status }: { status: ItemStatus }) {
  const config = ITEM_STATUS_CONFIG[status];
  return <PTag variant={config.variant} compact>{config.label}</PTag>;
}

export function EquipmentTracker({ booking, onUpdated, onFeedback, disabled }: EquipmentTrackerProps) {
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [busyAll, setBusyAll] = useState(false);

  const items = booking.items || [];
  const canTrackItems = booking.status === 'confirmed' || booking.status === 'picked_up';
  const pendingItems = items.filter((i) => i.item_status === 'pending');
  const pickedUpItems = items.filter((i) => i.item_status === 'picked_up');
  const hasActionableItems = pendingItems.length > 0 || pickedUpItems.length > 0;

  if (items.length === 0) return null;

  const updateItem = async (itemId: string, newStatus: ItemStatus) => {
    setBusyItemId(itemId);
    try {
      const { error } = await supabase
        .from('booking_items')
        .update({ item_status: newStatus })
        .eq('id', itemId);
      if (error) throw error;
      onFeedback('success', `Item ${ITEM_STATUS_CONFIG[newStatus].label.toLowerCase()}`);
      onUpdated();
    } catch (err) {
      onFeedback('error', err instanceof Error ? err.message : 'Failed to update item');
    } finally {
      setBusyItemId(null);
    }
  };

  const updateAll = async (newStatus: ItemStatus, filterStatus: ItemStatus) => {
    setBusyAll(true);
    try {
      const { error } = await supabase
        .from('booking_items')
        .update({ item_status: newStatus })
        .eq('booking_id', booking.id)
        .eq('item_status', filterStatus);
      if (error) throw error;
      onFeedback('success', `All items ${ITEM_STATUS_CONFIG[newStatus].label.toLowerCase()}`);
      onUpdated();
    } catch (err) {
      onFeedback('error', err instanceof Error ? err.message : 'Failed to update items');
    } finally {
      setBusyAll(false);
    }
  };

  const isBusy = busyItemId !== null || busyAll || disabled;

  function getItemActions(item: BookingItem) {
    if (!canTrackItems) return [];
    const actions: { label: string; status: ItemStatus; icon: string; variant?: 'primary' | 'secondary' | 'tertiary' }[] = [];

    if (item.item_status === 'pending') {
      actions.push({ label: 'Pick up', status: 'picked_up', icon: 'arrow-head-up' });
      actions.push({ label: 'Release', status: 'released', icon: 'close', variant: 'tertiary' });
    }
    if (item.item_status === 'picked_up') {
      actions.push({ label: 'Return', status: 'returned', icon: 'arrow-head-down' });
    }

    return actions;
  }

  return (
    <div className="flex flex-col gap-static-sm">
      {canTrackItems && hasActionableItems && (
        <div className="flex gap-static-sm flex-wrap">
          {pendingItems.length > 1 && (
            <PButton
              variant="secondary"
              compact
              icon="arrow-head-up"
              loading={busyAll}
              disabled={isBusy}
              onClick={() => updateAll('picked_up', 'pending')}
            >
              Pick up all ({pendingItems.length})
            </PButton>
          )}
          {pickedUpItems.length > 1 && (
            <PButton
              variant="secondary"
              compact
              icon="arrow-head-down"
              loading={busyAll}
              disabled={isBusy}
              onClick={() => updateAll('returned', 'picked_up')}
            >
              Return all ({pickedUpItems.length})
            </PButton>
          )}
          {pendingItems.length > 1 && (
            <PButton
              variant="tertiary"
              compact
              icon="close"
              loading={busyAll}
              disabled={isBusy}
              onClick={() => updateAll('released', 'pending')}
            >
              Release all ({pendingItems.length})
            </PButton>
          )}
        </div>
      )}

      <div className="flex flex-col gap-static-xs">
        {items.map((item) => {
          const actions = getItemActions(item);
          const isItemBusy = busyItemId === item.id;

          return (
            <div
              key={item.id}
              className="flex items-center justify-between gap-static-sm p-static-sm rounded-[var(--p-border-radius-md)] border border-[color:var(--p-color-contrast-low)]"
            >
              <div className="flex items-center gap-static-sm min-w-0">
                <PIcon name="configurate" size="small" color="contrast-medium" />
                <div className="min-w-0">
                  <PText size="small" weight="semi-bold">
                    {item.quantity}x {item.bike?.name || 'Unknown'}
                  </PText>
                  {item.bike?.size && (
                    <PText size="x-small" color="contrast-medium">Size: {item.bike.size}</PText>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-static-xs shrink-0">
                <ItemStatusTag status={item.item_status} />
                {actions.length > 0 && (
                  <PButtonGroup>
                    {actions.map((action) => (
                      <PButton
                        key={action.status}
                        variant={action.variant || 'secondary'}
                        compact
                        icon={action.icon as never}
                        loading={isItemBusy}
                        disabled={isBusy}
                        onClick={() => updateItem(item.id, action.status)}
                        aria={{ 'aria-label': `${action.label} ${item.bike?.name}` }}
                      >
                        {action.label}
                      </PButton>
                    ))}
                  </PButtonGroup>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
