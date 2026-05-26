import { useState, useEffect } from 'react';
import {
  PDisplay,
  PText,
  PButton,
  PHeading,
  PCarousel,
  PIcon,
  PTag,
} from '@porsche-design-system/components-react';
import {
  spacingStaticSmall,
  spacingStaticMedium,
  borderRadiusLarge,
  themeLightBackgroundBase,
  themeLightBackgroundSurface,
} from '@porsche-design-system/components-react/styles';
import { supabase } from '../lib/supabase';
import type { Page, Bike, Tour } from '../types';

interface HomePageProps {
  onNavigate: (page: Page) => void;
  onSelectTour: (id: string) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  'e-bikes': 'var(--p-color-notification-success)',
  'mountain-bikes': 'var(--p-color-notification-info)',
  'gravel-bikes': 'var(--p-color-notification-warning)',
  'road-bikes': 'var(--p-color-primary)',
  'children-bikes': 'var(--p-color-contrast-medium)',
};

const STEPS = [
  {
    icon: 'group' as const,
    number: '01',
    title: 'Tell us who\'s riding',
    text: 'Select your dates, pick-up location, and add everyone in your group.',
  },
  {
    icon: 'configurate' as const,
    number: '02',
    title: 'Pick your bikes',
    text: 'Each person chooses their bike and accessories from our premium fleet.',
  },
  {
    icon: 'country-road' as const,
    number: '03',
    title: 'Ride',
    text: 'Pick up your bikes in Torshavn and explore the Faroe Islands.',
  },
];

const ACTIVITY_ICONS: Record<string, string> = {
  bike: 'country-road',
  combo: 'arrows',
  hike: 'map',
  'trail-run': 'flash',
};

const TOUR_TAGLINES: Record<string, string> = {
  bike: 'Ride the wild trails',
  combo: 'Hike & bike the highlands',
  hike: 'Walk the ancient paths',
  'trail-run': 'Run the mountain ridges',
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: 'notification-success-soft',
  moderate: 'notification-warning-soft',
};

export function HomePage({ onNavigate, onSelectTour }: HomePageProps) {
  const [allBikes, setAllBikes] = useState<Bike[]>([]);
  const [featuredTours, setFeaturedTours] = useState<Tour[]>([]);

  useEffect(() => {
    supabase
      .from('bikes')
      .select('*, category:categories(*)')
      .eq('is_active', true)
      .order('price_per_day', { ascending: false })
      .then(({ data }) => {
        if (data) {
          const bikes = (data as Bike[]).filter(
            (b) => b.category?.slug !== 'accessories'
          );
          setAllBikes(bikes);
        }
      });

    supabase
      .from('tours')
      .select('*')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => {
        if (data) setFeaturedTours(data as Tour[]);
      });
  }, []);

  return (
    <div>
      <section
        style={{
          position: 'relative',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden',
          marginTop: '-64px',
          paddingTop: '64px',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'url(/hero-faroe-islands.webp)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(to right, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.15) 100%)',
          }}
        />

        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '1400px',
            margin: '0 auto',
            padding: 'clamp(24px, 4vw, 80px)',
          }}
        >
          <div style={{ maxWidth: '640px' }}>
            <PTag
              theme="dark"
              color="background-frosted"
              icon="geo-localization"
              style={{ marginBottom: 'clamp(16px, 2vw, 24px)' }}
            >
              Torshavn, Faroe Islands
            </PTag>

            <PDisplay
              size={{ base: 'medium', m: 'large' }}
              theme="dark"
              tag="h1"
              style={{ marginBottom: 'clamp(12px, 2vw, 20px)', display: 'block' }}
            >
              Explore the Faroes on Two Wheels
            </PDisplay>

            <PText
              size="large"
              theme="dark"
              style={{
                marginBottom: 'clamp(24px, 4vw, 48px)',
                display: 'block',
                maxWidth: '480px',
              }}
            >
              Premium bikes for dramatic landscapes. From electric rides to
              mountain trails — rent, ride, return.
            </PText>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <PButton
                theme="dark"
                onClick={() => onNavigate('booking-setup')}
                icon="arrow-right"
              >
                Rent a Bike
              </PButton>
              <PButton
                theme="dark"
                variant="secondary"
                onClick={() => {
                  document
                    .getElementById('fleet-section')
                    ?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                See Our Fleet
              </PButton>
            </div>
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: '32px',
            left: '50%',
            transform: 'translateX(-50%)',
            animation: 'bounce 2s infinite',
          }}
        >
          <PIcon name="arrow-down" theme="dark" size="medium" />
        </div>
      </section>

      {allBikes.length > 0 && (
        <section
          id="fleet-section"
          style={{
            backgroundColor: themeLightBackgroundBase,
            padding: 'clamp(48px, 6vw, 96px) 0',
          }}
        >
          <PCarousel
            heading="Our Fleet"
            description="Browse our full range of premium bikes available for rent."
            slidesPerPage={{ base: 1, s: 2, m: 3, l: 4 }}
            width="extended"
          >
            {allBikes.map((bike) => {
              const catSlug = bike.category?.slug || '';
              const accentColor = CATEGORY_COLORS[catSlug] || 'var(--p-color-contrast-medium)';

              return (
                <div
                  key={bike.id}
                  onClick={() => onNavigate('booking-setup')}
                  style={{
                    borderRadius: borderRadiusLarge,
                    overflow: 'hidden',
                    border: '1px solid var(--p-color-contrast-low)',
                    backgroundColor: themeLightBackgroundBase,
                    display: 'flex',
                    flexDirection: 'column',
                    cursor: 'pointer',
                    transition: 'transform 0.25s ease, box-shadow 0.25s ease',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)';
                    (e.currentTarget as HTMLDivElement).style.boxShadow = '0px 8px 24px rgba(0,0,0,0.12)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                    (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                  }}
                >
                  <div
                    style={{
                      height: '200px',
                      overflow: 'hidden',
                      backgroundColor: themeLightBackgroundSurface,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                    }}
                  >
                    {bike.image_url ? (
                      <img
                        src={bike.image_url}
                        alt={bike.name}
                        loading="lazy"
                        decoding="async"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    ) : (
                      <PIcon name="car" size="x-large" color="contrast-low" />
                    )}
                    <div
                      style={{
                        position: 'absolute',
                        top: spacingStaticSmall,
                        left: spacingStaticSmall,
                      }}
                    >
                      <PTag compact color="background-frosted">
                        {bike.category?.name || 'Bike'}
                      </PTag>
                    </div>
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: '3px',
                        backgroundColor: accentColor,
                      }}
                    />
                  </div>

                  <div
                    style={{
                      padding: spacingStaticMedium,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: spacingStaticSmall,
                      flex: 1,
                    }}
                  >
                    <PHeading size="small" tag="h3">
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

                    {bike.description && (
                      <PText
                        size="x-small"
                        color="contrast-medium"
                        style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          flex: 1,
                        } as React.CSSProperties}
                      >
                        {bike.description}
                      </PText>
                    )}

                    <div
                      style={{
                        marginTop: 'auto',
                        paddingTop: spacingStaticSmall,
                        borderTop: '1px solid var(--p-color-contrast-low)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <PText size="medium" weight="bold">
                          {bike.price_per_day} DKK
                        </PText>
                        <PText size="xx-small" color="contrast-medium">
                          per day
                        </PText>
                      </div>
                      <PButton
                        variant="secondary"
                        compact
                        icon="arrow-right"
                        hideLabel
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigate('booking-setup');
                        }}
                        aria={{ 'aria-label': `Book ${bike.name}` }}
                      >
                        Book
                      </PButton>
                    </div>
                  </div>
                </div>
              );
            })}
          </PCarousel>
        </section>
      )}

      {featuredTours.length > 0 && (
        <section
          style={{
            backgroundColor: themeLightBackgroundSurface,
            padding: 'clamp(48px, 6vw, 96px) 0',
          }}
        >
          <PCarousel
            heading="Guided Tours"
            description="Explore the Faroe Islands with our expert guides -- from easy city rides to epic mountain adventures."
            slidesPerPage={{ base: 1, s: 2, m: 3, l: 3 }}
            width="extended"
          >
            {featuredTours.map((tour) => {
              const actIcon = ACTIVITY_ICONS[tour.activity_type] || 'map';
              const tagline = tour.short_description || TOUR_TAGLINES[tour.activity_type] || 'Discover the Faroes';
              const diffColor = DIFFICULTY_COLORS[tour.difficulty] || 'background-frosted';

              return (
                <div
                  key={tour.id}
                  onClick={() => onSelectTour(tour.id)}
                  style={{
                    borderRadius: borderRadiusLarge,
                    overflow: 'hidden',
                    position: 'relative',
                    height: '360px',
                    cursor: 'pointer',
                    transition: 'transform 0.25s ease, box-shadow 0.25s ease',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)';
                    (e.currentTarget as HTMLDivElement).style.boxShadow = '0px 8px 24px rgba(0,0,0,0.12)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                    (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundImage: tour.image_url
                        ? `url(${tour.image_url})`
                        : 'linear-gradient(135deg, #1a1a2e, #16213e)',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.3) 40%, rgba(0,0,0,0.75) 100%)',
                    }}
                  />

                  <div
                    style={{
                      position: 'absolute',
                      top: spacingStaticMedium,
                      left: spacingStaticMedium,
                      display: 'flex',
                      gap: '6px',
                    }}
                  >
                    <PTag theme="dark" color="background-frosted" icon={actIcon as never} compact>
                      {tour.activity_type === 'trail-run' ? 'Trail Run' : tour.activity_type === 'combo' ? 'Hike & Bike' : tour.activity_type.charAt(0).toUpperCase() + tour.activity_type.slice(1)}
                    </PTag>
                    <PTag theme="dark" color={diffColor as never} compact>{tour.difficulty}</PTag>
                  </div>

                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      padding: spacingStaticMedium,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: spacingStaticSmall,
                    }}
                  >
                    <PHeading size="medium" theme="dark" tag="h3">{tour.name}</PHeading>
                    <PText
                      size="x-small"
                      theme="dark"
                      style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        opacity: 0.85,
                      } as React.CSSProperties}
                    >{tagline}</PText>

                    <div style={{ display: 'flex', alignItems: 'center', gap: spacingStaticSmall }}>
                      <PTag theme="dark" color="background-frosted" icon="clock" compact>{tour.duration_hours}h</PTag>
                      <PTag theme="dark" color="background-frosted" compact>{Number(tour.price_per_person).toLocaleString()} DKK</PTag>
                    </div>

                    <PButton
                      theme="dark"
                      variant="secondary"
                      compact
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectTour(tour.id);
                      }}
                    >
                      View Tour
                    </PButton>
                  </div>
                </div>
              );
            })}
          </PCarousel>
        </section>
      )}

      <section
        style={{
          backgroundColor: themeLightBackgroundBase,
          padding: 'clamp(48px, 6vw, 96px) 0',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
          }}
        >
          <div
            style={{
              textAlign: 'center',
              marginBottom: 'clamp(32px, 4vw, 64px)',
              padding: '0 clamp(16px, 4vw, 48px)',
            }}
          >
            <PHeading size="x-large" tag="h2" style={{ marginBottom: '12px' }}>
              How It Works
            </PHeading>
            <PText size="medium" color="contrast-medium">
              Three simple steps to your Faroese cycling adventure
            </PText>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
              gap: 'clamp(24px, 3vw, 48px)',
              padding: '0 clamp(16px, 4vw, 48px)',
            }}
          >
            {STEPS.map((step) => (
              <div
                key={step.number}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  textAlign: 'center',
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    width: '72px',
                    height: '72px',
                    borderRadius: 'var(--p-border-radius-lg)',
                    backgroundColor: themeLightBackgroundSurface,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                  }}
                >
                  <PIcon name={step.icon as never} size="medium" />
                  <div
                    style={{
                      position: 'absolute',
                      top: '-6px',
                      right: '-6px',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--p-color-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <PText
                      size="xx-small"
                      weight="bold"
                      style={{ color: 'var(--p-color-background-base)' }}
                    >
                      {step.number}
                    </PText>
                  </div>
                </div>
                <PHeading size="small" tag="h3">
                  {step.title}
                </PHeading>
                <PText size="small" color="contrast-medium">
                  {step.text}
                </PText>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        style={{
          backgroundColor: themeLightBackgroundBase,
          padding: 'clamp(48px, 6vw, 96px) 0',
        }}
      >
        <div
          style={{
            maxWidth: '1400px',
            margin: '0 auto',
            padding: '0 clamp(16px, 4vw, 48px)',
          }}
        >
        <div
          style={{
            position: 'relative',
            borderRadius: 'var(--p-border-radius-lg)',
            overflow: 'hidden',
            minHeight: '320px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: 'url(/hero-faroe-islands.webp)',
              backgroundSize: 'cover',
              backgroundPosition: 'center 30%',
              filter: 'brightness(0.35)',
            }}
          />
          <div
            style={{
              position: 'relative',
              padding: 'clamp(40px, 5vw, 80px)',
              maxWidth: '600px',
            }}
          >
            <PHeading
              size="x-large"
              tag="h2"
              theme="dark"
              style={{ marginBottom: '16px' }}
            >
              Ready for Your Faroese Adventure?
            </PHeading>
            <PText
              size="medium"
              theme="dark"
              style={{ marginBottom: '32px', display: 'block' }}
            >
              Pick your dates, choose your bike, and hit the road. Payment on
              pick-up — no upfront costs.
            </PText>
            <PButton
              theme="dark"
              onClick={() => onNavigate('booking-setup')}
              icon="arrow-right"
            >
              Start Booking
            </PButton>
          </div>
        </div>
        </div>
      </section>
    </div>
  );
}
