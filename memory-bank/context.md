# Contexte projet

AirGoCC est une application mobile communautaire de référencement d'aires de camping-car (Europe / monde). Les utilisateurs trouvent des aires autour d'eux sur une carte, filtrent par type, consultent une fiche, et contribuent (ajout, édition, avis).

## Stack technique

- Frontend : React Native, Expo SDK 54, Expo Router, TypeScript strict
- État : Zustand prévu au cahier des charges ; le code actuel s'appuie surtout sur l'état local des écrans et le cache SQLite
- Cartographie : `react-native-maps`, clustering via `supercluster`
- Listes : `@shopify/flash-list`
- Backend : Supabase (plan gratuit) — PostgreSQL + PostGIS, Auth (e-mail OTP), Storage, une Edge Function (`spot-google-media`)
- Hors-ligne : `expo-sqlite` (base bundlée + synchro) et `AsyncStorage` (session, i18n, cache viewport)
- i18n : `i18next`

## Conventions et standards

- Routes uniquement dans `/app` (groupes `(tabs)`, fiches `spot/[id]`, formulaires `add-spot` et `edit-spot`).
- Code métier dans `/src` : `lib/`, `components/`, `theme/`, `tasks/`, `types/`, `constants/`.
- Migrations SQL dans `/supabase/migrations`. Scripts locaux dans `/scripts` (`import-spots.mjs`, `generate-bundled-db.mjs`).
- Requêtes de proximité via la RPC `spots_nearby` (PostGIS), pas un téléchargement complet côté client.
- Pas de données fictives : les aires viennent de l'import `.asc` et des contributions utilisateurs.

## Architecture overview

L'app lit les aires proches via `spots_nearby`, les affiche sur la carte (`app/(tabs)/index.tsx`) et en liste (`app/(tabs)/list.tsx`). Une copie SQLite locale (`src/lib/localDb/`) sert le mode hors-ligne et la base bundlée au premier lancement. L'auth et les écritures (spots, avis, profil) passent par le client Supabase (`src/lib/supabase.ts`).

Le projet Supabase gratuit se met en pause après 7 jours sans activité base. Un workflow GitHub Actions (`.github/workflows/supabase-keep-alive.yml`) fait une lecture réelle de `spots` chaque jour à 05:00 UTC pour éviter cette pause.

## Points d'attention

- Les secrets `SUPABASE_URL` et `SUPABASE_ANON_KEY` sont des repository secrets GitHub. Le workflow n'utilise pas d'environment secrets.
- Un health check Auth ne compte pas comme activité : le ping doit passer par PostgREST (`/rest/v1/spots`).
- Les workflows planifiés GitHub ne tournent que sur la branche par défaut (`master`) et peuvent être décalés.
- RLS : `spots` est lisible par `anon` pour les lignes non supprimées (`deleted_at IS NULL`). La RPC `spots_nearby` est `SECURITY DEFINER`.
