CREATE TABLE public.waiter_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  table_number integer NOT NULL,
  guest_id text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.waiter_calls ENABLE ROW LEVEL SECURITY;

-- Anyone can insert a waiter call (guests too)
CREATE POLICY "Anyone can insert waiter_calls" ON public.waiter_calls
  FOR INSERT TO public WITH CHECK (true);

-- Store owners can read their store's calls
CREATE POLICY "Store owners can read waiter_calls" ON public.waiter_calls
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM stores WHERE stores.id = waiter_calls.store_id AND stores.user_id = auth.uid()));

-- Store owners can update their store's calls
CREATE POLICY "Store owners can update waiter_calls" ON public.waiter_calls
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM stores WHERE stores.id = waiter_calls.store_id AND stores.user_id = auth.uid()));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.waiter_calls;