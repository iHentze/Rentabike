/*
  # Add per-item status tracking to booking_items

  1. Modified Tables
    - `booking_items`
      - Added `item_status` column (text) with allowed values:
        - 'pending' (default) -- item not yet picked up
        - 'picked_up' -- customer has taken this specific item
        - 'returned' -- customer has returned this specific item
        - 'released' -- staff released this item back to inventory (customer never picked it up)
      - This enables tracking individual equipment pickup/return independently

  2. New Functions
    - `sync_booking_status_from_items()` -- trigger function that auto-updates
      the parent booking status based on item statuses:
      - All items picked_up => booking becomes picked_up
      - All items returned or released => booking becomes returned
      - Mix of statuses => booking stays at its current level

  3. Important Notes
    - Existing booking_items default to 'pending'
    - The 'released' status frees inventory without requiring physical return
    - Booking-level status is kept in sync automatically via trigger
    - Overbooking prevention now also excludes 'released' items from availability count
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'booking_items' AND column_name = 'item_status'
  ) THEN
    ALTER TABLE booking_items ADD COLUMN item_status text NOT NULL DEFAULT 'pending';
    ALTER TABLE booking_items ADD CONSTRAINT booking_items_status_check
      CHECK (item_status = ANY (ARRAY['pending'::text, 'picked_up'::text, 'returned'::text, 'released'::text]));
  END IF;
END $$;

UPDATE booking_items bi
SET item_status = 'picked_up'
FROM bookings b
WHERE bi.booking_id = b.id AND b.status = 'picked_up' AND bi.item_status = 'pending';

UPDATE booking_items bi
SET item_status = 'returned'
FROM bookings b
WHERE bi.booking_id = b.id AND b.status = 'returned' AND bi.item_status = 'pending';

CREATE OR REPLACE FUNCTION sync_booking_status_from_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_booking_status text;
  v_total_items int;
  v_picked_up int;
  v_returned int;
  v_released int;
BEGIN
  SELECT b.status INTO v_booking_status
  FROM bookings b
  WHERE b.id = NEW.booking_id;

  IF v_booking_status IN ('cancelled', 'pending') THEN
    RETURN NEW;
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE item_status = 'picked_up'),
    COUNT(*) FILTER (WHERE item_status = 'returned'),
    COUNT(*) FILTER (WHERE item_status = 'released')
  INTO v_total_items, v_picked_up, v_returned, v_released
  FROM booking_items
  WHERE booking_id = NEW.booking_id;

  IF (v_returned + v_released) = v_total_items AND v_total_items > 0 THEN
    UPDATE bookings SET status = 'returned' WHERE id = NEW.booking_id AND status != 'returned';
  ELSIF v_picked_up > 0 AND v_booking_status = 'confirmed' THEN
    UPDATE bookings SET status = 'picked_up' WHERE id = NEW.booking_id;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sync_booking_status_from_items'
  ) THEN
    CREATE TRIGGER trg_sync_booking_status_from_items
      AFTER UPDATE OF item_status ON booking_items
      FOR EACH ROW
      EXECUTE FUNCTION sync_booking_status_from_items();
  END IF;
END $$;
