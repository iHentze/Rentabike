import { PText, PDivider, PLinkPure } from '@porsche-design-system/components-react';
import { themeLightBackgroundSurface } from '@porsche-design-system/components-react/styles';
import type { Page } from '../types';

interface FooterProps {
  onNavigate?: (page: Page) => void;
}

export function Footer({ onNavigate }: FooterProps) {
  return (
    <footer style={{ backgroundColor: themeLightBackgroundSurface, marginTop: 'auto' }}>
      <PDivider />
      <div
        className="p-fluid-lg"
        style={{
          maxWidth: '1400px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
          gap: '32px',
        }}
      >
        <div>
          <PText weight="bold" size="medium" style={{ marginBottom: '12px' }}>
            RentABike.fo
          </PText>
          <PText size="small" color="contrast-medium">
            Sverrisgøta 20
            <br />
            FO-100 Tórshavn
            <br />
            Faroe Islands
          </PText>
          <PText size="small" color="contrast-medium" style={{ marginTop: '8px' }}>
            (+298) 270600
            <br />
            rentabike@rentabike.fo
          </PText>
        </div>

        <div>
          <PText weight="bold" size="small" style={{ marginBottom: '12px' }}>
            Opening Hours
          </PText>
          <PText size="small" color="contrast-medium">
            Mon–Thu: 10:00 – 17:30
            <br />
            Friday: 10:00 – 18:00
            <br />
            Saturday: 10:00 – 15:00
            <br />
            Sunday: Closed
          </PText>
        </div>

        <div>
          <PText weight="bold" size="small" style={{ marginBottom: '12px' }}>
            Quick Links
          </PText>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <PLinkPure
              href="#"
              icon="none"
              size="small"
              onClick={(e) => {
                e.preventDefault();
                onNavigate?.('tours');
              }}
            >
              Guided Tours
            </PLinkPure>
            <PLinkPure
              href="#"
              icon="none"
              size="small"
              onClick={(e) => {
                e.preventDefault();
                onNavigate?.('booking-setup');
              }}
            >
              Rent a Bike
            </PLinkPure>
            <PLinkPure
              href="#"
              icon="none"
              size="small"
              onClick={(e) => {
                e.preventDefault();
                onNavigate?.('my-booking');
              }}
            >
              My Booking
            </PLinkPure>
          </div>
        </div>
      </div>

      <PDivider />
      <div
        className="p-fluid-sm"
        style={{ maxWidth: '1400px', margin: '0 auto', textAlign: 'center' }}
      >
        <PText size="x-small" color="contrast-medium">
          © {new Date().getFullYear()} RentABike.fo — All rights reserved
        </PText>
      </div>
    </footer>
  );
}
