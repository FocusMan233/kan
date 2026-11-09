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

### Sources de cartes
OpenStreetMap (rues, bâtiments, lieux nommés) **+ Overture Maps** (bâtiments Microsoft/Google pour l'Afrique, lieux Meta/Microsoft) : le Docker installe l'outil `overturemaps` et l'import fusionne les deux sources sans doublons (désactiver : `OVERTURE=0`). Si Overture n'est pas accessible, l'import continue avec OpenStreetMap seul.

### Co-construction par les joueurs
Bouton **📍 Lieu** dans le jeu : le joueur ajoute un lieu public (mosquée, marché, école, maquis, carrefour…) avec son nom, et son nom en mooré/dioula (facultatif). Ce lieu apparaît en « à confirmer » pour les voisins ; quand un joueur passe à moins de 13 m, on lui demande « ça existe ? ». Avec 3 confirmations (`PLACE_MIN_VOTES`, `PLACE_YES_RATIO`) le lieu devient permanent et est construit dans le quartier au prochain chargement ; l'auteur gagne 15⭐, chaque vote 3⭐. Admin → **Lieux** : confirmer/rejeter/corriger/ajouter, avec latitude/longitude (lien OpenStreetMap) pour pouvoir améliorer aussi la vraie carte.

### Qualité d'image
Netteté adaptée à chaque téléphone : résolution adaptative (monte si le téléphone est à l'aise, baisse s'il rame), filtrage anisotrope, formes plus fines, ombres 4096 px sur les bons appareils. Forcer : `/?quality=high|mid|low`.

## Contenu
`server/content.js` : quartiers, personnages, missions et phrases. **Les phrases de santé doivent être relues par un professionnel de santé**, et les « bonnes nouvelles » (missions m2, c2, flash info) sont des exemples à **vérifier/remplacer** (admin → Phrases). Les traductions de santé ne sortent dans l'API qu'après ton approbation (admin → Traductions → ✓).

## Admin (`/admin`)
Vue d'ensemble, traductions (filtres, écoute des voix, approuver/rejeter/corriger/ajouter), phrases (ajouter, flash info, drapeaux santé/à vérifier), joueurs, clés API, export JSONL/CSV/JSON.

## API de langue v1 (en-tête `X-API-Key`, clé créée dans l'admin)
- `GET /api/v1/translate?text=Bonjour&source=fr&target=moore` (aussi `source=moore&target=fr`) — mémoire de traduction exacte + approchante
- `GET /api/v1/pairs?target=dioula&limit=100&cursor=…` — paires validées (pagination)
- `GET /api/v1/export?format=jsonl&lang=moore`, `GET /api/v1/audio/:id`, `GET /api/v1/languages`, `GET /api/v1/stats`

## Assistant maternité (2e interface de Kan)
Usage réel des données collectées : suivi des grossesses par SMS, en français, mooré ou dioula.
- **Agent de santé (ASBC)** : `/maternite` — il se connecte (téléphone + code), inscrit une femme enceinte (date des dernières règles, consentement obligatoire, partenaire facultatif avec l'accord de la femme), suit ses CPN, et déclenche une **alerte signe de danger** (SMS au centre de santé et au partenaire).
- **Admin** : `/maternite/admin.html` (même mot de passe que `/admin`) — créer les agents (avec le numéro d'alerte de leur centre de santé), lancer ou **simuler** l'envoi à une autre date (« bond dans le temps » pour une démo), voir alertes et messages.
- **Messages** : calendrier dans `server/maternite.js` (`SCHEDULE`) — conseils signes de danger (14 SA), mouvements du bébé (21 SA), préparation à l'accouchement (33 SA) et rappel avant chacune des 8 CPN OMS (12, 20, 26, 30, 34, 36, 38, 40 SA). Envoi automatique chaque jour après 07:00 UTC (`MATERNITE_SCHEDULER=0` pour couper). Une femme inscrite tard ne reçoit pas les rappels passés.
- **Langues** : le texte de base de chaque message est une phrase de la mission de jeu « Ma grossesse, mon couple » (`MATERNITE_CORES` dans `server/content.js`). Quand sa traduction mooré/dioula est **validée par les joueurs ET approuvée par un admin** (phrase sensible), c'est elle qui part ; sinon le message part en français.
- **SMS** : `SMS_PROVIDER=log` (défaut : rien n'est envoyé, les messages sont seulement enregistrés — mode démo) ou `SMS_PROVIDER=brevo` avec `BREVO_API_KEY` et `SMS_SENDER` (l'appel Brevo n'a pas encore été testé en réel). `DEFAULT_COUNTRY_CODE` (226) complète les numéros à 8 chiffres.
- **Tests** : `npm test`.
- **Avant un usage réel** : faire relire tous les messages par un professionnel de santé ; faire relire le consentement par un juriste (données de santé) ; les données `mat_*` ne sont jamais exposées par l'API publique `/api/v1`. Pas encore gérés : réponses des femmes par SMS, suivi après l'accouchement, fulfuldé.

## Limites connues (phase de test)
- Le numéro de téléphone n'est pas vérifié : quelqu'un qui connaît un numéro peut reprendre le compte correspondant. À remplacer par une vérification (OTP) avant le lancement public.
- Les validations sont croisées entre joueurs : tant qu'il y a peu de joueurs, peu de traductions seront « validées » ; utilise l'approbation admin pour amorcer.
- Personnages et décors sont générés par code (pas de modèles 3D externes). Test : `node tools/smoke-test.mjs` (serveur lancé avec `DATA_DIR=/tmp/kantest PORT=3100 ADMIN_PASSWORD=testpass`).
- Mode démo sans inscription (tests) : `/?demo=1&q=gounghin`.

## Application installable (PWA) et assistant vocal

- `/` (jeu), `/assistant/` (femmes) et `/maternite/` (ASBC) sont installables sur téléphone (manifeste, icônes, service worker `sw.js`, texte en cache hors ligne).
- `/assistant/` : sujets en grosses images, lecture audio (enregistrement validé et approuvé s'il existe, sinon voix française du téléphone), micro en français (mots-clés). Mooré/Dioula : texte et audio uniquement une fois les traductions validées + approuvées par l'admin ; repli en français sinon.
- Pas encore possible : reconnaissance/synthèse libres en mooré et dioula (à entraîner à partir des données collectées par le jeu).
- Rappels : SMS (`SMS_PROVIDER=brevo`) ; WhatsApp vocal non construit (modèles approuvés Meta + audios consentis requis).
