/*
  # Fix locations RLS policies

  1. Changes
    - Drop the overly restrictive "Service role can manage locations" policy
      that only allowed service_role to insert/update/delete
    - Drop the "Anyone can view active locations" SELECT policy
    - Add new policies matching the bikes table pattern:
      - Anon + authenticated can SELECT all locations
      - Anon + authenticated can INSERT locations
      - Anon + authenticated can UPDATE locations
      - Anon + authenticated can DELETE locations

  2. Reason
    - The admin panel uses the anon key (no Supabase auth),
      so management policies must allow anon access,
      consistent with how bikes and other tables work.
*/

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Service role can manage locations' AND polrelid = 'public.locations'::regclass) THEN
    DROP POLICY "Service role can manage locations" ON public.locations;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Anyone can view active locations' AND polrelid = 'public.locations'::regclass) THEN
    DROP POLICY "Anyone can view active locations" ON public.locations;
  END IF;
END $$;

CREATE POLICY "Anon and authenticated can view locations"
  ON public.locations
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anon and authenticated can insert locations"
  ON public.locations
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anon and authenticated can update locations"
  ON public.locations
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon and authenticated can delete locations"
  ON public.locations
  FOR DELETE
  TO anon, authenticated
  USING (true);
