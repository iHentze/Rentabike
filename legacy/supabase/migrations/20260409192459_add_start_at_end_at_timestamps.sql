/*
  # Add start_at / end_at timestamp columns to bookings

  1. Modified Tables
    - `bookings`
      - `start_at` (timestamptz) — combined pick-up date + time, source of truth for availability
      - `end_at` (timestamptz) — combined return date + time, source of truth for availability

  2. Backfill
    - Populates start_at and end_at from existing start_date + pickup_time / end_date + dropoff_time

  3. Indexes
    - `idx_bookings_start_at_end_at` on (start_at, end_at) for fast overlap queries

  4. Important Notes
    - Old columns (start_date, end_date, pickup_time, dropoff_time) are kept for backwards compatibility
    - New code should read/write start_at and end_at as the authoritative time window
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'start_at'
  ) THEN
    ALTER TABLE bookings ADD COLUMN start_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'end_at'
  ) THEN
    ALTER TABLE bookings ADD COLUMN end_at timestamptz;
  END IF;
END $$;

UPDATE bookings
SET
  start_at = (start_date || 'T' || COALESCE(pickup_time, '09:00:00'))::timestamptz,
  end_at   = (end_date   || 'T' || COALESCE(dropoff_time, '09:00:00'))::timestamptz
WHERE start_at IS NULL OR end_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_start_at_end_at ON bookings (start_at, end_at);
