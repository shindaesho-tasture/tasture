-- ─── Performance Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_menu_items_store_id        ON menu_items(store_id);
CREATE INDEX IF NOT EXISTS idx_reviews_store_id           ON reviews(store_id);
CREATE INDEX IF NOT EXISTS idx_dish_dna_menu_item_id      ON dish_dna(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_dish_dna_user_id           ON dish_dna(user_id);
CREATE INDEX IF NOT EXISTS idx_dish_dna_created_at        ON dish_dna(created_at);
CREATE INDEX IF NOT EXISTS idx_menu_reviews_menu_item_id  ON menu_reviews(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_menu_reviews_created_at    ON menu_reviews(created_at);

-- ─── RPC 1: Stores + Menu Summary ──────────────────────────────────────────
-- Replaces Phase 1: 2 queries (stores + 2000 menu rows) → 1 RPC (~100 rows)
CREATE OR REPLACE FUNCTION get_stores_with_menu_summary()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  WITH store_list AS (
    SELECT id, name, category_id, verified, pin_lat, pin_lng, menu_photo
    FROM stores
    ORDER BY created_at DESC
    LIMIT 100
  ),
  menu_summary AS (
    SELECT
      mi.store_id,
      COUNT(*)                                                        AS menu_count,
      MIN(mi.image_url) FILTER (WHERE mi.image_url IS NOT NULL)      AS first_image
    FROM menu_items mi
    WHERE mi.store_id IN (SELECT id FROM store_list)
    GROUP BY mi.store_id
  )
  SELECT jsonb_build_object(
    'stores',       COALESCE((SELECT jsonb_agg(row_to_json(sl)) FROM store_list    sl), '[]'::jsonb),
    'menu_summary', COALESCE((SELECT jsonb_agg(row_to_json(ms)) FROM menu_summary  ms), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_stores_with_menu_summary() TO authenticated, anon;

-- ─── RPC 2: Full Enrichment Data ────────────────────────────────────────────
-- Replaces Phase 2: 6 parallel chunkedIn queries → 1 server-side aggregation
CREATE OR REPLACE FUNCTION get_store_enrichment(
  p_store_ids uuid[],
  p_since     timestamptz,
  p_user_id   uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  WITH
  -- Review scores pre-aggregated per (store, metric)
  review_scores AS (
    SELECT
      store_id,
      metric_id,
      ROUND(AVG(score)::numeric, 2) AS avg_score,
      COUNT(*)                       AS cnt
    FROM reviews
    WHERE store_id = ANY(p_store_ids)
    GROUP BY store_id, metric_id
  ),
  -- Lightweight menu-to-store lookup for joining
  store_menus AS (
    SELECT id AS menu_item_id, store_id
    FROM menu_items
    WHERE store_id = ANY(p_store_ids)
  ),
  -- Recent activity count per store (menu_reviews + dish_dna in last N days)
  recent_activity AS (
    SELECT sm.store_id, COUNT(*) AS activity_count
    FROM (
      SELECT menu_item_id FROM menu_reviews WHERE created_at >= p_since
      UNION ALL
      SELECT menu_item_id FROM dish_dna     WHERE created_at >= p_since
    ) recent_items
    JOIN store_menus sm ON sm.menu_item_id = recent_items.menu_item_id
    GROUP BY sm.store_id
  ),
  -- Total DNA tag count per store
  dna_counts AS (
    SELECT sm.store_id, COUNT(*) AS dna_count
    FROM dish_dna dd
    JOIN store_menus sm ON sm.menu_item_id = dd.menu_item_id
    GROUP BY sm.store_id
  ),
  -- Total menu review count per store
  menu_rev_counts AS (
    SELECT sm.store_id, COUNT(*) AS mr_count
    FROM menu_reviews mr
    JOIN store_menus sm ON sm.menu_item_id = mr.menu_item_id
    GROUP BY sm.store_id
  ),
  -- Store DNA taste profile per component (for match % calculation)
  store_dna_profile AS (
    SELECT sm.store_id, dd.component_name, AVG(dd.selected_score) AS avg_score
    FROM dish_dna dd
    JOIN store_menus sm ON sm.menu_item_id = dd.menu_item_id
    GROUP BY sm.store_id, dd.component_name
  ),
  -- User's taste preferences (only when logged in; user_id = NULL → no rows)
  user_dna AS (
    SELECT component_name, SUM(selected_score) AS pref_score
    FROM dish_dna
    WHERE user_id = p_user_id
      AND selected_score <> 0
    GROUP BY component_name
  )
  SELECT jsonb_build_object(
    'review_scores',    COALESCE((SELECT jsonb_agg(row_to_json(rs))  FROM review_scores    rs),  '[]'::jsonb),
    'recent_activity',  COALESCE((SELECT jsonb_agg(row_to_json(ra))  FROM recent_activity  ra),  '[]'::jsonb),
    'dna_counts',       COALESCE((SELECT jsonb_agg(row_to_json(dc))  FROM dna_counts       dc),  '[]'::jsonb),
    'menu_rev_counts',  COALESCE((SELECT jsonb_agg(row_to_json(mrc)) FROM menu_rev_counts  mrc), '[]'::jsonb),
    'store_dna_profile',COALESCE((SELECT jsonb_agg(row_to_json(sdp)) FROM store_dna_profile sdp),'[]'::jsonb),
    'user_dna',         COALESCE((SELECT jsonb_agg(row_to_json(ud))  FROM user_dna         ud),  '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_store_enrichment(uuid[], timestamptz, uuid) TO authenticated, anon;
