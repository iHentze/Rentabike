/*
  # Update overbooking prevention to account for released items

  1. Modified Functions
    - `check_bike_availability` -- now excludes released items from booked quantity calculation
      Released items no longer count against inventory, freeing up those bikes for other bookings

  2. Important Notes
    - Only items with item_status != 'released' count toward booked quantity
    - This ensures that releasing equipment immediately makes it available for new bookings
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
    AND bi.item_status != 'released'
    AND b.start_at < p_end_at
    AND b.end_at > p_start_at;

  RETURN (v_total_quantity - v_booked_quantity) >= p_quantity;
END;
$$;
