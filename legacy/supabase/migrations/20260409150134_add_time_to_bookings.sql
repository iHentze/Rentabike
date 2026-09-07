/*
  # Add pickup and dropoff time to bookings

  1. Modified Tables
    - `bookings`
      - `pickup_time` (time, default '09:00') - Time of day for bike pickup
      - `dropoff_time` (time, default '09:00') - Time of day for bike return

  2. Notes
    - Existing bookings will default to 09:00 for both times
    - Times are stored separately from dates for simplicity
    - No breaking changes to existing date-based logic
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'pickup_time'
  ) THEN
    ALTER TABLE bookings ADD COLUMN pickup_time time DEFAULT '09:00' NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'dropoff_time'
  ) THEN
    ALTER TABLE bookings ADD COLUMN dropoff_time time DEFAULT '09:00' NOT NULL;
  END IF;
END $$;