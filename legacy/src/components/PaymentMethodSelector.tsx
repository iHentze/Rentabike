import {
  PSegmentedControl,
  PSegmentedControlItem,
} from '@porsche-design-system/components-react';
import type { PaymentMethod } from '../types';

interface PaymentMethodSelectorProps {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
}

export function PaymentMethodSelector({ value, onChange }: PaymentMethodSelectorProps) {
  return (
    <PSegmentedControl
      value={value}
      onChange={(e) => onChange(e.detail.value as PaymentMethod)}
      label="Payment Method"
      hideLabel
    >
      <PSegmentedControlItem value="card_online" icon="card">
        Pay by card
      </PSegmentedControlItem>
      <PSegmentedControlItem value="at_pickup" icon="home">
        Pay at pickup
      </PSegmentedControlItem>
    </PSegmentedControl>
  );
}
