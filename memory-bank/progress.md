# État du projet

## En cours

Rien en cours de développement. Dernier sujet clos : maintien du projet Supabase gratuit via un ping planifié.

## Fait (récent)

- Workflow GitHub Actions « Keep Supabase awake » : lecture quotidienne de `spots` (limite 1). Test manuel OK, HTTP 200 (8 octobre 2026).
- App Expo opérationnelle : carte, liste, fiche aire, ajout et édition, profil avec connexion OTP, filtres par type, avis.
- Hors-ligne : SQLite local, synchro des spots, base bundlée (`scripts/generate-bundled-db.mjs`), import initial (`scripts/import-spots.mjs`).
- Migrations présentes : soft delete, RLS select public, `spots_nearby` sans aires supprimées, garde-fou doublons, cache médias Google, unicité avis par spot et utilisateur.

## À faire ensuite

- Reprendre les phases du cahier des charges encore incomplètes (validation communautaire à 3 votes, upload photo, navigation externe) seulement sur demande explicite.
- Le cahier des charges (`CONTEXTE_PROJET.md`) cite encore Supabase comme stack figée : le choix actuel est de le garder, avec le ping, plutôt que de migrer.

## Blocages / questions ouvertes

Aucun. Le ping manuel a confirmé que les repository secrets sont corrects.
