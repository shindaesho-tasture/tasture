
-- Store members table
CREATE TABLE public.store_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'staff' CHECK (role IN ('owner', 'manager', 'staff')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, user_id)
);

ALTER TABLE public.store_members ENABLE ROW LEVEL SECURITY;

-- Helper function to check store membership
CREATE OR REPLACE FUNCTION public.is_store_member(_user_id uuid, _store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.store_members
    WHERE user_id = _user_id AND store_id = _store_id
  ) OR EXISTS (
    SELECT 1 FROM public.stores
    WHERE id = _store_id AND user_id = _user_id
  )
$$;

-- Helper to check store role
CREATE OR REPLACE FUNCTION public.get_store_role(_user_id uuid, _store_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.stores WHERE id = _store_id AND user_id = _user_id) THEN 'owner'
    ELSE (SELECT role FROM public.store_members WHERE user_id = _user_id AND store_id = _store_id)
  END
$$;

-- RLS for store_members
CREATE POLICY "Store members can read own store members" ON public.store_members
  FOR SELECT TO authenticated
  USING (public.is_store_member(auth.uid(), store_id));

CREATE POLICY "Owner/manager can insert store members" ON public.store_members
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_store_role(auth.uid(), store_id) IN ('owner', 'manager')
  );

CREATE POLICY "Owner/manager can update store members" ON public.store_members
  FOR UPDATE TO authenticated
  USING (public.get_store_role(auth.uid(), store_id) IN ('owner', 'manager'));

CREATE POLICY "Owner/manager can delete store members" ON public.store_members
  FOR DELETE TO authenticated
  USING (public.get_store_role(auth.uid(), store_id) IN ('owner', 'manager'));

-- Store invites table
CREATE TABLE public.store_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  role text NOT NULL DEFAULT 'staff' CHECK (role IN ('manager', 'staff')),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  used_by uuid REFERENCES auth.users(id),
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.store_invites ENABLE ROW LEVEL SECURITY;

-- RLS for store_invites
CREATE POLICY "Store members can read invites" ON public.store_invites
  FOR SELECT TO authenticated
  USING (public.is_store_member(auth.uid(), store_id));

CREATE POLICY "Owner/manager can create invites" ON public.store_invites
  FOR INSERT TO authenticated
  WITH CHECK (public.get_store_role(auth.uid(), store_id) IN ('owner', 'manager'));

CREATE POLICY "Owner/manager can delete invites" ON public.store_invites
  FOR DELETE TO authenticated
  USING (public.get_store_role(auth.uid(), store_id) IN ('owner', 'manager'));

CREATE POLICY "Anyone authenticated can read invite by token" ON public.store_invites
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Anyone authenticated can update invite to accept" ON public.store_invites
  FOR UPDATE TO authenticated
  USING (used_by IS NULL AND expires_at > now());

-- Add SELECT policy for orders/waiter_calls for store members
CREATE POLICY "Store members can read store orders" ON public.orders
  FOR SELECT TO authenticated
  USING (public.is_store_member(auth.uid(), store_id));

CREATE POLICY "Store members can update store orders" ON public.orders
  FOR UPDATE TO authenticated
  USING (public.is_store_member(auth.uid(), store_id));

CREATE POLICY "Store members can read waiter_calls" ON public.waiter_calls
  FOR SELECT TO authenticated
  USING (public.is_store_member(auth.uid(), store_id));

CREATE POLICY "Store members can update waiter_calls" ON public.waiter_calls
  FOR UPDATE TO authenticated
  USING (public.is_store_member(auth.uid(), store_id));
