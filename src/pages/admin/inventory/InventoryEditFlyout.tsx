import { useState, useEffect } from 'react';
import {
  PFlyout,
  PHeading,
  PButton,
  PTextFieldWrapper,
  PSelect,
  PSelectOption,
  PSwitch,
} from '@porsche-design-system/components-react';
import type { Bike, Category } from '../../../types';

interface InventoryEditFlyoutProps {
  bike: Bike | null;
  categories: Category[];
  open: boolean;
  onDismiss: () => void;
  onSave: (data: Partial<Bike>) => void;
  onDelete?: () => void;
}

const EMPTY: Partial<Bike> = {
  name: '',
  category_id: '',
  description: '',
  price_per_day: 0,
  size: '',
  total_quantity: 1,
  image_url: '',
  is_active: true,
};

export function InventoryEditFlyout({
  bike,
  categories,
  open,
  onDismiss,
  onSave,
  onDelete,
}: InventoryEditFlyoutProps) {
  const [form, setForm] = useState<Partial<Bike>>(EMPTY);

  useEffect(() => {
    if (bike) {
      setForm({
        name: bike.name,
        category_id: bike.category_id,
        description: bike.description,
        price_per_day: bike.price_per_day,
        size: bike.size,
        total_quantity: bike.total_quantity,
        image_url: bike.image_url,
        is_active: bike.is_active,
      });
    } else {
      setForm(EMPTY);
    }
  }, [bike, open]);

  function update(field: string, value: string | number | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <PFlyout open={open} onDismiss={onDismiss} aria={{ 'aria-label': bike ? 'Edit Item' : 'Add Item' }}>
      <div slot="header">
        <PHeading size="medium" tag="h2">{bike ? 'Edit Item' : 'Add Item'}</PHeading>
      </div>

      <div className="flex flex-col gap-static-md">
        <PTextFieldWrapper label="Name">
          <input type="text" value={form.name || ''} onChange={(e) => update('name', e.target.value)} />
        </PTextFieldWrapper>

        <PSelect
          label="Category"
          name="category"
          value={form.category_id || ''}
          onChange={(e) => update('category_id', e.detail.value)}
        >
          {categories.map((c) => (
            <PSelectOption key={c.id} value={c.id}>{c.name}</PSelectOption>
          ))}
        </PSelect>

        <PTextFieldWrapper label="Size">
          <input type="text" value={form.size || ''} onChange={(e) => update('size', e.target.value)} />
        </PTextFieldWrapper>

        <PTextFieldWrapper label="Description">
          <input type="text" value={form.description || ''} onChange={(e) => update('description', e.target.value)} />
        </PTextFieldWrapper>

        <PTextFieldWrapper label="Price per Day (DKK)">
          <input
            type="number"
            value={form.price_per_day || 0}
            onChange={(e) => update('price_per_day', Number(e.target.value))}
          />
        </PTextFieldWrapper>

        <PTextFieldWrapper label="Quantity">
          <input
            type="number"
            value={form.total_quantity || 1}
            onChange={(e) => update('total_quantity', Number(e.target.value))}
          />
        </PTextFieldWrapper>

        <PTextFieldWrapper label="Image URL">
          <input type="text" value={form.image_url || ''} onChange={(e) => update('image_url', e.target.value)} />
        </PTextFieldWrapper>

        <PSwitch checked={form.is_active ?? true} onUpdate={(e) => update('is_active', e.detail.checked)}>
          Active
        </PSwitch>
      </div>

      <div slot="footer" className="flex gap-static-sm">
        <PButton onClick={() => onSave(form)}>
          {bike ? 'Save Changes' : 'Create Item'}
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
