import { PTag } from '@porsche-design-system/components-react';

const STATUS_CONFIG: Record<string, { variant: 'success' | 'warning' | 'error' | 'primary' | undefined; label: string }> = {
  confirmed: { variant: 'success', label: 'confirmed' },
  pending: { variant: 'warning', label: 'pending' },
  cancelled: { variant: 'error', label: 'cancelled' },
  picked_up: { variant: 'primary', label: 'picked up' },
  returned: { variant: undefined, label: 'returned' },
};

export function StatusTag({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || { variant: undefined, label: status };
  return <PTag variant={config.variant} compact>{config.label}</PTag>;
}
