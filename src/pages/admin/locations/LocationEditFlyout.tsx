import { useState, useEffect } from 'react';
import {
  PFlyout,
  PHeading,
  PButton,
  PTextFieldWrapper,
  PSwitch,
} from '@porsche-design-system/components-react';
import type { Location } from '../../../types';

interface LocationEditFlyoutProps {
  location: Location | null;
  open: boolean;
  onDismiss: () => void;
  onSave: (data: Omit<Location, 'id' | 'created_at'>) => void;
  onDelete?: () => void;
}

const EMPTY: Omit<Location, 'id' | 'created_at'> = {
  name: '',
  slug: '',
  address: '',
  phone: '',
  pickup_fee: 0,
  dropoff_fee: 0,
  opening_hour: 8,
  closing_hour: 18,
  is_active: true,
  sort_order: 0,
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function LocationEditFlyout({
  location,
  open,
  onDismiss,
  onSave,
  onDelete,
}: LocationEditFlyoutProps) {
  const [form, setForm] = useState<Omit<Location, 'id' | 'created_at'>>(EMPTY);

  useEffect(() => {
    if (location) {
      setForm({
        name: location.name,
        slug: location.slug,
        address: location.address,
        phone: location.phone,
        pickup_fee: location.pickup_fee,
        dropoff_fee: location.dropoff_fee,
        opening_hour: location.opening_hour,
        closing_hour: location.closing_hour,
        is_active: location.is_active,
        sort_order: location.sort_order,
      });
    } else {
      setForm(EMPTY);
    }
  }, [location, open]);

  function update(field: string, value: string | number | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleNameChange(value: string) {
    setForm((prev) => ({
      ...prev,
      name: value,
      slug: location ? prev.slug : slugify(value),
    }));
  }

  return (
    <PFlyout open={open} onDismiss={onDismiss} aria={{ 'aria-label': location ? 'Edit Location' : 'Add Location' }}>
      <div slot="header">
        <PHeading size="medium" tag="h2">{location ? 'Edit Location' : 'Add Location'}</PHeading>
      </div>

      <div className="flex flex-col gap-static-md">
        <PTextFieldWrapper label="Name">
          <input type="text" value={form.name} onChange={(e) => handleNameChange(e.target.value)} />
        </PTextFieldWrapper>

        <PTextFieldWrapper label="Slug" description="Unique identifier used internally">
          <input type="text" value={form.slug} onChange={(e) => update('slug', e.target.value)} />
        </PTextFieldWrapper>

        <PTextFieldWrapper label="Address">
          <input type="text" value={form.address} onChange={(e) => update('address', e.target.value)} />
        </PTextFieldWrapper>

        <PTextFieldWrapper label="Phone">
          <input type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} />
        </PTextFieldWrapper>

        <div className="grid grid-cols-2 gap-static-sm">
          <PTextFieldWrapper label="Pickup Fee (DKK)">
            <input
              type="number"
              min="0"
              value={form.pickup_fee}
              onChange={(e) => update('pickup_fee', Number(e.target.value))}
            />
          </PTextFieldWrapper>

          <PTextFieldWrapper label="Dropoff Fee (DKK)">
            <input
              type="number"
              min="0"
              value={form.dropoff_fee}
              onChange={(e) => update('dropoff_fee', Number(e.target.value))}
            />
          </PTextFieldWrapper>
        </div>

        <PTextFieldWrapper label="Sort Order">
          <input
            type="number"
            value={form.sort_order}
            onChange={(e) => update('sort_order', Number(e.target.value))}
          />
        </PTextFieldWrapper>

        <PSwitch checked={form.is_active} onUpdate={(e) => update('is_active', e.detail.checked)}>
          Active
        </PSwitch>
      </div>

      <div slot="footer" className="flex gap-static-sm">
        <PButton onClick={() => onSave(form)} disabled={!form.name || !form.slug}>
          {location ? 'Save Changes' : 'Create Location'}
        </PButton>
        {onDelete && (
          <PButton variant="secondary" icon="delete" onClick={onDelete}>
            Delete
          </PButton>
        )}
      </div>
    </PFlyout>
  );
}
