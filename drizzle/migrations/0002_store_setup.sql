do $$ begin if not exists (select 1 from pg_type where typname='app_role') then create type public.app_role as enum ('admin','user'); end if; end $$;
create table if not exists public.user_roles (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade not null, role app_role not null, unique(user_id, role));
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create or replace function public.has_role(_user_id uuid, _role app_role) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.user_roles where user_id=_user_id and role=_role) $$;
drop policy if exists "own roles readable" on public.user_roles;
create policy "own roles readable" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.first_user_admin() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if not exists (select 1 from public.user_roles where role='admin') then
    insert into public.user_roles(user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $$;
drop trigger if exists on_auth_user_created_admin on auth.users;
create trigger on_auth_user_created_admin after insert on auth.users for each row execute function public.first_user_admin();

create table if not exists public.products (
  id text primary key, name text not null, price numeric not null default 0, images text[] not null default '{}',
  colors jsonb not null default '[]', sizes text[] not null default '{}', category text not null default 'tee',
  type text not null default 'single', drop_name text, in_stock boolean not null default true,
  coming_soon boolean not null default false, badge text, sort int not null default 0, created_at timestamptz not null default now());
grant select on public.products to anon;
grant select, insert, update, delete on public.products to authenticated;
grant all on public.products to service_role;
alter table public.products enable row level security;
drop policy if exists "public read products" on public.products;
drop policy if exists "admin write products" on public.products;
create policy "public read products" on public.products for select using (true);
create policy "admin write products" on public.products for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table if not exists public.bundles (id text primary key, name text not null, product_ids text[] not null default '{}', price numeric not null default 0, sort int not null default 0, created_at timestamptz not null default now());
grant select on public.bundles to anon;
grant select, insert, update, delete on public.bundles to authenticated;
grant all on public.bundles to service_role;
alter table public.bundles enable row level security;
drop policy if exists "public read bundles" on public.bundles;
drop policy if exists "admin write bundles" on public.bundles;
create policy "public read bundles" on public.bundles for select using (true);
create policy "admin write bundles" on public.bundles for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(), order_code text not null, name text not null, phone text not null,
  governorate text not null, address text not null, notes text, items jsonb not null default '[]', total numeric not null default 0,
  status text not null default 'Pending', created_at timestamptz not null default now());
grant insert on public.orders to anon;
grant select, insert, update, delete on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
drop policy if exists "anyone places order" on public.orders;
drop policy if exists "admin reads orders" on public.orders;
drop policy if exists "admin updates orders" on public.orders;
drop policy if exists "admin deletes orders" on public.orders;
create policy "anyone places order" on public.orders for insert to anon, authenticated with check (status = 'Pending' and length(name) < 200 and length(address) < 1000);
create policy "admin reads orders" on public.orders for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "admin updates orders" on public.orders for update to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "admin deletes orders" on public.orders for delete to authenticated using (public.has_role(auth.uid(),'admin'));

drop policy if exists "public view product images" on storage.objects;
drop policy if exists "admin upload product images" on storage.objects;
drop policy if exists "admin delete product images" on storage.objects;
create policy "public view product images" on storage.objects for select using (bucket_id = 'product-images');
create policy "admin upload product images" on storage.objects for insert to authenticated with check (bucket_id = 'product-images' and public.has_role(auth.uid(),'admin'));
create policy "admin delete product images" on storage.objects for delete to authenticated using (bucket_id = 'product-images' and public.has_role(auth.uid(),'admin'));

insert into public.products (id,name,price,images,colors,sizes,category,type,drop_name,in_stock,coming_soon,badge,sort) values
('ny-soul-club','New York Soul Club Tee',25,'{asset:nysc}','[{"name":"Black","hex":"#0d0d0d"},{"name":"White","hex":"#f2f2f2"}]','{S,M,L,XL,XXL}','tee','single',null,true,false,'New',1),
('extraordinary-cap','Extraordinary Cap',15,'{asset:cap}','[{"name":"Black","hex":"#0d0d0d"},{"name":"Crimson","hex":"#c30023"}]','{"One size"}','cap','single',null,true,false,null,2),
('sakura-tee','Sakura Tee',27,'{asset:sakura}','[{"name":"White","hex":"#f2f2f2"},{"name":"Black","hex":"#0d0d0d"}]','{S,M,L,XL,XXL}','tee','single',null,false,false,null,3),
('last-dance-tee','The Last Dance Tee',28,'{asset:lastdance}','[{"name":"Washed grey","hex":"#4a4a4a"},{"name":"Black","hex":"#0d0d0d"}]','{S,M,L,XL,XXL}','tee','single',null,true,false,null,4),
('after-midnight-hoodie','After Midnight Hoodie',45,'{asset:hoodie-midnight}','[{"name":"Black","hex":"#0d0d0d"},{"name":"Washed grey","hex":"#4a4a4a"}]','{S,M,L,XL,XXL}','hoodie','single',null,true,false,'New',5),
('vice-script-hoodie','Vice Script Hoodie',48,'{asset:hoodie-script}','[{"name":"Washed grey","hex":"#4a4a4a"},{"name":"Black","hex":"#0d0d0d"}]','{S,M,L,XL,XXL}','hoodie','single',null,true,false,null,6),
('d-soul-night','Soul Night Tee',30,'{asset:nysc}','[{"name":"Black","hex":"#0d0d0d"}]','{S,M,L,XL,XXL}','tee','drop','Night Shift',true,false,'Drop',7),
('d-crimson-cap','Crimson Script Cap',18,'{asset:cap}','[{"name":"Black","hex":"#0d0d0d"},{"name":"Crimson","hex":"#c30023"}]','{"One size"}','cap','drop','Night Shift',true,false,'Drop',8),
('d-bloom','Bloom Back Tee',32,'{asset:sakura}','[{"name":"White","hex":"#f2f2f2"}]','{S,M,L,XL,XXL}','tee','drop','Night Shift',false,true,null,9),
('d-23','Twenty Three Tee',32,'{asset:lastdance}','[{"name":"Washed grey","hex":"#4a4a4a"}]','{S,M,L,XL,XXL}','tee','drop','Night Shift',true,false,'Drop',10)
on conflict (id) do nothing;
insert into public.bundles (id,name,product_ids,price,sort) values
('soul-fit','The Soul Fit','{ny-soul-club,extraordinary-cap}',34,1),
('court-fit','The Court Fit','{last-dance-tee,extraordinary-cap}',37,2),
('full-fit','The Full Rotation','{ny-soul-club,last-dance-tee,extraordinary-cap}',58,3)
on conflict (id) do nothing;