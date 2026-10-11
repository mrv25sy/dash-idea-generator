create or replace function public.order_statuses(codes text[])
returns table(order_code text, status text)
language sql stable security definer set search_path = public
as $$
  select o.order_code, o.status from public.orders o
  where o.order_code = any(codes[1:50]);
$$;
revoke all on function public.order_statuses(text[]) from public;
grant execute on function public.order_statuses(text[]) to anon, authenticated, service_role;
