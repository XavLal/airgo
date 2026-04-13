-- Delta sync + soft delete (table public.spots)
-- Appliqué sur le projet Supabase AirGoCC ; à rejouer via `supabase db push` / link

-- 1. updated_at (backfill depuis created_at)
ALTER TABLE public.spots
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

UPDATE public.spots
SET updated_at = created_at
WHERE updated_at IS NULL;

ALTER TABLE public.spots
  ALTER COLUMN updated_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT now();

-- 2. soft delete
ALTER TABLE public.spots
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- 3. is_deleted aligné avec l'app (dérivé de deleted_at)
ALTER TABLE public.spots
  DROP COLUMN IF EXISTS is_deleted;

ALTER TABLE public.spots
  ADD COLUMN is_deleted boolean
  GENERATED ALWAYS AS (deleted_at IS NOT NULL) STORED;

-- 4. trigger : toute mise à jour bump updated_at (dont soft delete)
CREATE OR REPLACE FUNCTION public.spots_touch_updated_at()
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

DROP TRIGGER IF EXISTS spots_touch_updated_at ON public.spots;

CREATE TRIGGER spots_touch_updated_at
  BEFORE UPDATE ON public.spots
  FOR EACH ROW
  EXECUTE FUNCTION public.spots_touch_updated_at();

-- 5. index pour le delta (filtre + tri)
CREATE INDEX IF NOT EXISTS idx_spots_updated_at_id
  ON public.spots (updated_at ASC, id ASC);

CREATE INDEX IF NOT EXISTS idx_spots_deleted_at
  ON public.spots (deleted_at)
  WHERE deleted_at IS NOT NULL;
