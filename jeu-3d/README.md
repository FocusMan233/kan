# Kan — jeu 3D pour collecter du mooré et du dioula

Le joueur choisit son quartier de Ouagadougou, se promène en 3D, et traduit des phrases françaises (marché, taxi-moto, maquis, centre de santé, meeting, coin culturel) dans sa langue, à l'écrit et/ou à la voix. Écrire n'est pas obligatoire : le joueur peut seulement parler (la voix suffit). Les phrases sans texte apparaissent « à transcrire » dans l'admin. Les personnages disent leur phrase à voix haute (synthèse vocale du téléphone, en français). Les joueurs valident les traductions des autres en répondant à des tâches « écouter ». Une partie admin et une **API de langue** exposent les données validées.

## Lancer
```bash
npm install
ADMIN_PASSWORD="un-mot-de-passe-solide" npm start     # http://localhost:3000   (admin : /admin)
```
Variables : `ADMIN_PASSWORD` (obligatoire en vrai), `PORT` (3000), `DATA_DIR` (./data : base SQLite + audios — à sauvegarder), `MIN_VOTES` (3), `YES_RATIO` (0.67).
Node 22+ requis (`node:sqlite`). Docker : `docker build -t kan . && docker run -p 3000:3000 -v kan-data:/data -e ADMIN_PASSWORD=... kan`.

**HTTPS obligatoire en ligne** : sans HTTPS, les navigateurs refusent le micro (l'enregistrement de voix) et le partage de clip. Mets le jeu derrière un domaine HTTPS (Caddy, Nginx, Cloudflare, Render, Railway, Fly…).

## Vraies cartes de quartiers (important)
Par défaut les quartiers utilisent un plan **stylisé**. Pour que les joueurs reconnaissent leurs vraies rues, lance sur une machine avec Internet :
```bash
node tools/import-osm.mjs              # les 4 quartiers (OpenStreetMap : rues, bâtiments, arbres)
node tools/import-osm.mjs gounghin --center=12.3714,-1.5426   # centre précis si besoin
```
Ça écrit `public/data/quartiers/<id>.json` ; le jeu l'utilise automatiquement (badge « Carte réelle ✓ »). Zone : 300 m × 300 m autour du centre. Pense à citer « © contributeurs OpenStreetMap ». Les quartiers sont dans `server/content.js`.

### Rendre un quartier fidèle
L'import choisit automatiquement, dans un rayon de ~850 m autour du centre trouvé par Nominatim, la fenêtre de 300 m qui contient le plus de lieux nommés (mosquées, églises, écoles, marché, stations, banques…). Ces lieux sont construits dans le jeu **avec leur vrai nom** (plaque, minaret, croix, auvent de station…) et les noms de rues sont affichés sur des plaques vertes. Si la fenêtre choisie n'est pas la bonne : `node tools/import-osm.mjs gounghin --center=LAT,LON` (clic droit sur Google Maps → copier les coordonnées), ou ajoute `center: [lat, lon]` au quartier dans `server/content.js`.

## Contenu
`server/content.js` : quartiers, personnages, missions et phrases. **Les phrases de santé doivent être relues par un professionnel de santé**, et les « bonnes nouvelles » (missions m2, c2, flash info) sont des exemples à **vérifier/remplacer** (admin → Phrases). Les traductions de santé ne sortent dans l'API qu'après ton approbation (admin → Traductions → ✓).

## Admin (`/admin`)
Vue d'ensemble, traductions (filtres, écoute des voix, approuver/rejeter/corriger/ajouter), phrases (ajouter, flash info, drapeaux santé/à vérifier), joueurs, clés API, export JSONL/CSV/JSON.

## API de langue v1 (en-tête `X-API-Key`, clé créée dans l'admin)
- `GET /api/v1/translate?text=Bonjour&source=fr&target=moore` (aussi `source=moore&target=fr`) — mémoire de traduction exacte + approchante
- `GET /api/v1/pairs?target=dioula&limit=100&cursor=…` — paires validées (pagination)
- `GET /api/v1/export?format=jsonl&lang=moore`, `GET /api/v1/audio/:id`, `GET /api/v1/languages`, `GET /api/v1/stats`

## Limites connues (phase de test)
- Le numéro de téléphone n'est pas vérifié : quelqu'un qui connaît un numéro peut reprendre le compte correspondant. À remplacer par une vérification (OTP) avant le lancement public.
- Les validations sont croisées entre joueurs : tant qu'il y a peu de joueurs, peu de traductions seront « validées » ; utilise l'approbation admin pour amorcer.
- Personnages et décors sont générés par code (pas de modèles 3D externes). Test : `node tools/smoke-test.mjs` (serveur lancé avec `DATA_DIR=/tmp/kantest PORT=3100 ADMIN_PASSWORD=testpass`).
- Mode démo sans inscription (tests) : `/?demo=1&q=gounghin`.
