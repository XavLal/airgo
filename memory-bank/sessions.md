# Log des sessions

## 2026-10-12 Pause Supabase malgré le ping

- L'e-mail d'avertissement a été suivi d'une pause réelle : le nom d'hôte du projet ne se résolvait plus, et le cron du 12 octobre a échoué.
- Les runs des 9, 10 et 11 octobre étaient verts. Une seule lecture par jour n'a pas atteint le seuil « quelques requêtes par jour ».
- Base relancée depuis le dashboard. Vérification locale : HTTP 200 sur `spots` et `spots_nearby`.
- Workflow renforcé (4 fois par jour, 3 lectures, retries) et poussé sur `master`.

## 2026-10-08 Ping Supabase et memory bank

- Constat : le plan gratuit Supabase pause le projet après 7 jours sans activité base.
- Choix : ping planifié plutôt qu'une migration (coût et réécriture évités).
- Ajout de `.github/workflows/supabase-keep-alive.yml`, commité et poussé sur `master` (`c177c0c`).
- Secrets ajoutés comme repository secrets. Lancement manuel : HTTP 200.
- Initialisation du dossier `memory-bank/`.
