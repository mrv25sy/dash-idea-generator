-- PRODUCT RATINGS (1–5 stars, signed-in customers only) -----------------
CREATE TABLE IF NOT EXISTS public.product_ratings (
  product_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stars smallint NOT NULL CHECK (stars BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, user_id)
);
GRANT SELECT ON public.product_ratings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_ratings TO authenticated;
GRANT ALL ON public.product_ratings TO service_role;
ALTER TABLE public.product_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read ratings" ON public.product_ratings FOR SELECT USING (true);
CREATE POLICY "own rating insert" ON public.product_ratings FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own rating update" ON public.product_ratings FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own rating delete" ON public.product_ratings FOR DELETE TO authenticated USING (user_id = auth.uid());
