# Décisions techniques

## 2026-10-08 Rester sur Supabase gratuit avec un ping quotidien

**Contexte :** Le projet Supabase gratuit se met en pause lorsqu'il n'y a pas assez d'appels vers la base. L'app dépend de Postgres/PostGIS, de l'auth OTP, du Storage et du client `supabase-js`.

**Décision :** Ne pas changer d'hébergeur. Ajouter un workflow GitHub Actions qui lit une ligne de `public.spots` via PostgREST une fois par jour (05:00 UTC), avec `workflow_dispatch` pour un test manuel. Secrets au niveau du dépôt : `SUPABASE_URL`, `SUPABASE_ANON_KEY`.

**Pourquoi :** Évite un coût d'hébergement et une réécriture de l'auth, du stockage et des requêtes spatiales. Une lecture réelle compte comme activité base ; un endpoint de santé Auth ne suffit pas.

**Alternatives écartées :** Supabase auto-hébergé sur VPS (même API, mais sauvegardes, mises à jour et SMTP à gérer). Postgres managé type Neon (réveil automatique, mais plus d'auth ni de storage intégrés). Firebase, PocketBase ou Appwrite (pas de PostGIS adapté aux recherches par rayon).
