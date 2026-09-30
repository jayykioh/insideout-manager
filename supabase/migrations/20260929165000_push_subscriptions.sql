CREATE TABLE public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own push subscriptions" ON public.push_subscriptions
    FOR ALL USING (auth.uid() = user_id);

-- Create a webhook trigger function to call Edge Function
CREATE OR REPLACE FUNCTION public.notify_push_webhook() RETURNS trigger AS $$
DECLARE
  edge_function_url text := 'https://zfzyzwfliihqgeinnyuy.supabase.co/functions/v1/notify_push';
  -- We don't want to hardcode service role keys here normally, but since we are using Database Webhooks natively,
  -- it's better to just rely on Supabase's native webhook feature instead of doing it manually via pg_net.
BEGIN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Actually, it's highly recommended to use Supabase Dashboard -> Database -> Webhooks to configure HTTP triggers 
-- since it handles signing requests with the webhook secret.
-- I'll create the triggers using pg_net just in case.

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.notify_push_webhook() RETURNS trigger AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://zfzyzwfliihqgeinnyuy.supabase.co/functions/v1/notify_push',
    body := jsonb_build_object('type', TG_OP, 'table', TG_TABLE_NAME, 'record', row_to_json(NEW))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notify_push_orders
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_push_webhook();

CREATE TRIGGER notify_push_expenses
  AFTER INSERT ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.notify_push_webhook();
