import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

interface FixedBottomBarProps {
  children: ReactNode;
}

const portalRoot = document.getElementById('portal-root')!;

export function FixedBottomBar({ children }: FixedBottomBarProps) {
  return createPortal(children, portalRoot);
}
