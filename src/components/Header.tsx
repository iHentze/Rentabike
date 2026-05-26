import { useState, useEffect } from 'react';
import {
  PText,
  PIcon,
  PFlyout,
  PButtonPure,
} from '@porsche-design-system/components-react';
import { useCart } from '../store/cartStore';
import type { Page } from '../types';

interface HeaderProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const NAV_LINKS: { label: string; page: Page }[] = [
  { label: 'Home', page: 'home' },
  { label: 'Rent a Bike', page: 'booking-setup' },
  { label: 'Guided Tours', page: 'tours' },
  { label: 'My Booking', page: 'my-booking' },
  { label: 'Admin', page: 'admin' },
];

export function Header({ currentPage, onNavigate }: HeaderProps) {
  const { totalItems, persons } = useCart();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 40);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isHero = currentPage === 'home';
  const transparent = isHero && !scrolled;

  function handleNav(page: Page) {
    onNavigate(page);
    setMobileOpen(false);
  }

  const bookingLabel =
    persons.length > 0 && totalItems > 0
      ? `${totalItems} item${totalItems !== 1 ? 's' : ''} · ${persons.length} ${persons.length === 1 ? 'person' : 'people'}`
      : totalItems > 0
      ? `${totalItems} item${totalItems !== 1 ? 's' : ''}`
      : null;

  return (
    <>
      <header
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 200,
          transition: 'background 0.35s ease, backdrop-filter 0.35s ease, border-color 0.35s ease',
          backgroundColor: transparent
            ? 'rgba(0,0,0,0)'
            : 'rgba(10,10,14,0.92)',
          backdropFilter: transparent ? 'none' : 'blur(24px)',
          WebkitBackdropFilter: transparent ? 'none' : 'blur(24px)',
          borderBottom: `1px solid ${transparent ? 'transparent' : 'rgba(255,255,255,0.08)'}`,
        }}
      >
        <div
          style={{
            maxWidth: '1400px',
            margin: '0 auto',
            padding: '0 clamp(16px, 3vw, 48px)',
            height: '64px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '24px',
          }}
        >
          <button
            onClick={() => handleNav('home')}
            aria-label="Go to homepage"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            <img
              src="/logo.png"
              alt="RentABike Faroe Islands"
              style={{
                height: '36px',
                width: 'auto',
                objectFit: 'contain',
                borderRadius: '6px',
              }}
            />
          </button>

          <nav
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              flex: 1,
              justifyContent: 'center',
            }}
            className="desktop-nav"
          >
            {NAV_LINKS.map(({ label, page }) => (
              <button
                key={page}
                onClick={() => handleNav(page)}
                className={`header-nav-btn${currentPage === page ? ' header-nav-btn--active' : ''}`}
              >
                {label}
              </button>
            ))}
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
            {bookingLabel && (
              <button
                onClick={() => handleNav('checkout')}
                className="header-cart-btn"
                aria-label={`View cart: ${bookingLabel}`}
              >
                <PIcon name="card" size="small" theme="dark" />
                <span
                  className="header-cart-label"
                  style={{
                    fontFamily: "'Porsche Next','Arial Narrow',Arial,sans-serif",
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#fff',
                    letterSpacing: '0.01em',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {bookingLabel}
                </span>
              </button>
            )}

            <button
              onClick={() => setMobileOpen(true)}
              className="mobile-menu-btn"
              aria-label="Open navigation menu"
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.15)',
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '8px',
                display: 'none',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <PIcon name="menu-lines" size="small" theme="dark" />
            </button>
          </div>
        </div>
      </header>

      <PFlyout
        open={mobileOpen}
        position="end"
        onDismiss={() => setMobileOpen(false)}
        aria={{ 'aria-label': 'Navigation menu' }}
      >
        <div slot="header" style={{ padding: '8px 0' }}>
          <PText weight="bold" size="medium">RentABike.fo</PText>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingTop: '16px' }}>
          {NAV_LINKS.map(({ label, page }) => (
            <button
              key={page}
              onClick={() => handleNav(page)}
              style={{
                background: currentPage === page ? 'var(--p-color-background-surface)' : 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '14px 16px',
                borderRadius: '8px',
                textAlign: 'left',
                fontFamily: "'Porsche Next','Arial Narrow',Arial,sans-serif",
                fontSize: '16px',
                fontWeight: currentPage === page ? 600 : 400,
                color: 'var(--p-color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              {label}
              {currentPage === page && <PIcon name="arrow-right" size="small" />}
            </button>
          ))}
        </div>

        {bookingLabel && (
          <div slot="footer">
            <PButtonPure icon="card" onClick={() => handleNav('checkout')} style={{ width: '100%' }}>
              {bookingLabel}
            </PButtonPure>
          </div>
        )}
      </PFlyout>

      <style>{`
        .header-nav-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 8px 14px;
          border-radius: 6px;
          font-family: 'Porsche Next','Arial Narrow',Arial,sans-serif;
          font-weight: 400;
          font-size: 14px;
          color: rgba(255,255,255,0.72);
          letter-spacing: 0.01em;
          transition: color 0.2s ease, background 0.2s ease;
          background-color: transparent;
        }
        .header-nav-btn:hover {
          color: #fff;
          background-color: rgba(255,255,255,0.06);
        }
        .header-nav-btn--active {
          font-weight: 600;
          color: #fff !important;
          background-color: rgba(255,255,255,0.1) !important;
        }
        .header-cart-btn {
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.15);
          cursor: pointer;
          padding: 8px 16px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: background 0.2s ease, border-color 0.2s ease;
        }
        .header-cart-btn:hover {
          background: rgba(255,255,255,0.16);
          border-color: rgba(255,255,255,0.25);
        }
        @media (max-width: 760px) {
          .desktop-nav { display: none !important; }
          .mobile-menu-btn { display: flex !important; }
        }
        @media (max-width: 480px) {
          .header-cart-label { display: none !important; }
          .header-cart-btn { padding: 8px 10px !important; }
        }
      `}</style>

      <div style={{ height: '64px' }} />
    </>
  );
}
