import {
  PButton,
  PTag,
  PText,
  PHeading,
  PIcon,
} from '@porsche-design-system/components-react';
import type { Bike } from '../types';
import { useCart } from '../store/cartStore';

interface BikeCardProps {
  bike: Bike;
  onSelect?: (bike: Bike) => void;
}

const CATEGORY_COLORS: Record<string, 'primary' | 'success' | 'info' | 'warning' | 'secondary'> = {
  'e-bikes': 'success',
  'mountain-bikes': 'info',
  'gravel-bikes': 'warning',
  'road-bikes': 'primary',
  'children-bikes': 'secondary',
  accessories: 'secondary',
};

function BikeImage({ bike }: { bike: Bike }) {
  if (bike.image_url) {
    return (
      <img
        src={bike.image_url}
        alt={bike.name}
        loading="lazy"
        decoding="async"
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    );
  }

  const icons: Record<string, string> = {
    'e-bikes': 'flash',
    'mountain-bikes': 'country-road',
    'gravel-bikes': 'highway',
    'road-bikes': 'car',
    'children-bikes': 'heart',
    accessories: 'attachment',
  };
  const slug = bike.category?.slug || '';
  const iconName = icons[slug] || 'car';

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--p-color-background-surface)',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <PIcon name={iconName as never} size="x-large" color="contrast-medium" />
    </div>
  );
}

export function BikeCard({ bike, onSelect }: BikeCardProps) {
  const { addItem, rentalDays } = useCart();
  const categorySlug = bike.category?.slug || '';
  const tagVariant = CATEGORY_COLORS[categorySlug] || 'secondary';
  const isUnavailable = bike.available_quantity !== undefined && bike.available_quantity <= 0;

  function handleAdd(e: React.MouseEvent) {
    e.stopPropagation();
    if (isUnavailable) return;
    addItem(bike, 1);
  }

  return (
    <div
      onClick={() => onSelect?.(bike)}
      style={{
        borderRadius: 'var(--p-border-radius-lg)',
        overflow: 'hidden',
        border: '1px solid var(--p-color-contrast-low)',
        backgroundColor: 'var(--p-color-background-base)',
        display: 'flex',
        flexDirection: 'column',
        cursor: onSelect ? 'pointer' : 'default',
        transition: 'box-shadow 0.2s ease, transform 0.2s ease',
      }}
      onMouseEnter={(e) => {
        if (onSelect) {
          (e.currentTarget as HTMLDivElement).style.boxShadow = '0px 8px 24px rgba(0,0,0,0.12)';
          (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
      }}
    >
      <div style={{ height: '200px', position: 'relative', overflow: 'hidden' }}>
        <BikeImage bike={bike} />
        <div style={{ position: 'absolute', top: '12px', left: '12px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <PTag variant={tagVariant} compact>
            {bike.category?.name || 'Bike'}
          </PTag>
          {isUnavailable && (
            <PTag variant="error" compact>
              Unavailable
            </PTag>
          )}
        </div>
      </div>

      <div className="p-fluid-sm" style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
        <PHeading size="small" tag="h3" style={{ margin: 0 }}>
          {bike.name}
        </PHeading>

        {bike.size && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <PIcon name="arrows" size="x-small" color="contrast-medium" />
            <PText size="x-small" color="contrast-medium">
              Size {bike.size}
            </PText>
          </div>
        )}

        <PText
          size="x-small"
          color="contrast-medium"
          style={{
            flex: 1,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {bike.description}
        </PText>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '8px',
            borderTop: '1px solid var(--p-color-contrast-low)',
            gap: '8px',
          }}
        >
          <div>
            <PText size="large" weight="bold">
              {bike.price_per_day} DKK
            </PText>
            <PText size="x-small" color="contrast-medium">
              per day{rentalDays > 0 ? ` · ${(bike.price_per_day * rentalDays).toLocaleString()} DKK total` : ''}
            </PText>
          </div>

          <PButton
            icon="add"
            compact
            disabled={isUnavailable}
            onClick={handleAdd}
            aria={{ 'aria-label': `Add ${bike.name} to cart` }}
          >
            Add
          </PButton>
        </div>
      </div>
    </div>
  );
}
