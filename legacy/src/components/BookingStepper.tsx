import {
  PStepperHorizontal,
  PStepperHorizontalItem,
} from '@porsche-design-system/components-react';
import { useCart } from '../store/cartStore';
import type { Page } from '../types';

interface BookingStepperProps {
  currentStep: 0 | 1 | 2;
  onNavigate: (page: Page) => void;
  theme?: 'light' | 'dark';
}

const STEP_PAGES: Page[] = ['booking-setup', 'person-catalog', 'checkout'];

export function BookingStepper({ currentStep, onNavigate, theme }: BookingStepperProps) {
  const { startDate, endDate, persons, items } = useCart();

  const hasBookingSetup = !!(startDate && endDate && persons.length > 0);
  const hasItems = items.length > 0;

  function getStepState(index: number): 'current' | 'complete' | 'warning' | undefined {
    if (index === currentStep) return 'current';
    if (index < currentStep) return 'complete';
    if (index === 1 && hasBookingSetup) return 'warning';
    if (index === 2 && hasItems) return 'warning';
    return undefined;
  }

  function canNavigateTo(index: number): boolean {
    if (index === currentStep) return false;
    if (index === 0) return true;
    if (index === 1) return hasBookingSetup;
    if (index === 2) return hasItems;
    return false;
  }

  function handleStepClick(e: CustomEvent) {
    const targetIndex = e.detail.activeStepIndex;
    if (canNavigateTo(targetIndex)) {
      onNavigate(STEP_PAGES[targetIndex]);
    }
  }

  return (
    <PStepperHorizontal onUpdate={handleStepClick} theme={theme}>
      <PStepperHorizontalItem state={getStepState(0)}>
        Booking Setup
      </PStepperHorizontalItem>
      <PStepperHorizontalItem
        state={getStepState(1)}
        disabled={!hasBookingSetup && currentStep < 1}
      >
        Select Equipment
      </PStepperHorizontalItem>
      <PStepperHorizontalItem
        state={getStepState(2)}
        disabled={!hasItems && currentStep < 2}
      >
        Confirm & Pay
      </PStepperHorizontalItem>
    </PStepperHorizontal>
  );
}
