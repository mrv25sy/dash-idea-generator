-- Run once in your database's SQL Editor.
-- 1) claim_orders: links orders placed while signed out to the account at sign-in.
-- 2) order_stock_apply: deducts/restores stock per color (colors[].sizeStock) in
--    addition to the existing per-size (size_stock) and whole-product (stock) pools.

-- 1) GUEST ORDER CLAIMING -------------------------------------------------------
-- A signed-in customer proves ownership of a guest order with its secret token;
-- the order is then attached to their account so it appears on every device.
CREATE OR REPLACE FUNCTION public.claim_orders(tokens uuid[]) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 0; END IF;
  UPDATE public.orders
     SET user_id = auth.uid()
   WHERE user_id IS NULL AND access_token = ANY(tokens);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.claim_orders(uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.claim_orders(uuid[]) TO authenticated;

-- 2) COLOR-AWARE STOCK ----------------------------------------------------------
-- Pieces in an order carry a color name. When the product's colors list tracks
-- stock for that color+size, deduct there; otherwise fall back to size_stock,
-- then to whole-product stock. A color is auto-marked soldOut when all its
-- sizes reach 0, and the product goes out of stock only when every pool is empty.
CREATE OR REPLACE FUNCTION public.order_stock_apply(_items jsonb, _sign integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE line jsonb; pc jsonb; q integer; sz text; col text;
BEGIN
  FOR line IN SELECT * FROM jsonb_array_elements(COALESCE(_items, '[]'::jsonb)) LOOP
    IF jsonb_typeof(line->'pieces') <> 'array' THEN CONTINUE; END IF;
    q := COALESCE((line->>'qty')::integer, 1);
    FOR pc IN SELECT * FROM jsonb_array_elements(line->'pieces') LOOP
      sz := COALESCE(pc->>'size', '');
      col := COALESCE(pc->>'color', '');
      -- Per-color, per-size stock when this color tracks this size
      UPDATE public.products
         SET colors = (
           SELECT jsonb_agg(
             CASE WHEN el->>'name' = col AND el->'sizeStock' ? sz
                  THEN jsonb_set(el, ARRAY['sizeStock', sz], to_jsonb(GREATEST((el->'sizeStock'->>sz)::integer - _sign * q, 0)))
                  ELSE el END)
           FROM jsonb_array_elements(colors) el)
       WHERE id = pc->>'productId'
         AND EXISTS (SELECT 1 FROM jsonb_array_elements(colors) e WHERE e->>'name' = col AND e->'sizeStock' ? sz);
      -- Per-size stock when this size is listed (and no color pool handled it)
      UPDATE public.products
         SET size_stock = jsonb_set(size_stock, ARRAY[sz], to_jsonb(GREATEST((size_stock->>sz)::integer - _sign * q, 0)))
       WHERE id = pc->>'productId' AND size_stock ? sz
         AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(colors, '[]'::jsonb)) e WHERE e->>'name' = col AND e->'sizeStock' ? sz);
      -- Otherwise whole-product stock
      UPDATE public.products
         SET stock = GREATEST(stock - _sign * q, 0)
       WHERE id = pc->>'productId' AND stock IS NOT NULL AND NOT (COALESCE(size_stock, '{}'::jsonb) ? sz)
         AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(colors, '[]'::jsonb)) e WHERE e->>'name' = col AND e->'sizeStock' ? sz);
      -- A color is sold out when none of its tracked sizes have pieces left
      UPDATE public.products
         SET colors = (
           SELECT jsonb_agg(
             CASE WHEN el ? 'sizeStock'
                  THEN jsonb_set(el, '{soldOut}', to_jsonb(NOT EXISTS (SELECT 1 FROM jsonb_each_text(el->'sizeStock') e WHERE e.value::integer > 0)))
                  ELSE el END)
           FROM jsonb_array_elements(colors) el)
       WHERE id = pc->>'productId' AND colors IS NOT NULL;
      -- Sold out when nothing is left anywhere; back in stock when pieces return
      UPDATE public.products p
         SET in_stock = CASE
           WHEN NOT p.coming_soon AND (
             (p.stock IS NOT NULL AND p.stock > 0)
             OR EXISTS (SELECT 1 FROM jsonb_each_text(COALESCE(p.size_stock, '{}'::jsonb)) e WHERE e.value::integer > 0)
             OR EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(p.colors, '[]'::jsonb)) c,
                        jsonb_each_text(COALESCE(c->'sizeStock', '{}'::jsonb)) e WHERE e.value::integer > 0)
           ) THEN true
           ELSE false END
       WHERE p.id = pc->>'productId'
         AND (p.stock IS NOT NULL OR p.size_stock IS NOT NULL
              OR EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(p.colors, '[]'::jsonb)) c WHERE c ? 'sizeStock'));
    END LOOP;
  END LOOP;
END $$;
REVOKE EXECUTE ON FUNCTION public.order_stock_apply(jsonb, integer) FROM PUBLIC, anon, authenticated;
