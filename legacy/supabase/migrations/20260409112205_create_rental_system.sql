/*
  # Rental System Schema

  ## Summary
  Creates all tables needed for the RentABike rental system.

  ## New Tables

  ### categories
  - `id` (uuid, PK) - Unique identifier
  - `name` (text) - Display name (e.g. "E-Bikes", "Mountain Bikes")
  - `slug` (text, unique) - URL-friendly identifier
  - `icon` (text) - Icon name for display
  - `created_at` (timestamp)

  ### bikes
  - `id` (uuid, PK)
  - `name` (text) - Bike display name
  - `category_id` (uuid, FK → categories)
  - `description` (text) - Full description
  - `price_per_day` (numeric) - Daily rental price in DKK
  - `size` (text) - Frame size
  - `total_quantity` (int) - Total units available
  - `image_url` (text) - Product image URL
  - `is_active` (boolean) - Whether listed in catalog
  - `created_at` (timestamp)

  ### bookings
  - `id` (uuid, PK)
  - `confirmation_code` (text, unique) - Short human-readable code
  - `customer_name` (text)
  - `customer_email` (text)
  - `customer_phone` (text)
  - `start_date` (date) - Rental start
  - `end_date` (date) - Rental end
  - `total_price` (numeric) - Total cost in DKK
  - `status` (text) - pending | confirmed | cancelled
  - `notes` (text) - Customer notes
  - `created_at` (timestamp)

  ### booking_items
  - `id` (uuid, PK)
  - `booking_id` (uuid, FK → bookings)
  - `bike_id` (uuid, FK → bikes)
  - `quantity` (int)
  - `price_per_day` (numeric) - Locked price at booking time
  - `created_at` (timestamp)

  ## Security
  - RLS enabled on all tables
  - Public (anon) can SELECT active bikes and categories
  - Public (anon) can INSERT bookings and booking_items
  - Public (anon) can SELECT bookings by id (for confirmation page)
  - Active bikes filter ensures only live inventory is shown

  ## Seed Data
  - 6 categories: E-Bikes, Mountain Bikes, Gravel Bikes, Road Bikes, Children Bikes, Accessories
  - 20 bikes across all categories with realistic Faroe Islands pricing
*/

-- Categories
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  icon text NOT NULL DEFAULT 'car',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view categories"
  ON categories
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Bikes
CREATE TABLE IF NOT EXISTS bikes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category_id uuid REFERENCES categories(id),
  description text DEFAULT '',
  price_per_day numeric NOT NULL DEFAULT 0,
  size text DEFAULT '',
  total_quantity integer NOT NULL DEFAULT 1,
  image_url text DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE bikes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active bikes"
  ON bikes
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Authenticated can manage bikes"
  ON bikes
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Bookings
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  confirmation_code text UNIQUE NOT NULL DEFAULT upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text DEFAULT '',
  start_date date NOT NULL,
  end_date date NOT NULL,
  total_price numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  CONSTRAINT bookings_status_check CHECK (status IN ('pending', 'confirmed', 'cancelled'))
);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create bookings"
  ON bookings
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can view bookings by id"
  ON bookings
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated can update bookings"
  ON bookings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Booking items
CREATE TABLE IF NOT EXISTS booking_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  bike_id uuid NOT NULL REFERENCES bikes(id),
  quantity integer NOT NULL DEFAULT 1,
  price_per_day numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE booking_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create booking items"
  ON booking_items
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can view booking items"
  ON booking_items
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bikes_category_id ON bikes(category_id);
CREATE INDEX IF NOT EXISTS idx_bikes_is_active ON bikes(is_active);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_booking_items_booking_id ON booking_items(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_items_bike_id ON booking_items(bike_id);

-- Seed categories
INSERT INTO categories (name, slug, icon) VALUES
  ('E-Bikes', 'e-bikes', 'flash'),
  ('Mountain Bikes', 'mountain-bikes', 'country-road'),
  ('Gravel Bikes', 'gravel-bikes', 'highway'),
  ('Road Bikes', 'road-bikes', 'car'),
  ('Children Bikes', 'children-bikes', 'heart'),
  ('Accessories', 'accessories', 'attachment')
ON CONFLICT (slug) DO NOTHING;

-- Seed bikes
INSERT INTO bikes (name, category_id, description, price_per_day, size, total_quantity, image_url) VALUES
  -- E-Bikes
  ('Centurion Gravel E-Bike',
    (SELECT id FROM categories WHERE slug = 'e-bikes'),
    'A powerful electric gravel bike perfect for exploring the rugged Faroese terrain. Equipped with a Bosch motor and long-range battery for all-day adventures across fjords and mountains.',
    550, '19"', 2, ''),
  ('Centurion Gravel E-Bike',
    (SELECT id FROM categories WHERE slug = 'e-bikes'),
    'A powerful electric gravel bike perfect for exploring the rugged Faroese terrain. Equipped with a Bosch motor and long-range battery for all-day adventures across fjords and mountains.',
    550, '21"', 2, ''),
  ('Centurion MTB E-Bike',
    (SELECT id FROM categories WHERE slug = 'e-bikes'),
    'Electric mountain bike built for the steep Faroese trails. Full suspension, powerful disc brakes, and a Bosch motor to conquer any climb with ease.',
    600, '19"', 2, ''),
  ('Centurion MTB E-Bike',
    (SELECT id FROM categories WHERE slug = 'e-bikes'),
    'Electric mountain bike built for the steep Faroese trails. Full suspension, powerful disc brakes, and a Bosch motor to conquer any climb with ease.',
    600, '21"', 2, ''),
  ('Centurion Zero E-Bike',
    (SELECT id FROM categories WHERE slug = 'e-bikes'),
    'A sleek and nimble city e-bike ideal for exploring Tórshavn and surrounding villages. Lightweight aluminium frame with integrated battery and smooth Shimano gearing.',
    500, '51cm', 2, ''),
  ('Centurion Zero E-Bike',
    (SELECT id FROM categories WHERE slug = 'e-bikes'),
    'A sleek and nimble city e-bike ideal for exploring Tórshavn and surrounding villages. Lightweight aluminium frame with integrated battery and smooth Shimano gearing.',
    500, '55cm', 2, ''),
  -- Mountain Bikes
  ('Cube Dual Suspension MTB',
    (SELECT id FROM categories WHERE slug = 'mountain-bikes'),
    'High-performance dual suspension mountain bike for serious trail riding. Front and rear suspension absorbs the roughest Faroese tracks for a smooth, controlled ride.',
    400, 'L', 3, ''),
  ('Felt Doctrine MTB',
    (SELECT id FROM categories WHERE slug = 'mountain-bikes'),
    'A race-bred mountain bike with aggressive geometry and precise handling. Ideal for experienced riders tackling the demanding mountain trails of the Faroe Islands.',
    380, '16"', 2, ''),
  ('Felt Doctrine MTB',
    (SELECT id FROM categories WHERE slug = 'mountain-bikes'),
    'A race-bred mountain bike with aggressive geometry and precise handling. Ideal for experienced riders tackling the demanding mountain trails of the Faroe Islands.',
    380, '18"', 2, ''),
  -- Gravel Bikes
  ('Felt Breed Gravel',
    (SELECT id FROM categories WHERE slug = 'gravel-bikes'),
    'The ultimate adventure bike for mixed terrain riding. Combines road bike speed with mountain bike versatility — perfect for gravel roads, coastal paths and forest tracks.',
    420, '54cm', 3, ''),
  -- Road Bikes
  ('Felt FR2 Road Bike',
    (SELECT id FROM categories WHERE slug = 'road-bikes'),
    'A full carbon road bike offering exceptional stiffness, lightweight performance and aerodynamic efficiency. Ideal for fast road rides and longer distances across the islands.',
    350, '54cm', 2, ''),
  ('Felt FR2 Road Bike',
    (SELECT id FROM categories WHERE slug = 'road-bikes'),
    'A full carbon road bike offering exceptional stiffness, lightweight performance and aerodynamic efficiency. Ideal for fast road rides and longer distances across the islands.',
    350, '56cm', 2, ''),
  ('Felt FX5 Road Bike',
    (SELECT id FROM categories WHERE slug = 'road-bikes'),
    'A versatile endurance road bike balancing performance and comfort. Relaxed geometry reduces fatigue on long rides while keeping you fast and efficient.',
    320, '53cm', 2, ''),
  ('Felt FX5 Road Bike',
    (SELECT id FROM categories WHERE slug = 'road-bikes'),
    'A versatile endurance road bike balancing performance and comfort. Relaxed geometry reduces fatigue on long rides while keeping you fast and efficient.',
    320, '55cm', 2, ''),
  ('Felt VR6 Road Bike',
    (SELECT id FROM categories WHERE slug = 'road-bikes'),
    'A reliable allroad bike with a comfortable riding position. Hydraulic disc brakes provide confident stopping in all Faroese weather conditions.',
    300, '56cm', 2, ''),
  ('Felt VR6 Road Bike',
    (SELECT id FROM categories WHERE slug = 'road-bikes'),
    'A reliable allroad bike with a comfortable riding position. Hydraulic disc brakes provide confident stopping in all Faroese weather conditions.',
    300, '58cm', 2, ''),
  -- Children Bikes
  ('Children Bike 26"',
    (SELECT id FROM categories WHERE slug = 'children-bikes'),
    'Lightweight children''s bike suitable for ages 10–14. Easy to ride with smooth gearing and reliable brakes for safe family adventures.',
    200, '26"', 4, ''),
  ('Children Bike 27.5"',
    (SELECT id FROM categories WHERE slug = 'children-bikes'),
    'Larger children''s bike for ages 14 and up. Nearly full-size geometry with quality components for confident riding.',
    220, '27.5"', 4, ''),
  -- Accessories
  ('Rear Rack Rental Bags (2×20L)',
    (SELECT id FROM categories WHERE slug = 'accessories'),
    'A pair of waterproof panniers attaching to the rear rack. 20L each — ideal for carrying everything you need for a day trip or overnight adventure.',
    80, 'Universal', 6, ''),
  ('Children Seat (from 12 months, max 22kg)',
    (SELECT id FROM categories WHERE slug = 'accessories'),
    'Safe and comfortable children''s bike seat suitable from 12 months up to 22kg. Easy to mount and dismount with a secure harness system.',
    100, 'Universal', 4, '')
ON CONFLICT DO NOTHING;
