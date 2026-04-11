
CREATE TABLE public.store_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  promo_type text NOT NULL DEFAULT 'discount',
  discount_percent integer DEFAULT 10,
  special_item_name text DEFAULT '',
  special_item_description text DEFAULT '',
  coupon_title text DEFAULT '🎉 รางวัลรีวิวเวอร์!',
  coupon_subtitle text DEFAULT 'ขอบคุณที่ให้ feedback',
  duration_seconds integer NOT NULL DEFAULT 300,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(store_id)
);

ALTER TABLE public.store_promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read store_promotions" ON public.store_promotions
  FOR SELECT TO public USING (true);

CREATE POLICY "Store owners can manage store_promotions" ON public.store_promotions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM stores WHERE stores.id = store_promotions.store_id AND stores.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM stores WHERE stores.id = store_promotions.store_id AND stores.user_id = auth.uid()));

CREATE POLICY "Store members can manage store_promotions" ON public.store_promotions
  FOR ALL TO authenticated
  USING (is_store_member(auth.uid(), store_id))
  WITH CHECK (is_store_member(auth.uid(), store_id));
