# État du projet

## En cours

Alerte Security Advisor sur `public.spatial_ref_sys` toujours ouverte. La migration `postgis_functions_search_path` est appliquée (11 novembre 2026). Le déplacement de PostGIS vers `extensions` reste à demander au support.

## Fait (récent)

- 12 octobre 2026 : le projet Supabase a été mis en pause malgré les pings des 9, 10 et 11 octobre. Le nom d'hôte ne se résolvait plus. Relance manuelle depuis le dashboard, puis vérification locale : HTTP 200 sur `spots` et `spots_nearby`.
- Workflow GitHub Actions « Keep Supabase awake » : lecture quotidienne de `spots` (limite 1). Test manuel OK, HTTP 200 (8 octobre 2026). Le run planifié du 12 octobre a échoué parce que le projet était déjà en pause.
- App Expo opérationnelle : carte, liste, fiche aire, ajout et édition, profil avec connexion OTP, filtres par type, avis.
- Hors-ligne : SQLite local, synchro des spots, base bundlée (`scripts/generate-bundled-db.mjs`), import initial (`scripts/import-spots.mjs`).
- Migrations présentes : soft delete, RLS select public, `spots_nearby` sans aires supprimées, garde-fou doublons, cache médias Google, unicité avis par spot et utilisateur.

## À faire ensuite

- Reprendre les phases du cahier des charges encore incomplètes (validation communautaire à 3 votes, upload photo, navigation externe) seulement sur demande explicite.
- Le cahier des charges (`CONTEXTE_PROJET.md`) cite encore Supabase comme stack figée : le choix actuel est de le garder, avec le ping, plutôt que de migrer.

## Blocages / questions ouvertes

- Déplacer PostGIS de `public` vers `extensions` via le support Supabase. `DROP EXTENSION postgis CASCADE` supprimerait `spots.location`.
- Après le push, lancer une fois **Keep Supabase awake** à la main dans l'onglet Actions pour confirmer le nouveau rythme.
