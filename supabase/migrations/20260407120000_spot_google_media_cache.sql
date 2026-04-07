CREATE TABLE IF NOT EXISTS public.spot_google_media_cache (
  spot_id uuid PRIMARY KEY REFERENCES public.spots(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('places', 'street_view')),
  image_url text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.spot_google_media_cache_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS spot_google_media_cache_touch_updated_at ON public.spot_google_media_cache;

CREATE TRIGGER spot_google_media_cache_touch_updated_at
  BEFORE UPDATE ON public.spot_google_media_cache
  FOR EACH ROW
  EXECUTE FUNCTION public.spot_google_media_cache_touch_updated_at();

ALTER TABLE public.spot_google_media_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "spot_google_media_cache_public_select" ON public.spot_google_media_cache;
CREATE POLICY "spot_google_media_cache_public_select"
ON public.spot_google_media_cache
FOR SELECT
TO anon, authenticated
USING (true);

INSERT INTO storage.buckets (id, name, public)
VALUES ('spot-google-cache', 'spot-google-cache', true)
ON CONFLICT (id) DO NOTHING;
