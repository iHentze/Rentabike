/*
  # Add Pickup and Drop-off Location to Bookings

  ## Summary
  Adds pickup and drop-off location fields to the bookings table so customers
  can specify where they want to pick up and return their rental bikes.

  ## Modified Tables
  - `bookings`
    - Added `pickup_location` (text) — where the customer will collect the bikes
    - Added `dropoff_location` (text) — where the customer will return the bikes
    - Both default to empty string (optional fields)

  ## Notes
  1. Both fields are optional — existing bookings keep empty string defaults
  2. The shop currently has one location but this supports future expansion
  3. No RLS changes needed — existing booking policies cover these columns
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'pickup_location'
  ) THEN
    ALTER TABLE bookings ADD COLUMN pickup_location text NOT NULL DEFAULT '';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'dropoff_location'
  ) THEN
    ALTER TABLE bookings ADD COLUMN dropoff_location text NOT NULL DEFAULT '';
  END IF;
END $$;
