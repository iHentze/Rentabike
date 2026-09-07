import { useState } from 'react';
import { PTag, PHeading, PButtonPure, PIcon, PDivider } from '@porsche-design-system/components-react';
import { useBookings } from '../../hooks/useBookings';
import { useInventory } from '../../hooks/useInventory';
import { useTours } from '../../hooks/useTours';
import { useLocations } from '../../hooks/useLocations';
import { AdminSidebar } from './AdminSidebar';
import { OverviewSection } from './overview/OverviewSection';
import { BookingsSection } from './bookings/BookingsSection';
import { CalendarSection } from './calendar/CalendarSection';
import { ToursSection } from './tours/ToursSection';
import { InventorySection } from './inventory/InventorySection';
import { LocationsSection } from './locations/LocationsSection';
import type { AdminSection } from './types';

interface AdminLayoutProps {
  onSignOut: () => void;
}

export function AdminLayout({ onSignOut }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeSection, setActiveSection] = useState<AdminSection>('overview');
  const { bookings, loading, refresh, updateStatus, updateMsg } = useBookings();
  const inventory = useInventory();
  const toursHook = useTours();
  const locationsHook = useLocations();

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      {sidebarOpen && (
        <aside className="w-[260px] shrink-0 border-r border-contrast-low bg-surface flex flex-col">
          <div className="flex items-center gap-static-sm p-static-md">
            <PIcon name="garage" size="medium" />
            <PHeading size="small" tag="h2">Bike Rental Admin</PHeading>
          </div>
          <PDivider />
          <div className="flex-1 overflow-y-auto px-static-sm">
            <AdminSidebar
              activeSection={activeSection}
              onSectionChange={setActiveSection}
              onSignOut={onSignOut}
            />
          </div>
        </aside>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center gap-static-sm px-static-md py-static-sm border-b border-contrast-low bg-surface shrink-0">
          <PButtonPure
            icon={sidebarOpen ? 'arrow-head-left' : 'menu-lines'}
            hideLabel
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            Toggle sidebar
          </PButtonPure>

          <div className="flex-1" />

          {updateMsg && (
            <PTag variant="success" icon="check">
              {updateMsg}
            </PTag>
          )}
        </header>

        <main className="flex-1 overflow-y-auto p-fluid-md">
          {activeSection === 'overview' && (
            <OverviewSection
              bookings={bookings}
              loading={loading}
              onRefresh={refresh}
              onNavigateToBookings={() => setActiveSection('bookings')}
            />
          )}
          {activeSection === 'bookings' && (
            <BookingsSection
              bookings={bookings}
              loading={loading}
              onRefresh={refresh}
              updateStatus={updateStatus}
            />
          )}
          {activeSection === 'calendar' && (
            <CalendarSection
              bookings={bookings}
              loading={loading}
              onRefresh={refresh}
              onStatusUpdated={refresh}
            />
          )}
          {activeSection === 'tours' && (
            <ToursSection
              tours={toursHook.tours}
              loading={toursHook.loading}
              bikes={inventory.bikes}
              categories={inventory.categories}
              onRefresh={() => { toursHook.refresh(); inventory.refresh(); }}
              onCreateTour={toursHook.createTour}
              onUpdateTour={toursHook.updateTour}
              onDeleteTour={toursHook.deleteTour}
              onSetAllowedBikes={toursHook.setAllowedBikes}
              onCreateTourDate={toursHook.createTourDate}
              onUpdateTourDate={toursHook.updateTourDate}
              onDeleteTourDate={toursHook.deleteTourDate}
            />
          )}
          {activeSection === 'inventory' && (
            <InventorySection
              bikes={inventory.bikes}
              categories={inventory.categories}
              loading={inventory.loading}
              onRefresh={inventory.refresh}
              onUpdateBike={inventory.updateBike}
              onCreateBike={inventory.createBike}
              onDeleteBike={inventory.deleteBike}
            />
          )}
          {activeSection === 'locations' && (
            <LocationsSection
              locations={locationsHook.locations}
              loading={locationsHook.loading}
              onRefresh={locationsHook.refresh}
              onCreateLocation={locationsHook.createLocation}
              onUpdateLocation={locationsHook.updateLocation}
              onDeleteLocation={locationsHook.deleteLocation}
            />
          )}
        </main>
      </div>
    </div>
  );
}
