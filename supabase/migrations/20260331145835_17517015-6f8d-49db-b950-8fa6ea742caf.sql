
-- Create queues table
CREATE TABLE public.queues (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  queue_number INTEGER NOT NULL,
  party_size SMALLINT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'waiting',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.queues ENABLE ROW LEVEL SECURITY;

-- Anyone can read queues
CREATE POLICY "Anyone can read queues" ON public.queues
  FOR SELECT TO public USING (true);

-- Authenticated users can insert their own queue entry
CREATE POLICY "Users can insert own queue" ON public.queues
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Users can update own queue (e.g. cancel)
CREATE POLICY "Users can update own queue" ON public.queues
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Store owners can update queues for their store (e.g. call/complete)
CREATE POLICY "Store owners can update store queues" ON public.queues
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.stores WHERE stores.id = queues.store_id AND stores.user_id = auth.uid()));

-- Create next_queue_number function
CREATE OR REPLACE FUNCTION public.next_queue_number(p_store_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(MAX(queue_number), 0) + 1
  FROM public.queues
  WHERE store_id = p_store_id
    AND created_at::date = CURRENT_DATE
$$;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.queues;
