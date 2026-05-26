import { PButtonPure, PDivider, PText } from '@porsche-design-system/components-react';
import type { AdminSection } from './types';

interface AdminSidebarProps {
  activeSection: AdminSection;
  onSectionChange: (section: AdminSection) => void;
  onSignOut: () => void;
}

const NAV_ITEMS: { section: AdminSection; label: string; icon: string }[] = [
  { section: 'overview', label: 'Overview', icon: 'home' },
  { section: 'bookings', label: 'Bookings', icon: 'list' },
  { section: 'calendar', label: 'Calendar', icon: 'calendar' },
  { section: 'tours', label: 'Guided Tours', icon: 'map' },
  { section: 'inventory', label: 'Inventory', icon: 'configurate' },
  { section: 'locations', label: 'Locations', icon: 'locate' },
];

export function AdminSidebar({ activeSection, onSectionChange, onSignOut }: AdminSidebarProps) {
  return (
    <div className="flex flex-col h-full">
      <nav className="flex flex-col gap-static-xs py-static-sm">
        <PText size="x-small" color="contrast-medium" className="px-static-sm pb-static-xs">
          Navigation
        </PText>
        {NAV_ITEMS.map((item) => (
          <PButtonPure
            key={item.section}
            icon={item.icon as never}
            active={activeSection === item.section}
            onClick={() => onSectionChange(item.section)}
            stretch
            alignLabel="start"
            size="medium"
          >
            {item.label}
          </PButtonPure>
        ))}
      </nav>

      <div className="mt-auto">
        <PDivider className="my-static-sm" />
        <PButtonPure
          icon="logout"
          onClick={onSignOut}
          stretch
          alignLabel="start"
          size="medium"
        >
          Sign Out
        </PButtonPure>
      </div>
    </div>
  );
}
