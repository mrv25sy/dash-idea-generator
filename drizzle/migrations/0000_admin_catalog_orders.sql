DROP TYPE IF EXISTS public.app_role; CREATE TYPE public.app_role AS ENUM ('admin','user');
CREATE TABLE public.user_roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL, role public.app_role NOT NULL, UNIQUE(user_id, role));
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;
CREATE POLICY "own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_first_admin() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created_admin AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_first_admin();

CREATE TABLE public.products (
  id text PRIMARY KEY, name text NOT NULL, price numeric NOT NULL DEFAULT 0,
  images text[] NOT NULL DEFAULT '{}', colors jsonb NOT NULL DEFAULT '[]', sizes text[] NOT NULL DEFAULT '{}',
  category text NOT NULL DEFAULT 'tee', type text NOT NULL DEFAULT 'single', drop_name text,
  in_stock boolean NOT NULL DEFAULT true, coming_soon boolean NOT NULL DEFAULT false, badge text,
  sort int NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.products TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read products" ON public.products FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin write products" ON public.products FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.bundles (id text PRIMARY KEY, name text NOT NULL, product_ids text[] NOT NULL DEFAULT '{}', price numeric NOT NULL DEFAULT 0, sort int NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.bundles TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.bundles TO authenticated;
GRANT ALL ON public.bundles TO service_role;
ALTER TABLE public.bundles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read bundles" ON public.bundles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin write bundles" ON public.bundles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_code text NOT NULL, items jsonb NOT NULL DEFAULT '[]',
  total numeric NOT NULL DEFAULT 0, name text NOT NULL, phone text NOT NULL, governorate text NOT NULL,
  address text NOT NULL, notes text, status text NOT NULL DEFAULT 'pending', created_at timestamptz NOT NULL DEFAULT now());
GRANT INSERT ON public.orders TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone places orders" ON public.orders FOR INSERT TO anon, authenticated WITH CHECK (status = 'pending' AND length(name) < 200 AND length(address) < 1000);
CREATE POLICY "admin reads orders" ON public.orders FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin updates orders" ON public.orders FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin deletes orders" ON public.orders FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "read product images" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'product-images');
CREATE POLICY "admin upload product images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-images' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin delete product images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'product-images' AND public.has_role(auth.uid(),'admin'));

INSERT INTO public.products (id,name,price,images,colors,sizes,category,type,drop_name,in_stock,coming_soon,badge,sort) VALUES
('ny-soul-club','New York Soul Club Tee',25,'{asset:nysc}','[{"name":"Black","hex":"#0d0d0d"},{"name":"White","hex":"#f2f2f2"}]','{S,M,L,XL,XXL}','tee','single',null,true,false,'New',1),
('extraordinary-cap','Extraordinary Cap',15,'{asset:cap}','[{"name":"Black","hex":"#0d0d0d"},{"name":"Crimson","hex":"#c30023"}]','{"One size"}','cap','single',null,true,false,null,2),
('sakura-tee','Sakura Tee',27,'{asset:sakura}','[{"name":"White","hex":"#f2f2f2"},{"name":"Black","hex":"#0d0d0d"}]','{S,M,L,XL,XXL}','tee','single',null,false,false,null,3),
('last-dance-tee','The Last Dance Tee',28,'{asset:lastdance}','[{"name":"Washed grey","hex":"#4a4a4a"},{"name":"Black","hex":"#0d0d0d"}]','{S,M,L,XL,XXL}','tee','single',null,true,false,null,4),
('after-midnight-hoodie','After Midnight Hoodie',45,'{asset:hoodie-midnight}','[{"name":"Black","hex":"#0d0d0d"},{"name":"Washed grey","hex":"#4a4a4a"}]','{S,M,L,XL,XXL}','hoodie','single',null,true,false,'New',5),
('vice-script-hoodie','Vice Script Hoodie',48,'{asset:hoodie-script}','[{"name":"Washed grey","hex":"#4a4a4a"},{"name":"Black","hex":"#0d0d0d"}]','{S,M,L,XL,XXL}','hoodie','single',null,true,false,null,6),
('d-soul-night','Soul Night Tee',30,'{asset:nysc}','[{"name":"Black","hex":"#0d0d0d"}]','{S,M,L,XL,XXL}','tee','drop','Night Shift',true,false,'Drop',7),
('d-crimson-cap','Crimson Script Cap',18,'{asset:cap}','[{"name":"Black","hex":"#0d0d0d"},{"name":"Crimson","hex":"#c30023"}]','{"One size"}','cap','drop','Night Shift',true,false,'Drop',8),
('d-bloom','Bloom Back Tee',32,'{asset:sakura}','[{"name":"White","hex":"#f2f2f2"}]','{S,M,L,XL,XXL}','tee','drop','Night Shift',false,true,null,9),
('d-23','Twenty Three Tee',32,'{asset:lastdance}','[{"name":"Washed grey","hex":"#4a4a4a"}]','{S,M,L,XL,XXL}','tee','drop','Night Shift',true,false,'Drop',10);
INSERT INTO public.bundles (id,name,product_ids,price,sort) VALUES
('soul-fit','The Soul Fit','{ny-soul-club,extraordinary-cap}',34,1),
('court-fit','The Court Fit','{last-dance-tee,extraordinary-cap}',37,2),
('full-fit','The Full Rotation','{ny-soul-club,last-dance-tee,extraordinary-cap}',58,3);