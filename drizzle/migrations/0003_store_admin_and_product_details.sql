CREATE OR REPLACE FUNCTION public.handle_first_admin()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF lower(NEW.email) = 'vicestore.syr@gmail.com' THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
DELETE FROM public.user_roles WHERE role = 'admin' AND user_id NOT IN (SELECT id FROM auth.users WHERE lower(email) = 'vicestore.syr@gmail.com');
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sale_price numeric;