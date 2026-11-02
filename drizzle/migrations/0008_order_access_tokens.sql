-- Order lookups/cancels require the per-order secret token (or ownership), not just the guessable order code.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS access_token uuid NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS orders_access_token_key ON public.orders(access_token);
DROP FUNCTION IF EXISTS public.order_statuses(text[]);
DROP FUNCTION IF EXISTS public.cancel_order(text);
CREATE OR REPLACE FUNCTION public.order_statuses(tokens uuid[]) RETURNS TABLE(order_code text, status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT o.order_code, o.status FROM public.orders o WHERE o.access_token = ANY(tokens) LIMIT 100 $$;
CREATE OR REPLACE FUNCTION public.cancel_order(code text, token uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS
$$ UPDATE public.orders SET status = 'Canceled'
   WHERE order_code = code AND lower(status) = 'pending'
     AND ((token IS NOT NULL AND access_token = token) OR (auth.uid() IS NOT NULL AND user_id = auth.uid())) $$;
REVOKE ALL ON FUNCTION public.order_statuses(uuid[]), public.cancel_order(text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.order_statuses(uuid[]), public.cancel_order(text, uuid) TO anon, authenticated;
