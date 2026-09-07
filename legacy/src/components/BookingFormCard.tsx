import type { ComponentProps, CSSProperties, ReactNode } from 'react';
import { PHeading, PIcon } from '@porsche-design-system/components-react';
import {
  borderRadiusLarge,
  borderRadiusMedium,
  spacingFluidMedium,
  spacingFluidSmall,
  dropShadowLowStyle,
} from '@porsche-design-system/components-react/styles';

interface BookingFormCardProps {
  icon: ComponentProps<typeof PIcon>['name'];
  title: string;
  children: ReactNode;
  style?: CSSProperties;
}

export function BookingFormCard({ icon, title, children, style }: BookingFormCardProps) {
  return (
    <section
      style={{
        backgroundColor: 'var(--p-color-background-base)',
        borderRadius: borderRadiusLarge,
        padding: spacingFluidMedium,
        ...dropShadowLowStyle,
        ...style,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacingFluidSmall,
          marginBottom: spacingFluidSmall,
          paddingBottom: spacingFluidSmall,
          borderBottom: '1px solid var(--p-color-contrast-low)',
        }}
      >
        <div
          style={{
            width: '44px',
            height: '44px',
            borderRadius: borderRadiusMedium,
            backgroundColor: 'var(--p-color-background-surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <PIcon name={icon} size="small" />
        </div>
        <PHeading size="medium" tag="h2">{title}</PHeading>
      </div>
      {children}
    </section>
  );
}
