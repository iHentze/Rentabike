import type { ReactNode } from 'react';
import {
  motionDurationModerate,
  motionEasingIn,
} from '@porsche-design-system/components-react/styles';

interface PageTransitionProps {
  pageKey: string;
  children: ReactNode;
}

export function PageTransition({ pageKey, children }: PageTransitionProps) {
  return (
    <div
      key={pageKey}
      style={{
        animation: `pageFadeIn ${motionDurationModerate} ${motionEasingIn} both`,
      }}
    >
      {children}
    </div>
  );
}
