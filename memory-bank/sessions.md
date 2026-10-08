# Log des sessions

## 2026-10-08 Ping Supabase et memory bank

- Constat : le plan gratuit Supabase pause le projet après 7 jours sans activité base.
- Choix : ping planifié plutôt qu'une migration (coût et réécriture évités).
- Ajout de `.github/workflows/supabase-keep-alive.yml`, commité et poussé sur `master` (`c177c0c`).
- Secrets ajoutés comme repository secrets. Lancement manuel : HTTP 200.
- Initialisation du dossier `memory-bank/`.
