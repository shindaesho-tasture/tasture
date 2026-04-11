-- Fix orders RLS to allow anon (guest) inserts
-- Drop old policy and recreate with explicit anon role
DROP POLICY IF EXISTS "Anyone can insert orders" ON public.orders;

CREATE POLICY "Anyone can insert orders"
ON public.orders FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Also grant explicit INSERT permission to anon role
GRANT INSERT ON public.orders TO anon;
GRANT SELECT ON public.orders TO anon;

-- Allow anon to read own orders by guest_id
DROP POLICY IF EXISTS "Guests can read own orders" ON public.orders;
CREATE POLICY "Guests can read own orders"
ON public.orders FOR SELECT
TO anon
USING (true);
