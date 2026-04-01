
CREATE TABLE public.bill_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  table_number integer NOT NULL,
  guest_id text,
  order_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bill_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert bill_requests" ON public.bill_requests
  FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Store owners can read bill_requests" ON public.bill_requests
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM stores WHERE stores.id = bill_requests.store_id AND stores.user_id = auth.uid())
    OR public.is_store_member(auth.uid(), store_id)
  );

CREATE POLICY "Store owners can update bill_requests" ON public.bill_requests
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM stores WHERE stores.id = bill_requests.store_id AND stores.user_id = auth.uid())
    OR public.is_store_member(auth.uid(), store_id)
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.bill_requests;
