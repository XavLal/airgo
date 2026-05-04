-- Empêcher deux aires actives à moins de 50 m ; dédoublonner l’existant (conserver la plus ancienne).
-- La colonne spots.location est supposée de type geography(Point).

-- 1) Nettoyage : soft-delete des doublons « trop proches » (garde created_at le plus ancien, tie-break id).
UPDATE public.spots s
SET deleted_at = now()
WHERE s.deleted_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.spots o
    WHERE o.deleted_at IS NULL
      AND o.id <> s.id
      AND ST_DWithin(s.location, o.location, 50)
      AND (
        o.created_at < s.created_at
        OR (o.created_at = s.created_at AND o.id < s.id)
      )
  );

-- 2) Trigger avant insert / mise à jour de la position
CREATE OR REPLACE FUNCTION public.spots_prevent_near_duplicate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.location IS NOT DISTINCT FROM OLD.location THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.spots s
    WHERE s.deleted_at IS NULL
      AND s.id <> NEW.id
      AND ST_DWithin(s.location, NEW.location, 50)
  ) THEN
    RAISE EXCEPTION 'SPOT_TOO_CLOSE: Une aire existe déjà à moins de 50 mètres.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS spots_prevent_near_duplicate_bi ON public.spots;

CREATE TRIGGER spots_prevent_near_duplicate_bi
  BEFORE INSERT OR UPDATE OF location ON public.spots
  FOR EACH ROW
  EXECUTE FUNCTION public.spots_prevent_near_duplicate();

-- 3) RLS : le créateur peut mettre à jour sa fiche (dont soft-delete via deleted_at)
DROP POLICY IF EXISTS "spots_owner_update" ON public.spots;

CREATE POLICY "spots_owner_update"
ON public.spots
FOR UPDATE
TO authenticated
USING (created_by = auth.uid() AND deleted_at IS NULL)
WITH CHECK (created_by = auth.uid());
