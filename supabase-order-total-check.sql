-- Server-side order total check. Run once in your database's SQL editor.
-- Every new order's total is recomputed from the real product/bundle prices and the
-- coupon rules in store_settings.coupons_json; a mismatching total is rejected.
CREATE OR REPLACE FUNCTION public.verify_order_total() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  it jsonb; c jsonb; cats jsonb;
  unit numeric; qty int; cat text;
  subtotal numeric := 0; elig_items int := 0; elig_total numeric := 0; all_items int := 0;
  discount numeric := 0; code text; cust int; expected numeric;
BEGIN
  FOR it IN SELECT * FROM jsonb_array_elements(COALESCE(NEW.items, '[]'::jsonb)) LOOP
    IF it->>'kind' = 'coupon' THEN code := upper(it->>'code'); CONTINUE; END IF;
    IF it->>'kind' NOT IN ('single', 'bundle') THEN CONTINUE; END IF;
    qty := GREATEST(1, COALESCE((it->>'qty')::int, 1));
    IF it->>'kind' = 'bundle' THEN
      SELECT price INTO unit FROM bundles WHERE id = it->>'bundleId';
      cat := 'bundle';
    ELSE
      SELECT CASE WHEN sale_price IS NOT NULL AND sale_price < price THEN sale_price ELSE price END, category
        INTO unit, cat FROM products WHERE id = it->'pieces'->0->>'productId';
    END IF;
    IF unit IS NULL THEN RAISE EXCEPTION 'PRICE_MISMATCH: unknown item'; END IF;
    subtotal := subtotal + unit * qty;
    all_items := all_items + qty;
    it := jsonb_set(it, '{cat}', to_jsonb(cat));
    -- remember lines for coupon eligibility
    PERFORM set_config('vice.lines', COALESCE(current_setting('vice.lines', true), '') || cat || ':' || qty || ':' || (unit * qty) || ';', true);
  END LOOP;

  IF code IS NOT NULL THEN
    SELECT e INTO c FROM store_settings s, jsonb_array_elements(s.value::jsonb) e
      WHERE s.key = 'coupons_json' AND upper(e->>'code') = code LIMIT 1;
    IF c IS NULL OR NOT COALESCE((c->>'active')::boolean, false) THEN RAISE EXCEPTION 'COUPON_INVALID'; END IF;
    IF c->>'startsAt' IS NOT NULL AND now() < (c->>'startsAt')::timestamptz THEN RAISE EXCEPTION 'COUPON_INVALID'; END IF;
    IF c->>'endsAt' IS NOT NULL AND now() > (c->>'endsAt')::timestamptz THEN RAISE EXCEPTION 'COUPON_INVALID'; END IF;
    IF auth.uid() IS NOT NULL THEN
      cust := (('x' || substr(replace(auth.uid()::text, '-', ''), 1, 8))::bit(32)::bigint & 4294967295) % 90000 + 10000;
    END IF;
    IF jsonb_array_length(COALESCE(c->'customerIds', '[]')) > 0 AND (cust IS NULL OR NOT (c->'customerIds') @> to_jsonb(cust)) THEN
      RAISE EXCEPTION 'COUPON_INVALID';
    END IF;
    IF COALESCE((c->>'oncePerCustomer')::boolean, false) THEN
      IF auth.uid() IS NULL OR EXISTS (SELECT 1 FROM orders o, jsonb_array_elements(o.items) x
          WHERE o.user_id = auth.uid() AND x->>'kind' = 'coupon' AND upper(x->>'code') = code) THEN
        RAISE EXCEPTION 'COUPON_INVALID';
      END IF;
    END IF;
    cats := COALESCE(c->'categories', '[]');
    SELECT COALESCE(sum(split_part(l, ':', 2)::int), 0), COALESCE(sum(split_part(l, ':', 3)::numeric), 0)
      INTO elig_items, elig_total
      FROM unnest(string_to_array(current_setting('vice.lines', true), ';')) l
      WHERE l <> '' AND (jsonb_array_length(cats) = 0 OR cats ? split_part(l, ':', 1));
    IF elig_items = 0 OR elig_items < COALESCE((c->>'minItems')::int, 0)
       OR subtotal < COALESCE((c->>'minSpend')::numeric, 0) THEN RAISE EXCEPTION 'COUPON_INVALID'; END IF;
    IF c->>'type' = 'percent' THEN discount := round(elig_total * LEAST(100, (c->>'value')::numeric) / 100);
    ELSE discount := LEAST(elig_total, (c->>'value')::numeric); END IF;
  END IF;
  PERFORM set_config('vice.lines', '', true);

  expected := GREATEST(0, subtotal - GREATEST(0, discount));
  IF abs(COALESCE(NEW.total, -1) - expected) > 0.01 THEN
    RAISE EXCEPTION 'PRICE_MISMATCH: expected %', expected;
  END IF;
  NEW.total := expected;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS verify_order_total ON public.orders;
CREATE TRIGGER verify_order_total BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.verify_order_total();
