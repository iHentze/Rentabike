/*
  # Add picked_up and returned booking statuses

  1. Modified Tables
    - `bookings`
      - Updated status check constraint to allow 'picked_up' and 'returned' values
  
  2. Changes
    - Drops old check constraint that only allowed pending/confirmed/cancelled
    - Adds new check constraint that also allows picked_up and returned
    - This enables tracking the full booking lifecycle
*/

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;

ALTER TABLE bookings ADD CONSTRAINT bookings_status_check 
  CHECK (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'cancelled'::text, 'picked_up'::text, 'returned'::text]));
