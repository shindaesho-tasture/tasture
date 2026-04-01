
-- Store claims table
CREATE TABLE public.store_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  claimant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  reason TEXT,
  admin_note TEXT,
  reviewed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, claimant_id)
);

ALTER TABLE public.store_claims ENABLE ROW LEVEL SECURITY;

-- Users can read own claims
CREATE POLICY "Users can read own claims"
  ON public.store_claims FOR SELECT TO authenticated
  USING (auth.uid() = claimant_id);

-- Users can insert own claims
CREATE POLICY "Users can insert own claims"
  ON public.store_claims FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = claimant_id);

-- Admins can read all claims
CREATE POLICY "Admins can read all claims"
  ON public.store_claims FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update claims (approve/reject)
CREATE POLICY "Admins can update claims"
  ON public.store_claims FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can delete claims
CREATE POLICY "Admins can delete claims"
  ON public.store_claims FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
