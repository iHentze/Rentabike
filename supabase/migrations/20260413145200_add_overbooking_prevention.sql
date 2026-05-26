/*
  # Add overbooking prevention

  1. New Functions
    - `check_bike_availability(p_bike_id, p_start_at, p_end_at, p_quantity)` 
      Returns true if the requested quantity is available for the given date range.
      Checks against all non-cancelled bookings that overlap the requested period.

  2. New Trigger
    - `prevent_overbooking` trigger on `booking_items` table
      Fires BEFORE INSERT to validate that the bike being booked has
      sufficient available inventory for the booking's date range.
      Raises an exception if the booking would exceed available stock.

  3. Important Notes
    - This prevents race conditions at the database level
    - Only non-cancelled bookings are considered when calculating availability
    - The trigger looks up start_at/end_at from the parent booking record
*/

CREATE OR REPLACE FUNCTION check_bike_availability(
  p_bike_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_quantity int
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_quantity int;
  v_booked_quantity int;
BEGIN
  SELECT total_quantity INTO v_total_quantity
  FROM bikes
  WHERE id = p_bike_id;

  IF v_total_quantity IS NULL THEN
    RETURN false;
  END IF;

  SELECT COALESCE(SUM(bi.quantity), 0) INTO v_booked_quantity
  FROM booking_items bi
  JOIN bookings b ON b.id = bi.booking_id
  WHERE bi.bike_id = p_bike_id
    AND b.status != 'cancelled'
    AND b.start_at < p_end_at
    AND b.end_at > p_start_at;

  RETURN (v_total_quantity - v_booked_quantity) >= p_quantity;
END;
$$;

CREATE OR REPLACE FUNCTION prevent_overbooking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_bike_name text;
  v_available boolean;
BEGIN
  SELECT start_at, end_at INTO v_start_at, v_end_at
  FROM bookings
  WHERE id = NEW.booking_id;

  IF v_start_at IS NULL OR v_end_at IS NULL THEN
    RETURN NEW;
  END IF;

  v_available := check_bike_availability(NEW.bike_id, v_start_at, v_end_at, NEW.quantity);

  IF NOT v_available THEN
    SELECT name INTO v_bike_name FROM bikes WHERE id = NEW.bike_id;
    RAISE EXCEPTION 'Overbooking prevented: "%" is not available in the requested quantity for this period.', COALESCE(v_bike_name, 'Unknown bike');
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_prevent_overbooking'
  ) THEN
    CREATE TRIGGER trg_prevent_overbooking
      BEFORE INSERT ON booking_items
      FOR EACH ROW
      EXECUTE FUNCTION prevent_overbooking();
  END IF;
END $$;
