/*
  # Add tour_allowed_bikes junction table

  1. New Tables
    - `tour_allowed_bikes`
      - `tour_id` (uuid, FK to tours.id) - which tour this bike is allowed on
      - `bike_id` (uuid, FK to bikes.id) - which specific bike model+size is allowed
      - Composite primary key on (tour_id, bike_id)

  2. Purpose
    - Allows admins to configure exactly which bikes (model + size) are available
      for each guided tour
    - Customers then pick from only those allowed bikes when booking a tour

  3. Security
    - Enable RLS on `tour_allowed_bikes` table
    - Public read policy (anyone can see which bikes are available for a tour)
    - Authenticated insert/delete policies (admin-managed)
*/

CREATE TABLE IF NOT EXISTS tour_allowed_bikes (
  tour_id uuid NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
  bike_id uuid NOT NULL REFERENCES bikes(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (tour_id, bike_id)
);

ALTER TABLE tour_allowed_bikes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tour allowed bikes"
  ON tour_allowed_bikes
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated can insert tour allowed bikes"
  ON tour_allowed_bikes
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can delete tour allowed bikes"
  ON tour_allowed_bikes
  FOR DELETE
  TO authenticated
  USING (true);
