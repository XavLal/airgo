-- RPC liste : exclure les aires soft-supprimées (carte / liste réseau hors SQLite)

CREATE OR REPLACE FUNCTION public.spots_nearby(
  lat double precision,
  lng double precision,
  radius_km double precision DEFAULT 50,
  spot_types spot_type[] DEFAULT NULL::spot_type[]
)
RETURNS TABLE(
  id uuid,
  name text,
  city text,
  country text,
  type spot_type,
  is_verified boolean,
  validation_count integer,
  latitude double precision,
  longitude double precision,
  distance_km double precision
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.name,
    s.city,
    s.country,
    s.type,
    s.is_verified,
    s.validation_count,
    ST_Y(s.location::geometry) AS latitude,
    ST_X(s.location::geometry) AS longitude,
    ROUND((ST_Distance(s.location, ST_MakePoint(lng, lat)::geography) / 1000)::numeric, 2)::double precision AS distance_km
  FROM spots s
  WHERE ST_DWithin(s.location, ST_MakePoint(lng, lat)::geography, radius_km * 1000)
    AND (spot_types IS NULL OR s.type = ANY(spot_types))
    AND s.deleted_at IS NULL
  ORDER BY s.location <-> ST_MakePoint(lng, lat)::geography;
END;
$function$;
