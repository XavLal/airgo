-- Synchro mobile (import SQLite) : supabase.from('spots').select('*') utilise le rôle anon.
-- La RPC spots_nearby est SECURITY DEFINER : la liste peut marcher alors que le RLS refuse le SELECT sur la table.
--
-- Ne pas activer RLS ici : si la table n’avait pas encore le RLS, ENABLE sans autres politiques bloquerait INSERT/UPDATE.
-- Cette politique ne s’applique que si RLS est déjà activé sur public.spots.

DROP POLICY IF EXISTS "spots_public_select" ON public.spots;

CREATE POLICY "spots_public_select"
ON public.spots
FOR SELECT
TO anon, authenticated
USING (deleted_at IS NULL);
