import { useState, lazy, Suspense, Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { PSpinner, PHeading, PText, PButton, PIcon, PInlineNotification } from '@porsche-design-system/components-react';
import { CartProvider } from './store/CartProvider';
import { ToastProvider } from './hooks/useToast';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { PageTransition } from './components/PageTransition';
import type { Page, TourBookingSetup, TourBikeSelection } from './types';

const HomePage = lazy(() => import('./pages/HomePage').then(m => ({ default: m.HomePage })));
const BookingSetupPage = lazy(() => import('./pages/BookingSetupPage').then(m => ({ default: m.BookingSetupPage })));
const PersonCatalogPage = lazy(() => import('./pages/PersonCatalogPage').then(m => ({ default: m.PersonCatalogPage })));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage').then(m => ({ default: m.CheckoutPage })));
const ConfirmationPage = lazy(() => import('./pages/ConfirmationPage').then(m => ({ default: m.ConfirmationPage })));
const AdminPage = lazy(() => import('./pages/AdminPage').then(m => ({ default: m.AdminPage })));
const MyBookingPage = lazy(() => import('./pages/MyBookingPage').then(m => ({ default: m.MyBookingPage })));
const ToursPage = lazy(() => import('./pages/ToursPage').then(m => ({ default: m.ToursPage })));
const TourDetailPage = lazy(() => import('./pages/TourDetailPage').then(m => ({ default: m.TourDetailPage })));
const TourBikeCatalogPage = lazy(() => import('./pages/TourBikeCatalogPage').then(m => ({ default: m.TourBikeCatalogPage })));
const TourCheckoutPage = lazy(() => import('./pages/TourCheckoutPage').then(m => ({ default: m.TourCheckoutPage })));
const TourConfirmationPage = lazy(() => import('./pages/TourConfirmationPage').then(m => ({ default: m.TourConfirmationPage })));

function PageSpinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <PSpinner size="medium" />
    </div>
  );
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<{ children: ReactNode; onReset: () => void }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {}

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ maxWidth: 480, margin: '120px auto', padding: '0 16px', textAlign: 'center' }}>
          <PInlineNotification
            state="error"
            heading="Something went wrong"
            description="An unexpected error occurred. Please try reloading the page."
            dismissButton={false}
          />
          <div style={{ marginTop: 24 }}>
            <PButton
              icon="refresh"
              onClick={() => {
                this.setState({ hasError: false });
                this.props.onReset();
              }}
            >
              Reload
            </PButton>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function NotFoundPage({ onNavigate }: { onNavigate: (p: Page) => void }) {
  return (
    <div style={{ maxWidth: 480, margin: '120px auto', padding: '0 16px', textAlign: 'center' }}>
      <PIcon name="search" size="x-large" color="contrast-medium" />
      <PHeading size="large" tag="h1" className="mt-static-md">
        Page not found
      </PHeading>
      <PText color="contrast-medium" className="mt-static-sm">
        The page you are looking for does not exist or has been moved.
      </PText>
      <div className="mt-static-lg">
        <PButton icon="arrow-left" onClick={() => onNavigate('home')}>Back to Home</PButton>
      </div>
    </div>
  );
}

const KNOWN_PAGES: Page[] = [
  'home', 'booking-setup', 'person-catalog', 'checkout', 'confirmation',
  'my-booking', 'tours', 'tour-detail', 'tour-bike-catalog', 'tour-checkout',
  'tour-confirmation', 'admin',
];

export default function App() {
  const [page, setPage] = useState<Page>('home');
  const [confirmationBookingId, setConfirmationBookingId] = useState('');
  const [selectedTourId, setSelectedTourId] = useState('');
  const [tourBookingSetup, setTourBookingSetup] = useState<TourBookingSetup | null>(null);
  const [tourBikeSelection, setTourBikeSelection] = useState<TourBikeSelection | null>(null);
  const [tourConfirmationId, setTourConfirmationId] = useState('');

  function navigate(p: Page) {
    setPage(p);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function handleConfirmation(bookingId: string) {
    setConfirmationBookingId(bookingId);
    navigate('confirmation');
  }

  function handleTourConfirmation(bookingId: string) {
    setTourConfirmationId(bookingId);
    navigate('tour-confirmation');
  }

  const isKnownPage = KNOWN_PAGES.includes(page);

  return (
    <CartProvider>
      <ToastProvider>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Header currentPage={page} onNavigate={navigate} />

        <main style={{ flex: 1 }}>
          <ErrorBoundary onReset={() => navigate('home')}>
          <Suspense fallback={<PageSpinner />}>
          <PageTransition pageKey={page}>
            {page === 'home' && <HomePage onNavigate={navigate} onSelectTour={(id) => { setSelectedTourId(id); navigate('tour-detail'); }} />}
            {page === 'booking-setup' && <BookingSetupPage onNavigate={navigate} />}
            {page === 'person-catalog' && <PersonCatalogPage onNavigate={navigate} />}
            {page === 'checkout' && (
              <CheckoutPage onNavigate={navigate} onConfirmation={handleConfirmation} />
            )}
            {page === 'confirmation' && (
              <ConfirmationPage bookingId={confirmationBookingId} onNavigate={navigate} />
            )}
            {page === 'my-booking' && <MyBookingPage onNavigate={navigate} />}
            {page === 'tours' && (
              <ToursPage
                onNavigate={navigate}
                onSelectTour={(id) => {
                  setSelectedTourId(id);
                  navigate('tour-detail');
                }}
              />
            )}
            {page === 'tour-detail' && (
              <TourDetailPage
                tourId={selectedTourId}
                onNavigate={navigate}
                onBook={(setup) => {
                  setTourBookingSetup(setup);
                }}
                onContinueToBikes={(data) => {
                  setTourBikeSelection(data);
                }}
              />
            )}
            {page === 'tour-bike-catalog' && tourBikeSelection && (
              <TourBikeCatalogPage
                tourName={tourBikeSelection.tourName}
                bikes={tourBikeSelection.bikes}
                numAttendees={tourBikeSelection.numAttendees}
                attendeeBikes={tourBikeSelection.attendeeBikes}
                onUpdateBikes={(bikes) => {
                  setTourBikeSelection((prev) => prev ? { ...prev, attendeeBikes: bikes } : null);
                }}
                onBook={() => {
                  if (tourBikeSelection) {
                    const selected = tourBikeSelection.attendeeBikes.slice(0, tourBikeSelection.numAttendees);
                    if (selected.some((id) => !id)) return;
                    setTourBookingSetup({
                      tourId: tourBikeSelection.tourId,
                      tourDateId: tourBikeSelection.tourDateId,
                      numAttendees: tourBikeSelection.numAttendees,
                      attendeeBikes: selected.map((bikeId, i) => ({
                        label: `Person ${i + 1}`,
                        bikeId,
                      })),
                      tourName: tourBikeSelection.tourName,
                      tourDate: tourBikeSelection.tourDate,
                      tourTime: tourBikeSelection.tourTime,
                      durationHours: tourBikeSelection.durationHours,
                      meetingPoint: tourBikeSelection.meetingPoint,
                      pricePerPerson: tourBikeSelection.pricePerPerson,
                      needsBike: true,
                    });
                    navigate('tour-checkout');
                  }
                }}
                onBack={() => navigate('tour-detail')}
                onNavigate={navigate}
              />
            )}
            {page === 'tour-checkout' && (
              <TourCheckoutPage
                bookingSetup={tourBookingSetup}
                onNavigate={navigate}
                onConfirmation={handleTourConfirmation}
              />
            )}
            {page === 'tour-confirmation' && (
              <TourConfirmationPage
                bookingId={tourConfirmationId}
                onNavigate={navigate}
              />
            )}
            {page === 'admin' && <AdminPage />}
            {!isKnownPage && <NotFoundPage onNavigate={navigate} />}
          </PageTransition>
          </Suspense>
          </ErrorBoundary>
        </main>

        {page !== 'admin' && <Footer onNavigate={navigate} />}
      </div>
      </ToastProvider>
    </CartProvider>
  );
}
