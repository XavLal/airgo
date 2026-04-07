import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type GoogleMediaSource = 'places' | 'street_view';

interface SpotGoogleMediaRequest {
  spotId?: string;
  latitude?: number;
  longitude?: number;
  name?: string;
}

interface SpotGoogleMediaCacheRow {
  source: GoogleMediaSource;
  image_url: string;
  fetched_at: string;
}

interface GoogleMediaResponse {
  source: GoogleMediaSource;
  imageUrl: string;
  fetchedAt: string;
  fromCache: boolean;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function isValidCoordinate(value: number | undefined, min: number, max: number): boolean {
  if (value == null) return false;
  if (!Number.isFinite(value)) return false;
  return value >= min && value <= max;
}

async function uploadGoogleImage(
  supabaseAdmin: ReturnType<typeof createClient>,
  spotId: string,
  source: GoogleMediaSource,
  response: Response,
): Promise<string> {
  const ext = response.headers.get('content-type')?.includes('png') ? 'png' : 'jpg';
  const path = `${spotId}/${source}.${ext}`;
  const bytes = new Uint8Array(await response.arrayBuffer());

  const uploadRes = await supabaseAdmin.storage.from('spot-google-cache').upload(path, bytes, {
    cacheControl: '31536000',
    upsert: true,
    contentType: ext === 'png' ? 'image/png' : 'image/jpeg',
  });

  if (uploadRes.error) {
    throw new Error(`Upload cache impossible: ${uploadRes.error.message}`);
  }

  const publicUrlRes = supabaseAdmin.storage.from('spot-google-cache').getPublicUrl(path);
  return publicUrlRes.data.publicUrl;
}

async function fetchGooglePlacesImage(
  apiKey: string,
  latitude: number,
  longitude: number,
  spotName: string | undefined,
): Promise<Response | null> {
  const keyword = spotName ? `&keyword=${encodeURIComponent(spotName)}` : '';
  const nearbyUrl =
    `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}` +
    `&rankby=distance${keyword}&key=${apiKey}`;

  const nearbyRes = await fetch(nearbyUrl);
  if (!nearbyRes.ok) return null;

  const nearbyData = (await nearbyRes.json()) as {
    results?: Array<{ photos?: Array<{ photo_reference?: string }> }>;
  };

  const photoReference = nearbyData.results
    ?.flatMap((r) => r.photos ?? [])
    .map((p) => p.photo_reference)
    .find((ref): ref is string => typeof ref === 'string' && ref.length > 0);

  if (!photoReference) return null;

  const photoUrl =
    `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200` +
    `&photo_reference=${encodeURIComponent(photoReference)}&key=${apiKey}`;
  const photoRes = await fetch(photoUrl);
  return photoRes.ok ? photoRes : null;
}

async function fetchStreetViewImage(apiKey: string, latitude: number, longitude: number): Promise<Response | null> {
  const metadataUrl =
    `https://maps.googleapis.com/maps/api/streetview/metadata?location=${latitude},${longitude}&key=${apiKey}`;
  const metadataRes = await fetch(metadataUrl);
  if (!metadataRes.ok) return null;

  const metadata = (await metadataRes.json()) as { status?: string };
  if (metadata.status !== 'OK') return null;

  const imageUrl =
    `https://maps.googleapis.com/maps/api/streetview?size=1200x675&location=${latitude},${longitude}` +
    `&fov=90&pitch=0&key=${apiKey}`;
  const imageRes = await fetch(imageUrl);
  return imageRes.ok ? imageRes : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const googleApiKeyFromSecret = Deno.env.get('GOOGLE_MAPS_API_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: 'Missing server secrets' }, 500);
    }

    const body = (await req.json()) as SpotGoogleMediaRequest;
    const { spotId, latitude, longitude, name } = body;
    const googleApiKey = googleApiKeyFromSecret;

    if (!spotId || !googleApiKey || !isValidCoordinate(latitude, -90, 90) || !isValidCoordinate(longitude, -180, 180)) {
      return jsonResponse({ error: 'Invalid payload' }, 400);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const cachedRes = await supabaseAdmin
      .from('spot_google_media_cache')
      .select('source, image_url, fetched_at')
      .eq('spot_id', spotId)
      .maybeSingle();

    const cachedData = cachedRes.data as SpotGoogleMediaCacheRow | null;
    if (!cachedRes.error && cachedData?.image_url) {
      const payload: GoogleMediaResponse = {
        source: cachedData.source,
        imageUrl: cachedData.image_url,
        fetchedAt: cachedData.fetched_at,
        fromCache: true,
      };
      return jsonResponse(payload);
    }

    const placesImage = await fetchGooglePlacesImage(googleApiKey, latitude, longitude, name);
    const source: GoogleMediaSource = placesImage ? 'places' : 'street_view';
    const imageRes = placesImage ?? (await fetchStreetViewImage(googleApiKey, latitude, longitude));

    if (!imageRes) {
      return jsonResponse({ error: 'No Google media found' }, 404);
    }

    const publicUrl = await uploadGoogleImage(supabaseAdmin, spotId, source, imageRes);
    const fetchedAt = new Date().toISOString();

    const upsertRes = await supabaseAdmin.from('spot_google_media_cache').upsert({
      spot_id: spotId,
      source,
      image_url: publicUrl,
      fetched_at: fetchedAt,
    });
    if (upsertRes.error) {
      return jsonResponse({ error: `Cache DB update failed: ${upsertRes.error.message}` }, 500);
    }

    const payload: GoogleMediaResponse = {
      source,
      imageUrl: publicUrl,
      fetchedAt,
      fromCache: false,
    };
    return jsonResponse(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
