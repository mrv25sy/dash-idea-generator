-- VICE STORE — complete database setup.
-- Paste into a fresh Supabase project's SQL Editor and run once.
-- Then create a private storage bucket "product-images" and upload brand/logo-red.png,
-- brand/logo-white.png and brand/payment-qr.jpg. Products/bundles can be re-added from /admin.

-- ROLES ----------------------------------------------------------------
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

-- Only the owner email becomes admin.
CREATE FUNCTION public.first_user_admin() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF lower(NEW.email) = 'vicemanger26@gmail.com' THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created_admin AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.first_user_admin();

-- PRODUCTS & BUNDLES ---------------------------------------------------
CREATE TABLE public.products (
  id text PRIMARY KEY,
  name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  sale_price numeric,
  images text[] NOT NULL DEFAULT '{}',
  colors jsonb NOT NULL DEFAULT '[]',
  sizes text[] NOT NULL DEFAULT '{}',
  category text NOT NULL DEFAULT 'tee',
  type text NOT NULL DEFAULT 'single',
  drop_name text,
  in_stock boolean NOT NULL DEFAULT true,
  coming_soon boolean NOT NULL DEFAULT false,
  badge text,
  description text,
  details jsonb NOT NULL DEFAULT '[]',
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.bundles (
  id text PRIMARY KEY,
  name text NOT NULL,
  product_ids text[] NOT NULL DEFAULT '{}',
  price numeric NOT NULL DEFAULT 0,
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products, public.bundles TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.products, public.bundles TO authenticated;
GRANT ALL ON public.products, public.bundles TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bundles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read products" ON public.products FOR SELECT USING (true);
CREATE POLICY "admin write products" ON public.products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "public read bundles" ON public.bundles FOR SELECT USING (true);
CREATE POLICY "admin write bundles" ON public.bundles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- STORE SETTINGS (payment info, logo + QR file paths) ------------------
CREATE TABLE public.store_settings (
  key text PRIMARY KEY, value text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.store_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.store_settings TO authenticated;
GRANT ALL ON public.store_settings TO service_role;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read settings" ON public.store_settings FOR SELECT USING (true);
CREATE POLICY "admin write settings" ON public.store_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.store_settings(key, value) VALUES
  ('payment_name', 'souha ghandour'),
  ('payment_address', '0fb817f99955a1fb3b671ccbce1d6434'),
  ('payment_qr_path', 'brand/payment-qr.jpg'),
  ('logo_red_path', 'brand/logo-red.png'),
  ('logo_white_path', 'brand/logo-white.png');

-- CUSTOMER PROFILES (optional accounts) --------------------------------
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text, phone text, governorate text, address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "admin read profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ORDERS ---------------------------------------------------------------
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code text NOT NULL,
  user_id uuid,                -- set when a signed-in customer orders; NULL for guests
  items jsonb NOT NULL DEFAULT '[]',
  total numeric NOT NULL DEFAULT 0,
  name text NOT NULL,
  phone text NOT NULL,
  governorate text NOT NULL,
  address text NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'Pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_user_id_idx ON public.orders(user_id);
GRANT INSERT ON public.orders TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone places order" ON public.orders FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'Pending' AND length(name) < 200 AND length(address) < 1000);
CREATE POLICY "order owner must match" ON public.orders AS RESTRICTIVE FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "own orders read" ON public.orders FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "admin reads orders" ON public.orders FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin updates orders" ON public.orders FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin deletes orders" ON public.orders FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Guest order tracking by order code, and customer cancel while Pending.
CREATE FUNCTION public.order_statuses(codes text[]) RETURNS TABLE(order_code text, status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT o.order_code, o.status FROM public.orders o WHERE o.order_code = ANY(codes) LIMIT 100 $$;
CREATE FUNCTION public.cancel_order(code text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS
$$ UPDATE public.orders SET status = 'Canceled' WHERE order_code = code AND lower(status) = 'pending' $$;
GRANT EXECUTE ON FUNCTION public.order_statuses(text[]), public.cancel_order(text) TO anon, authenticated;

-- STORAGE --------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit) VALUES ('product-images', 'product-images', false, 10485760)
ON CONFLICT (id) DO NOTHING;
CREATE POLICY "view product images" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
CREATE POLICY "admin upload product images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin delete product images" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'));

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

-- PROFILE PHOTOS + STORE INBOX -----------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
CREATE TABLE IF NOT EXISTS public.broadcast_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 5000),
  tag text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.broadcast_messages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.broadcast_messages TO authenticated;
GRANT ALL ON public.broadcast_messages TO service_role;
ALTER TABLE public.broadcast_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads messages" ON public.broadcast_messages FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin writes messages" ON public.broadcast_messages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "users upload own avatar" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND (storage.foldername(name))[1] = 'avatars' AND (storage.foldername(name))[2] = auth.uid()::text);
CREATE POLICY "users read own avatar" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = 'avatars' AND (storage.foldername(name))[2] = auth.uid()::text);
CREATE POLICY "users update own avatar" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = 'avatars' AND (storage.foldername(name))[2] = auth.uid()::text);

-- PRODUCT FAVORITES ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_favorites (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);
GRANT SELECT, INSERT, DELETE ON public.product_favorites TO authenticated;
GRANT ALL ON public.product_favorites TO service_role;
ALTER TABLE public.product_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own favorites read" ON public.product_favorites FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own favorites insert" ON public.product_favorites FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own favorites delete" ON public.product_favorites FOR DELETE TO authenticated USING (user_id = auth.uid());
