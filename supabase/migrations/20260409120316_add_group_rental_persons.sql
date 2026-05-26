/*
  # Add Group Rental Persons Support

  ## Summary
  Enables per-person bike assignment for group rentals. Each booking can now have
  multiple persons (Person 1, Person 2, etc.), and each booking item can be linked
  to a specific person.

  ## New Tables
  - `booking_persons`
    - `id` (uuid, primary key)
    - `booking_id` (uuid, FK to bookings)
    - `person_label` (text) — e.g. "Person 1"
    - `sort_order` (integer) — display ordering
    - `created_at` (timestamptz)

  ## Modified Tables
  - `booking_items`
    - Added nullable `person_id` (uuid, FK to booking_persons) — null means unassigned

  ## Security
  - RLS enabled on booking_persons
  - Public can insert and select booking_persons (same as bookings pattern)
  - Admin access via service role

  ## Notes
  1. person_id is nullable — existing bookings and accessories-only items work unchanged
  2. One bike per person rule is enforced in application logic, not at DB level
  3. group_size is derived from COUNT of booking_persons rows — no extra column needed
*/

CREATE TABLE IF NOT EXISTS booking_persons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  person_label text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'booking_items' AND column_name = 'person_id'
  ) THEN
    ALTER TABLE booking_items ADD COLUMN person_id uuid REFERENCES booking_persons(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_booking_persons_booking_id ON booking_persons(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_items_person_id ON booking_items(person_id);

ALTER TABLE booking_persons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert booking persons"
  ON booking_persons FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can select booking persons"
  ON booking_persons FOR SELECT
  TO anon, authenticated
  USING (true);
