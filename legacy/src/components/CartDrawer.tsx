import {
  PModal,
  PHeading,
  PText,
  PButton,
  PDivider,
  PIcon,
} from '@porsche-design-system/components-react';
import { useCart } from '../store/cartStore';
import type { Page } from '../types';

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (page: Page) => void;
}

function QuantityControl({
  quantity,
  onDecrease,
  onIncrease,
}: {
  quantity: number;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <button
        onClick={onDecrease}
        style={{
          width: '28px',
          height: '28px',
          border: '1px solid var(--p-color-contrast-low)',
          borderRadius: '4px',
          background: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '16px',
          lineHeight: 1,
        }}
      >
        −
      </button>
      <PText size="small" style={{ minWidth: '24px', textAlign: 'center' }}>
        {quantity}
      </PText>
      <button
        onClick={onIncrease}
        style={{
          width: '28px',
          height: '28px',
          border: '1px solid var(--p-color-contrast-low)',
          borderRadius: '4px',
          background: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '16px',
          lineHeight: 1,
        }}
      >
        +
      </button>
    </div>
  );
}

interface CartItemRowProps {
  bikeName: string;
  bikeSize?: string;
  imageUrl?: string;
  quantity: number;
  pricePerDay: number;
  rentalDays: number;
  onDecrease: () => void;
  onIncrease: () => void;
  onRemove: () => void;
}

function CartItemRow({
  bikeName,
  bikeSize,
  imageUrl,
  quantity,
  pricePerDay,
  rentalDays,
  onDecrease,
  onIncrease,
  onRemove,
}: CartItemRowProps) {
  return (
    <div
      style={{
        border: '1px solid var(--p-color-contrast-low)',
        borderRadius: 'var(--p-border-radius-md)',
        padding: '12px',
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-start',
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: 'var(--p-border-radius-sm)',
          backgroundColor: 'var(--p-color-background-surface)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {imageUrl ? (
          <img src={imageUrl} alt={bikeName} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <PIcon name="car" size="small" color="contrast-medium" />
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <PText size="small" weight="semi-bold" style={{ marginBottom: '2px' }}>
          {bikeName}
        </PText>
        {bikeSize && (
          <PText size="x-small" color="contrast-medium">
            Size: {bikeSize}
          </PText>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
          <QuantityControl quantity={quantity} onDecrease={onDecrease} onIncrease={onIncrease} />
          <PText size="x-small" color="contrast-medium" style={{ flex: 1 }}>
            {pricePerDay} DKK/day
          </PText>
          {rentalDays > 0 && (
            <PText size="small" weight="semi-bold">
              {(pricePerDay * quantity * rentalDays).toLocaleString()} DKK
            </PText>
          )}
        </div>
      </div>

      <button
        onClick={onRemove}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', flexShrink: 0 }}
        aria-label="Remove item"
      >
        <PIcon name="close" size="small" color="contrast-medium" />
      </button>
    </div>
  );
}

export function CartDrawer({ open, onClose, onNavigate }: CartDrawerProps) {
  const { items, startDate, endDate, startTime, endTime, rentalDays, totalPrice, removeItem, updateQuantity } = useCart();

  function handleCheckout() {
    onClose();
    onNavigate('checkout');
  }

  const hasNoDates = !startDate || !endDate;

  return (
    <PModal
      open={open}
      onDismiss={onClose}
      fullscreen={{ base: true, s: false }}
      style={{ '--p-modal-width': '520px' } as React.CSSProperties}
    >
      <PHeading slot="header" size="medium" tag="h2">
        Your Rental Cart
      </PHeading>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {startDate && endDate && (
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: 'var(--p-color-background-surface)',
              borderRadius: 'var(--p-border-radius-md)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <PIcon name="calendar" size="small" />
            <div>
              <PText size="small" weight="semi-bold">
                {new Date(startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                {startTime ? `, ${startTime}` : ''}
                {' → '}
                {new Date(endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                {endTime ? `, ${endTime}` : ''}
              </PText>
              <PText size="x-small" color="contrast-medium">
                {rentalDays} {rentalDays === 1 ? 'day' : 'days'}
              </PText>
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 16px' }}>
            <PIcon name="heart" size="x-large" color="contrast-low" />
            <PText size="medium" color="contrast-medium" style={{ marginTop: '16px' }}>
              Your cart is empty
            </PText>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {items.map((item) => (
              <CartItemRow
                key={`${item.bike.id}-${item.personIndex}`}
                bikeName={item.bike.name}
                bikeSize={item.bike.size}
                imageUrl={item.bike.image_url}
                quantity={item.quantity}
                pricePerDay={item.bike.price_per_day}
                rentalDays={rentalDays}
                onDecrease={() => updateQuantity(item.bike.id, item.quantity - 1, item.personIndex)}
                onIncrease={() => updateQuantity(item.bike.id, item.quantity + 1, item.personIndex)}
                onRemove={() => removeItem(item.bike.id, item.personIndex)}
              />
            ))}
          </div>
        )}

        {items.length > 0 && rentalDays > 0 && (
          <>
            <PDivider />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <PText size="medium">Total ({rentalDays} {rentalDays === 1 ? 'day' : 'days'})</PText>
              <PHeading size="medium">{totalPrice.toLocaleString()} DKK</PHeading>
            </div>
          </>
        )}
      </div>

      <div slot="footer" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
        <PButton variant="secondary" onClick={onClose}>
          Continue
        </PButton>
        <PButton
          onClick={handleCheckout}
          disabled={items.length === 0 || hasNoDates || rentalDays <= 0}
        >
          Checkout
        </PButton>
      </div>
    </PModal>
  );
}
