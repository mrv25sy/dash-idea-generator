CREATE OR REPLACE FUNCTION public.order_statuses(codes text[])
RETURNS TABLE(order_code text, status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT o.order_code, o.status FROM public.orders o WHERE o.order_code = ANY(codes) LIMIT 100 $$;

CREATE OR REPLACE FUNCTION public.cancel_order(code text)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$ UPDATE public.orders SET status = 'Canceled' WHERE order_code = code AND lower(status) = 'pending' $$;

GRANT EXECUTE ON FUNCTION public.order_statuses(text[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_order(text) TO anon, authenticated;