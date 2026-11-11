-- Prépare le déplacement de PostGIS du schéma public vers extensions.
-- spatial_ref_sys est une table système PostGIS (propriétaire : supabase_admin).
-- ENABLE ROW LEVEL SECURITY échoue avec « must be owner of table spatial_ref_sys ».
-- Tant que les fonctions sont dans public, le search_path « public, extensions »
-- les résout encore dans public. Après le move fait par le support Supabase,
-- elles sont trouvées dans extensions.

ALTER FUNCTION public.spots_nearby(
  double precision,
  double precision,
  double precision,
  public.spot_type[]
)
SET search_path = public, extensions;

ALTER FUNCTION public.spots_prevent_near_duplicate()
SET search_path = public, extensions;
