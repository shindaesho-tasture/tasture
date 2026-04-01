
-- Create orders table
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  guest_id text,
  order_number serial,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  customer_language text NOT NULL DEFAULT 'th',
  notes text,
  total_price numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Anyone can read orders for a store they own
CREATE POLICY "Store owners can read store orders"
ON public.orders FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM stores WHERE stores.id = orders.store_id AND stores.user_id = auth.uid()));

-- Users can read own orders
CREATE POLICY "Users can read own orders"
ON public.orders FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Anyone can insert orders (guest-first)
CREATE POLICY "Anyone can insert orders"
ON public.orders FOR INSERT TO public
WITH CHECK (true);

-- Store owners can update order status
CREATE POLICY "Store owners can update store orders"
ON public.orders FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM stores WHERE stores.id = orders.store_id AND stores.user_id = auth.uid()));

-- Admins can manage all orders
CREATE POLICY "Admins can manage orders"
ON public.orders FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
