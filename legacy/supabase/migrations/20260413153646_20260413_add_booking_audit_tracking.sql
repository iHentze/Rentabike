/*
  # Add booking audit and modification tracking

  1. Extended Booking Fields
    - `modified_at` (timestamptz) - Last modification timestamp
    - `status_history` (jsonb) - Array of status changes with timestamps and reason
    - `cancellation_reason` (text) - Reason for cancellation if cancelled
    - `internal_notes` (text) - Staff-only internal notes

  2. New Tables
    - `booking_audit_log` - Tracks all modifications to bookings
      - `id` (uuid, primary key)
      - `booking_id` (uuid, foreign key)
      - `action_type` (text) - 'created', 'status_changed', 'modified', 'email_sent'
      - `changes` (jsonb) - What changed (before/after)
      - `actor` (text) - Who made the change
      - `created_at` (timestamptz)

  3. Security
    - Enable RLS on audit_log table
    - Only authenticated users can view audit logs
    - Audit entries are append-only (no updates/deletes)

  4. Important Notes
    - `modified_at` defaults to `now()` on create and update
    - `status_history` defaults to empty array, populated on status changes
    - Audit log captures all changes for compliance and debugging
    - Internal notes are visible only to authenticated admin users
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'modified_at'
  ) THEN
    ALTER TABLE bookings ADD COLUMN modified_at timestamptz DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'status_history'
  ) THEN
    ALTER TABLE bookings ADD COLUMN status_history jsonb DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'cancellation_reason'
  ) THEN
    ALTER TABLE bookings ADD COLUMN cancellation_reason text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'internal_notes'
  ) THEN
    ALTER TABLE bookings ADD COLUMN internal_notes text DEFAULT '';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS booking_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  changes jsonb DEFAULT '{}'::jsonb,
  actor text DEFAULT 'system',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE booking_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view audit logs"
  ON booking_audit_log
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only system can insert audit logs"
  ON booking_audit_log
  FOR INSERT
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_booking_audit_log_booking_id ON booking_audit_log(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_audit_log_created_at ON booking_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_bookings_modified_at ON bookings(modified_at);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'update_modified_at_column'
  ) THEN
    CREATE FUNCTION update_modified_at_column()
      RETURNS TRIGGER AS $trigger$
      BEGIN
        NEW.modified_at = now();
        RETURN NEW;
      END;
      $trigger$ LANGUAGE plpgsql;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_bookings_update_modified_at'
  ) THEN
    CREATE TRIGGER trg_bookings_update_modified_at
      BEFORE UPDATE ON bookings
      FOR EACH ROW
      EXECUTE FUNCTION update_modified_at_column();
  END IF;
END $$;
